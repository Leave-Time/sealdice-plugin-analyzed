# 检定统计与成就

基于 [sealdice-js-ext-template](https://github.com/sealdice/sealdice-js-ext-template) 的海豹 JS 扩展。

## 安装

在 SealDice 中通过扩展商店安装本包，或在 WebUI 中加载 `dist/sealdice-js-ext.js` 单文件版本。

## 使用

发送 `.analyzed` 查看检定统计；`.achivements list` 查看所有成就，`.achivements info 名称` 查询详情。

其他插件通过 `globalThis.sealStats` 查询检定数据。通过 `globalThis.sealAchievements.register` 登记成就定义，`record` 记录解锁；支持隐藏成就。在扩展配置的“成就”分组将 `成就渲染方式` 设为 `图片`，再填写 `成就渲染API` 地址即可接入图片服务；默认使用文字。接口及调用示例见项目 README。
