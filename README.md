# 检定统计与成就

SealDice JS 插件，扩展标识 `analyzed`。统计读取自定义文案累加的个人变量；成就条件由其他插件判断，本插件提供登记、解锁、查询和图片展示。

## 命令

```text
.analyzed
.achivements list
.achivements list 2
.achivements info 初次挑战
.achivements info my-plugin/first-task
```

`list` 每页 10 项，显示所有已登记成就的解锁/未解锁状态。名称重复时用 `来源插件/成就ID` 查询。隐藏成就未解锁时仅显示“隐藏成就”和“解锁后揭晓”，不能通过名称或 ID 查询；解锁后显示完整详情。未指定子命令时显示第一页。

## 检定统计 API

`globalThis.sealStats` 提供同步只读接口，调用时检查是否已加载：

```js
const stats = globalThis.sealStats;
if (stats) {
  const rate = stats.getSuccessRate(ctx); // 0 到 1；没有检定时为 0
  const successes = stats.getSuccessCount(ctx); // 四类成功之和
  const failures = stats.getFailureCount(ctx); // 失败 + 大失败
  const criticals = stats.getCount(ctx, 'criticalSuccess');
  const all = stats.getStats(ctx); // 各类次数、successes、failures、total、successRate
}
```

`getCount` 类型：`normalSuccess`（普通成功）、`hardSuccess`（困难成功）、`extremeSuccess`（极难成功）、`criticalSuccess`（大成功）、`failure`（失败）、`fumble`（大失败）。对应 `$m普通成功`、`$m困难成功`、`$m极难成功`、`$m大成功`、`$m失败`、`$m大失败`。缺失、类型不匹配、负数、非有限值按 0 处理。

仍需通过海豹自定义文案累加这六个变量，例如在普通成功文案中加入 `{%if 1 {$m普通成功=$m普通成功+1}%}`。其他结果写入对应变量；困难等附加判定需按实际文案条件配置，避免重复计数。本模块不监听检定结果，不重复累加、不清空统计。

## 成就 API

先加载本插件，调用时读取 `globalThis.sealAchievements`。接口版本保持 `version: 1`，兼容已有 `record()` 调用。

```js
const hook = globalThis.sealAchievements;
if (hook) {
  const achievement = {
    source: 'my-plugin', id: 'first-task',
    name: '初次挑战', description: '完成第一次任务', hidden: false,
  };
  // 登记定义，不解锁。插件初始化时登记，使未解锁成就也能列出。
  hook.register(achievement);
  // 调用方确认条件达成之后才执行：
  const result = hook.record(ctx, achievement);
  if (result.recorded) seal.replyToSender(ctx, msg, '成就解锁：' + result.achievement.name);
  const list = hook.list(ctx);
  const detail = hook.info(ctx, 'my-plugin/first-task');
}
```

`register` 可更新同一 `source + id` 的名称、描述及隐藏设置，不改变玩家解锁记录。`record` 同步持久化并返回 `{ recorded, total, achievement }`，重复解锁返回 `recorded: false`。若未预先登记定义，`record` 会补登记。记录存在时保留首次解锁快照和时间；查询展示当前定义。hook 不自动发送通知。

前三个字符串字段最多 200 字符，描述最多 2000 字符；`hidden` 可选，默认 false。传入实际获得成就的玩家 `ctx`；权限及条件检查由调用方负责。验证或存储失败抛异常，调用方需要处理。不同来源插件的同名 ID 独立计数。隐藏规则针对展示，不是对同 VM 插件代码的安全隔离。

## 图片 Web API

扩展配置 `成就渲染API` 留空默认使用文本。配置后，`list/info` 向该地址 POST JSON；可用 `成就渲染Token` 配置 Bearer Token。调用方提供渲染服务，本仓库不包含图片服务。

请求示例：

```json
{
  "version": 1,
  "title": "Alice 的成就",
  "page": 1,
  "pages": 1,
  "unlocked": 0,
  "total": 1,
  "achievements": [
    { "name": "隐藏成就", "description": "解锁后揭晓", "hidden": true, "unlocked": false }
  ]
}
```

响应：`{ "imageUrl": "https://example.com/result.png" }`。图片地址须能被聊天平台访问。渲染失败、响应无效或超过 10 秒自动使用文本；等待超时不会取消底层请求。隐藏信息在请求前已经移除。请求包含玩家展示名称及可见成就，服务地址由骰主配置。

## 存储与结构

玩家解锁状态：`$manalyzed_achievement_state_v1` 保存 `{ version: 2, records }`，兼容旧版 `unlocks`，保留 ID 和时间。成就定义目录：扩展存储 `achievement_catalog_v1` 保存 `{ version: 1, definitions }`，与玩家解锁分开。目录在插件重载后保留；历史已解锁且目录不存在的成就仍可显示。

损坏 JSON、重复记录或未知版本报错且保留原数据。

```text
src/index.ts              组装及全局 API 发布
src/stats/               检定统计查询与命令
src/achievements/        成就服务、目录、玩家存储与命令
src/rendering/           图片 Web API 适配
types/achievements.d.ts  调用插件使用的类型声明
scripts/smoke.js         行为测试
```

## 构建与验证

Node.js 18 或以上：`npm install`、`npm run check`。加载 `dist/sealdice-js-ext.js`；豹包使用 `npm run pack:sealpack`。

测试覆盖查询 API、目录登记、解锁去重、玩家隔离、隐藏字段、图片请求及回退、迁移与重载。实际海豹跨插件全局共享、变量作用域和图片发送需在运行环境验证。

许可证：MIT。
