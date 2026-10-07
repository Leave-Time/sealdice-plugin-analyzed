# 成就统计

SealDice 成就记录模块。其他 JS 插件自行判断成就完成条件，然后调用本模块的 hook 登记；本模块负责持久化、去重及统计查询。

## 使用

```text
.achivements
.achivements 2
```

显示当前玩家已完成数量和成就列表，每页 10 项，按登记时间倒序排列。命令拼写为 `achivements`。

保留扩展标识 `analyzed` 以兼容原安装。原 `.analyzed` 统计命令、检定消息监听、内置成就评估和反馈配置已移除。原六项 COC 变量保持原值，本模块不读取或累加它们。

## 对外 Hook

先加载本插件，在其他插件实际需要登记时获取 `globalThis.sealAchievements`，不要在加载时缓存它。共享同一个海豹 JS VM 的插件通过此全局对象调用：

```js
// 调用方已经确认成就条件完成。
const hook = globalThis.sealAchievements;
if (!hook || hook.version !== 1) {
  console.log('成就统计插件尚未加载');
} else {
  try {
    const result = hook.record(ctx, {
      source: 'my-plugin',
      id: 'first-task',
      name: '初次挑战',
      description: '完成第一次任务',
    });
    if (result.recorded) {
      // 调用方自行决定是否通知，以及发送到哪里。
      seal.replyToSender(ctx, msg, '获得成就：' + result.achievement.name);
    }
  } catch (error) {
    console.log('成就登记失败：' + String(error));
  }
}
```

`source` 为来源插件的稳定标识，`id` 为该插件内的稳定成就标识，`name` 为展示名称，`description` 为描述（可为空字符串）。前三项最多 200 个字符，描述最多 2000 个字符。

`record` 是同步接口。成功返回 `{ recorded, total, achievement }`，其中 `total` 为当前玩家的已完成成就数量。相同玩家的相同 `source + id` 只登记一次；重复登记返回 `recorded: false`，保留最初的名称、描述及时间。验证或存储失败会抛出异常，调用方可处理或重试。登记成功不发送消息。

传入的 `ctx` 必须对应实际获得成就的玩家，遵循海豹 `$m` 变量作用域。跨群行为遵循海豹个人变量的实际作用域；hook 不提供远程用户 ID 寻址。调用方负责插件启停、权限检查及成就条件。全局 hook 属于同 VM 的合作接口，不是安全隔离边界。

TypeScript 调用方可以引用 `types/achievements.d.ts` 及其引用的类型文件。海豹实际版本中的跨插件全局共享和变量作用域仍需运行验证。

## 存储与迁移

使用 `$manalyzed_achievement_state_v1` 字符串变量保存 `{ version: 2, records: [...] }`。变量名沿用旧版，版本字段升级。旧版 `unlocks` 会在读取时转换，在下一次新增成就保存时写为版本 2；保留原 ID 和登记时间，来源标为 `analyzed`。

损坏 JSON、重复记录、类型不匹配和未知版本会报错，保留原数据。查询失败会提示联系骰主。不提供清空命令。

## 构建

Node.js 18 或以上：

```bash
npm install
npm run check
```

加载 `dist/sealdice-js-ext.js`，或使用 `npm run pack:sealpack` 生成豹包。`npm run check` 执行 lint、类型检查、构建及 hook 行为测试。

## 开发

- `src/index.ts`：注册命令及共享 hook。
- `src/achievements.ts`：hook 契约及登记逻辑。
- `src/achievement-store.ts`：个人变量存储与迁移。

许可证：MIT。
