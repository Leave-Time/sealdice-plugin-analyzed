# 成就统计

基于 [sealdice-js-ext-template](https://github.com/sealdice/sealdice-js-ext-template) 的海豹 JS 扩展。

## 安装

在 SealDice 中通过扩展商店安装本包，或在 WebUI 中加载 `dist/sealdice-js-ext.js` 单文件版本。

## 使用

发送 `.achivements` 查看自己的成就统计，使用 `.achivements 2` 翻页。

其他插件自行判断成就条件，通过 `globalThis.sealAchievements.record(ctx, { source, id, name, description })` 登记完成的成就。本模块负责存储与去重，通知由调用方处理。
