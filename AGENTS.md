# 项目开发指导

## 官方参考

优先查阅官方文档，结合 `types/seal.d.ts` 与运行环境确认 API：

- https://docs.sealdice.com/advanced/js_start.html
- https://docs.sealdice.com/advanced/js_api_list.html
- https://docs.sealdice.com/advanced/js_example.html

变量读写能力已于 2026-10-08 核实：`seal.vars.intGet/intSet/strGet/strSet` 返回值、作用域和类型检查遵循官方 API。字符串可保存 JSON。扩展存储 `storageGet/storageSet` 用于全局成就定义目录，不自动按玩家隔离。

## 模块职责

- `src/stats`：读取自定义文案累加的六个 `$m` 变量，发布只读 `globalThis.sealStats`；成功率是 0 到 1，无检定返回 0。`.analyzed` 查询统计。
- `src/achievements`：`globalThis.sealAchievements.register` 登记定义，`record` 记录解锁，`list/info` 查询。`.achivements list [页码]` 和 `.achivements info 名称`。
- `src/rendering`：可选 POST JSON Web API，返回图片 URL；10 秒等待上限及文本回退。请求字段与配置约定见 README。
- `src/index.ts`：只负责组装、注册和发布 API。

其他插件负责成就条件判断、权限及解锁通知；本模块不自动监听检定、不自动解锁成就。当前环境无法从 `onCommandReceived` 得到所需结构化检定结果，`docs/js-coc-check-result.md` 不应作为实现依据。

## 数据与兼容

个人解锁变量 `$manalyzed_achievement_state_v1` 保存版本 2 的 records，兼容旧版 unlocks。目录使用扩展存储 `achievement_catalog_v1`。source + id 稳定且唯一，重复解锁不重复计数。隐藏成就未解锁时，聊天与渲染请求都只能收到占位名称、描述及状态，不能包含来源、ID、真实名称和描述；info 不允许查询未解锁隐藏成就。已解锁后正常展示。

损坏或未知版本数据应报错并保留原数据。hook 保持版本 1 及 record 旧调用契约，register 可以更新定义，记录保存首次解锁时间及快照。命令用当前定义展示；不要将展示文本当 DiceScript 执行。

## 验证

修改 TypeScript 后运行 `npm run check`。覆盖统计查询、目录登记、去重、玩家隔离、隐藏规则、分页、渲染失败回退、迁移与重载。实际海豹中的全局共享、变量作用域、网络请求和图片发送需要运行验证。
