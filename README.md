<div align="center">

# 检定统计与成就

**为 SealDice 提供检定数据查询、成就登记与图片展示。**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![SealDice](https://img.shields.io/badge/SealDice-JS_Extension-blue)](https://docs.sealdice.com/advanced/js_start.html)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

[快速开始](#快速开始) · [命令](#命令) · [成就配置](#成就配置) · [开发接入](#开发接入) · [贡献](#贡献)

</div>

---

## 概览

| 模块 | 能力 |
| --- | --- |
| 检定统计 | 成功率、总成功/失败次数、六类结果次数；支持命令与只读 API |
| 成就系统 | 定义登记、玩家解锁记录、去重、隐藏成就、列表及详情查询 |
| 展示 | 文字或外部 Web API 渲染图片；异常时自动回退文字 |

扩展标识为 `analyzed`。检定计数由海豹自定义文案累加个人变量；成就完成条件由接入插件判断。本插件不自动监听检定结果或自动解锁成就。

## 快速开始

### 1. 安装扩展

在海豹 WebUI 的扩展管理中导入 `.sealpack` 扩展包，确认 `analyzed` 已启用；使用单文件版本时，在 JS 扩展管理中加载 `dist/sealdice-js-ext.js`。

从源码构建安装包的方法见[本地开发](#本地开发)。安装后成就命令可用；检定统计还需要完成下一步。

### 2. 配置检定自定义文案

在海豹 WebUI 打开：

**自定义文案 → COC → 判定-常规**

找到下表对应的文案，在原有内容末尾添加脚本并保存。脚本负责在每次生成结果时累加 `$m` 个人变量，不需要手动创建变量，也不需要改动角色卡。

| 文案项 | 添加的脚本 |
| --- | --- |
| `判定_普通成功` | `{%if 1 {$m普通成功=$m普通成功+1}%}` |
| `判定_困难成功` | `{%if 1 {$m困难成功=$m困难成功+1}%}` |
| `判定_极难成功` | `{%if 1 {$m极难成功=$m极难成功+1}%}` |
| `判定_大成功` | `{%if 1 {$m大成功=$m大成功+1}%}` |
| `判定_失败` | `{%if 1 {$m失败=$m失败+1}%}` |
| `判定_大失败` | `{%if 1 {$m大失败=$m大失败+1}%}` |

具体文案名称以当前海豹版本显示为准。将脚本放入对应结果项，每项仅添加一次，避免重复计数。不要覆盖原有回复内容。

<details>
<summary><strong>使用必须困难判定时的附加配置</strong></summary>

在 `判定*必须*困难_失败` 中追加：

```text
{%
if $t附加判定结果=='(大失败)'
{
    $m大失败=$m大失败+1
}
if $t附加判定结果==''
{
    $m失败=$m失败+1
}
%}
```

在 `判定*必须*困难_成功` 中追加：

```text
{%
if $t附加判定结果=='(大成功)'
{
    $m大成功=$m大成功+1
}
if $t附加判定结果==''
{
    $m困难成功=$m困难成功+1
}
%}
```

以上条件来自原项目配置示例；附加判定文本如被自定义修改，需要对应调整判断条件。其他特殊判定文案也应按实际模板配置，确保每次检定只累加一个结果变量。

</details>

### 3. 验证统计

执行几次 `.ra` 或 `.rc`，再发送 `.analyzed`，检查检定次数是否增加。

```text
Alice 的检定统计
检定次数：6；成功率：66.67%
成功次数：4（普通 3、困难 0、极难 0、大成功 1）
失败次数：2（失败 2、大失败 0）
```

计数从配置生效后开始，不补录历史检定。未配置、类型不匹配或异常的计数按 0 处理；已有有效累计值继续保留。

## 命令

| 命令 | 用途 |
| --- | --- |
| `.analyzed` | 查看检定总数、成功率及六类结果次数 |
| `.achivements` | 查看成就第一页 |
| `.achivements list [页码]` | 查看所有已登记成就，每页 10 项 |
| `.achivements info 名称` | 查询成就详情 |
| `.achivements info 来源插件/成就ID` | 通过唯一标识查询，适用于名称重复 |

成就命令拼写为 `achivements`。列表同时显示已解锁和未解锁状态。隐藏成就未解锁时仅显示“隐藏成就 / 解锁后揭晓”，不能通过名称或 ID 查询；解锁后展示完整详情。

本插件不预置成就，目录由其他插件登记；尚未接入任何插件时列表为空。不提供清空统计或成就命令。

## 成就配置

在海豹 WebUI 的 **JS 扩展管理 → `analyzed` 的配置 → 成就** 分组中设置以下选项。不同版本入口名称可能略有差异。

| 配置项 | 类型 / 默认值 | 说明 |
| --- | --- | --- |
| `成就渲染方式` | 下拉选项 / `文字` | `文字` 或 `图片`，作用于成就列表与详情 |
| `成就渲染API` | 字符串 / 空 | 图片模式使用的完整接口地址，例如 `https://renderer.example.com/achievements` |
| `成就渲染Token` | 字符串 / 空 | 可选鉴权 Token，请求时使用 `Authorization: Bearer <Token>` |

选择文字模式时，即使已经配置 API 地址，也不会发起渲染请求。选择图片模式后需要填写 API 地址；地址为空、接口失败、响应无效或等待超过 10 秒时回退为文字。

本仓库提供客户端适配器，图片服务由使用者提供。请求协议见[图片渲染 API](#图片渲染-api)。

## 开发接入

### 加载与生命周期

本插件发布两个共享全局对象：`globalThis.sealStats` 与 `globalThis.sealAchievements`，版本均为 `1`。先加载本插件，再加载依赖插件；在调用时获取对象，避免重载后仍持有旧引用。

其他插件负责成就条件判断、权限检查以及通知。传入的 `ctx` 必须对应实际获得成就的玩家；数据作用域遵循海豹 `$m` 变量。接口同步返回，验证或存储失败抛异常，调用方需要捕获。

### 成就定义

```ts
interface AchievementInput {
  source: string;      // 来源插件，发布后保持稳定
  id: string;          // 在来源插件内唯一，发布后保持稳定
  name: string;        // 展示名称
  description: string; // 描述，可为空字符串
  hidden?: boolean;   // 默认 false
}
```

`source`、`id`、`name` 必须为非空字符串，各不超过 200 字符；`description` 不超过 2000 字符。不同来源插件的相同 ID 独立计数。

### 成就 API 参考

| 方法 | 返回值 | 行为 |
| --- | --- | --- |
| `register(achievement)` | `void` | 登记或更新成就定义，使未解锁成就也能被列出；不解锁 |
| `record(ctx, achievement)` | `RecordResult` | 登记当前玩家解锁；未登记定义时自动补登记；按 `source + id` 去重 |
| `list(ctx)` | `AchievementView[]` | 返回全部定义及当前玩家状态，未解锁隐藏成就返回占位数据 |
| `info(ctx, name)` | `AchievementView \| undefined` | 按名称或 `source/id` 查询；无匹配返回 `undefined`，名称重复抛异常 |

```ts
interface RecordResult {
  recorded: boolean; // true 表示本次新增，重复调用为 false
  total: number;     // 当前玩家已解锁数量
  achievement: AchievementInput & { unlockedAt: number };
}

interface AchievementView {
  name: string;
  description: string;
  unlocked: boolean;
  hidden: boolean;
  source?: string;
  id?: string;
  unlockedAt?: number; // 毫秒时间戳
}
```

重复 `record` 不改写首次解锁记录，不重复计数；`register` 更新定义不改变玩家状态。查询使用当前定义展示，记录保留首次解锁时的快照。`record` 不自动回复消息。

### 接入示例

下面的函数可由你的插件初始化流程和业务回调分别调用：

```js
const FIRST_TASK = {
  source: 'my-plugin',
  id: 'first-task',
  name: '初次挑战',
  description: '完成第一次任务',
  hidden: false,
};

// 初始化时调用。若依赖尚未加载，应在加载完成后重试登记。
function registerAchievements() {
  const hook = globalThis.sealAchievements;
  if (!hook || hook.version !== 1) return false;
  hook.register(FIRST_TASK);
  return true;
}

// 仅在业务逻辑确认条件满足后调用，ctx/msg 来自你的插件回调。
function onFirstTaskCompleted(ctx, msg) {
  const hook = globalThis.sealAchievements;
  if (!hook || hook.version !== 1) return;
  try {
    const result = hook.record(ctx, FIRST_TASK);
    if (result.recorded) {
      seal.replyToSender(ctx, msg, '获得成就：' + result.achievement.name);
    }
  } catch (error) {
    console.log('成就记录失败：' + String(error));
  }
}
```

需要隐藏成就时设 `hidden: true`。隐藏规则保护聊天展示和渲染请求，不构成对同一 JS VM 内插件代码的安全隔离。

TypeScript 调用方可引用 `types/achievements.d.ts` 及其关联的源码类型。实际海豹版本中的跨插件全局共享需要运行验证。

### 检定统计 API 参考

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `getSuccessRate(ctx)` | `number` | 0 到 1，无检定返回 0；展示百分比时乘以 100 |
| `getSuccessCount(ctx)` | `number` | 普通、困难、极难、大成功之和 |
| `getFailureCount(ctx)` | `number` | 失败与大失败之和 |
| `getCount(ctx, kind)` | `number` | 指定结果次数，未知类型抛异常 |
| `getStats(ctx)` | `CheckStats` | 六类次数及 `successes`、`failures`、`total`、`successRate` |

| `kind` | 对应变量 |
| --- | --- |
| `normalSuccess` | `$m普通成功` |
| `hardSuccess` | `$m困难成功` |
| `extremeSuccess` | `$m极难成功` |
| `criticalSuccess` | `$m大成功` |
| `failure` | `$m失败` |
| `fumble` | `$m大失败` |

```js
const stats = globalThis.sealStats;
if (stats && stats.version === 1) {
  const successRate = stats.getSuccessRate(ctx);
  const criticals = stats.getCount(ctx, 'criticalSuccess');
  const snapshot = stats.getStats(ctx);
}
```

### 图片渲染 API

**请求**：`POST <成就渲染API>`，`Content-Type: application/json`。配置 Token 时附带 Bearer 鉴权。

```json
{
  "version": 1,
  "title": "Alice 的成就",
  "page": 1,
  "pages": 1,
  "unlocked": 0,
  "total": 1,
  "achievements": [
    {
      "name": "隐藏成就",
      "description": "解锁后揭晓",
      "hidden": true,
      "unlocked": false
    }
  ]
}
```

`achievements` 使用上面的 `AchievementView` 结构；隐藏字段在请求发送前已移除。列表请求包含当前页数据，`unlocked/total` 为整个目录的统计；详情请求只包含一项，页码和页数均为 1。

**响应**：成功状态码及 JSON 图片地址：

```json
{ "imageUrl": "https://renderer.example.com/results/achievement.png" }
```

地址须为 HTTP(S)，并且能被聊天平台访问。插件通过图片消息段发送该地址。等待上限为 10 秒，超时回退不取消底层网络请求。请求包含玩家展示名称和可见成就，渲染服务地址由骰主配置。

## 工程结构

```text
src/
  index.ts                 # 注册、组装及全局 API 发布
  stats/
    service.ts             # 统计读取与查询 API
    command.ts             # .analyzed
  achievements/
    service.ts             # 登记、解锁与展示规则
    catalog.ts             # 全局成就定义目录
    store.ts               # 玩家解锁存储与迁移
    command.ts             # .achivements
  rendering/
    web-api.ts             # 渲染配置、请求与超时
types/                     # SealDice 与调用接口类型
scripts/                   # 行为测试与打包脚本
sealpack/                  # 扩展包配置及展示资源
```

玩家解锁状态保存于 `$manalyzed_achievement_state_v1`，格式为 `{ version: 2, records }`。全局成就目录保存于扩展存储 `achievement_catalog_v1`，格式为 `{ version: 1, definitions }`。

兼容旧版 `unlocks`，保留旧 ID 和解锁时间；损坏 JSON、重复记录或未知版本报错并保留原数据。卸载来源插件后，已有解锁记录仍可查询。

## 本地开发

需要 Node.js 18 或以上及 npm。

```bash
npm ci
npm run check
```

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 生成 `dist/sealdice-js-ext.js` |
| `npm run check` | ESLint、严格类型检查、构建及行为测试 |
| `npm run package:check` | 检查豹包格式与大小，需要 `sealpack` CLI |
| `npm run pack:sealpack` | 构建 JS 后运行，生成 `.sealpack`，需要 `sealpack` CLI |

测试覆盖统计 API、登记/解锁、去重、玩家隔离、隐藏、分页、渲染模式切换及异常回退、迁移和重载。实际海豹变量作用域、跨插件调用、网络请求和图片发送需在运行环境验证。

## 贡献

欢迎通过 Issue 报告问题或讨论接口。提交代码前运行 `npm run check`；修改对外 API 时同步更新类型声明、示例及兼容说明。

开发前阅读 [AGENTS.md](AGENTS.md)，SealDice API 参考：[入门](https://docs.sealdice.com/advanced/js_start.html) · [接口列表](https://docs.sealdice.com/advanced/js_api_list.html) · [示例](https://docs.sealdice.com/advanced/js_example.html)。

## 许可证

[MIT](LICENSE) © Leave_Time
