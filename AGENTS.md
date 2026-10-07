# 项目开发指导

## 官方参考

开发时优先查阅官方文档，结合 `types/seal.d.ts` 与运行环境确认 API：

- https://docs.sealdice.com/advanced/js_start.html
- https://docs.sealdice.com/advanced/js_api_list.html
- https://docs.sealdice.com/advanced/js_example.html

变量读写能力已于 2026-10-08 核实：`seal.vars.intGet/intSet/strGet/strSet`。读取返回 `[值, 是否存在且类型匹配]`；字符串可以保存 JSON。扩展级 `ext.storageGet/storageSet` 也支持字符串，但不自动按玩家隔离。

## 当前职责

本插件只负责成就登记、持久化、去重和查询。其他插件判断条件完成后调用 `globalThis.sealAchievements.record(ctx, { source, id, name, description })`。hook 版本为 1，接口定义在 `src/achievements.ts`。调用方应在调用时获取全局 hook，处理未加载及存储异常。

使用 `.achivements [页码]` 查询当前玩家成就，每页 10 项。保留扩展标识 `analyzed` 兼容安装。旧 `.analyzed` 命令、检定监听、条件评估及反馈配置已移除。hook 本身不回复消息，通知交由调用方决定。

相同玩家的 `source + id` 只登记一次。ID 发布后保持稳定；`unlockedAt` 为模块确认登记的毫秒时间戳。传入实际玩家上下文，遵循 `$m` 的运行时作用域。调用方负责条件、权限和插件启停；共享全局接口不提供安全隔离。实际海豹跨插件全局共享仍需运行验证。

## 存储

`src/achievement-store.ts` 通过 `$manalyzed_achievement_state_v1` 存储 `{ version: 2, records }`。保留原变量名，兼容旧版 `version: 1` 或无版本的 `unlocks`，保留旧 ID 和时间并使用来源 `analyzed`。读取时转换，下次新增记录保存时写版本 2。损坏或未知版本、重复记录、类型不匹配应报错并保留原数据。

本模块不读取或写入六项 COC 统计变量。当前环境无法从 `onCommandReceived` 获得所需结构化检定结果，`docs/js-coc-check-result.md` 与实际环境不符，不应作为实现依据。

## 验证

修改 TypeScript 后运行 `npm run check`。测试应覆盖跨脚本 hook 调用、持久化、去重、玩家隔离、查询分页、迁移、异常数据保护和重载。实际变量作用域和海豹跨插件调用需要运行验证。
