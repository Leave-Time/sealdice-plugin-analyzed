# 项目开发指导

## 官方参考

开发 SealDice 扩展时优先查阅以下官方文档，再结合本项目的 `types/seal.d.ts` 和实际运行环境确认 API：

- JS 入门：https://docs.sealdice.com/advanced/js_start.html
- JS API 列表：https://docs.sealdice.com/advanced/js_api_list.html
- JS 示例：https://docs.sealdice.com/advanced/js_example.html

以下变量读写和存储能力已于 2026-10-08 对照上述文档核实。

## 当前检定统计的数据来源

本项目通过海豹自定义文案累加 `$m` 个人变量，插件读取这些变量计算统计结果。现有变量为 `$m普通成功`、`$m困难成功`、`$m极难成功`、`$m大成功`、`$m失败` 和 `$m大失败`。

当前运行环境无法通过 `onCommandReceived` 获得所需的 COC 检定结构化结果。不要据此实现自动统计，也不要假设 `ctx.commandInfo.items` 或临时成功等级变量可用。`docs/js-coc-check-result.md` 中有关该读取方式的说明与当前环境不符，不应作为实现依据。

累计计数不能还原检定顺序、时间、技能名称或连续成功/失败情况。这类功能需要另行设计数据采集机制。

## 变量读写 API

SealDice 提供以下接口，不能把变量读写描述为缺失能力：

```ts
seal.vars.intGet(ctx, key); // [number, boolean]
seal.vars.intSet(ctx, key, value);
seal.vars.strGet(ctx, key); // [string, boolean]
seal.vars.strSet(ctx, key, value);
```

读取返回值的第二项表示变量存在且类型匹配。读取时应检查该标记，并对计数检查有限值和非负值。使用命令传入的 `ctx` 访问当前玩家的 `$m` 变量，遵循海豹的变量作用域。

```ts
const [value, exists] = seal.vars.intGet(ctx, '$m普通成功');
const count = exists && Number.isFinite(value) && value >= 0 ? value : 0;
seal.vars.intSet(ctx, '$m普通成功', count + 1);
```

上述代码仅示范读写方式。已有自定义文案负责累加统计，不能再在插件中重复累加同一次检定。

## 成就持久化的接口方向

`src/achievements.ts` 已定义 `AchievementDefinition`、`AchievementState`、`AchievementStore` 和 `evaluateAchievements`。后续存储适配器可以通过字符串个人变量保存序列化后的成就状态，例如：

```ts
const key = '$manalyzed_achievement_state_v1';
const [raw, exists] = seal.vars.strGet(ctx, key);
// 读取时对 JSON.parse 使用 try/catch，并验证解析后的字段结构。
seal.vars.strSet(ctx, key, JSON.stringify({ unlocks: [] }));
```

这是接口用法示例，不是完整的存储实现。实现时需要处理变量缺失、类型不匹配、损坏 JSON 和状态版本迁移。成就 id 发布后保持稳定；`unlockedAt` 与现有评估器一致使用毫秒时间戳，代表系统确认解锁的时间，不能从累计变量推断历史解锁时间。

官方示例还提供扩展级存储：

```ts
ext.storageSet(key, JSON.stringify(data));
const raw = ext.storageGet(key);
```

扩展级存储以字符串保存数据，不会自动按玩家隔离。若使用它保存玩家成就，需要明确设计平台、用户及所需作用域的存储键。当前优先沿用 `$m` 个人变量，并通过 `AchievementStore` 封装具体存储方式。

成就流程已通过 `src/achievement-flow.ts` 接入消息及命令回调：`onMessageReceived` 记录检定前快照，`onMessageSend` 收集 bot 回复文本，`onCommandReceived` 在命令完成后识别 `.ra/.rc/.rah/.rch` 并评估成就。该回调只用于确认命令完成，不读取检定结构化结果。必须有发送文本且六项累计计数之一增加才评估。

`src/achievement-store.ts` 使用 `$manalyzed_achievement_state_v1` 保存带 `version: 1` 的 JSON，兼容没有版本字段的初始状态。损坏、重复解锁记录或未知版本应报错且保留原数据，不静默清空成就。先保存再反馈，避免重复通知；暗骰反馈私聊发起者。`.analyzed clear` 保留已解锁成就。

`成就系统启用` 和 `成就解锁反馈` 为扩展配置项。反馈通过固定占位符替换生成，不把玩家昵称或检定回复作为 DiceScript 执行。代骰目标与发起者不同时，当前流程跳过评估，因为没有目标的检定前快照。

上述流程依赖实际运行环境的回调时序和发送上下文，不同海豹版本或平台适配器需要验证；发送事件表示适配器的发送行为，不保证收件人已经收到消息。

## 验证

修改 TypeScript 代码后运行 `npm run check`，覆盖 ESLint、严格类型检查、构建和加载冒烟检查。涉及变量作用域及实际持久化的行为，还需要在海豹环境中验证。
