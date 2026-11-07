# Changelog

## 1.1.1 — npm 首发

- 发布到 npm：`dsh-plugin-shelf`（`npm i dsh-plugin-shelf`，或 `plugin_manager install_bundle target=dsh-plugin-shelf`）。
- 与 1.1.0 内容一致，仅版本号不同：1.1.0 是注册表处理首个 PUT 时的镜像版本，1.1.1 是 `latest`。

## 1.1.0

- 一键更新：自动更新卡片右侧「一键更新（N）」，两次点击确认（4 秒内点第二下才执行），批量检查并逐个 `removeBundle → installBundle`，完成后给出「成功/总数 · 排队 · 失败」汇总卡（可 ✕ 关闭）。
- 中断横幅可关闭：「✕ 关闭（不删除记录）」按 `名字@目标版本:阶段` 记账，同一插件换了目标版本或阶段会重新提示；「清理记录」只删记录不动插件。
- 中断横幅对 `incompatible-version` 给出明确结论（重试无意义，需装匹配版本），不再让人反复点「重试安装」。
- host `saveState` 改为深合并：部分字段写入不会清空分组、排序与自动更新配置（数组整体替换）。
- 新增 `pendingSeen` / `filter` / `ungroupedName` / `ungroupedCollapsed` 的服务端持久化。

## 1.0.0

- 首个可用版本：已安装插件列表（名称、版本、磁盘占用、安装时间、入口数）。
- 排序：名称 / 安装时间 / 大小，升降序切换；搜索。
- 分组：新建、行内重命名、上下移序、折叠、删除；插件行内下拉移动；「+ 加插件」浮窗勾选加入（自动从原分组移出）。
- 未分组：可重命名、可折叠。
- 一键启停：单插件开关、分组「启用本组 / 停用本组」、顶部「全部启用 / 全部停用」。
- 筛选：状态（全部/已启用/已停用）、分组、只看可更新，与搜索叠加。
- 自动更新：按 npm registry 的 `dist-tags.latest` 探测版本（不用 `pluginManager.inspect`，它对已安装包一律拒绝），可只检查、可自动安装、可限定分组、可改 registry 地址。
- 更新可靠性：`removeBundle → installBundle` + journal（`pending-updates.json`）断点续装、失败自动回滚到原版本、`bundle-in-use` 时排队到下次启动修复、`pendingBuilds` 需放行的场景支持「批准并重试」。
