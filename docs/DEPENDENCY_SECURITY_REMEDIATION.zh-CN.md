# 依赖安全修复与验收边界

审查日期：2026-10-14。此文记录本轮选项 A，不是全仓库或线上系统安全认证。

## 问题与决定

原 `npm audit --json` 报告 4 个受影响 package：1 moderate、1 high、2 critical。它们对应四个 advisory；同一 advisory 可经依赖传播，package 数不是独立漏洞数。

| Advisory | 原依赖与条件 | 本轮处理 |
| --- | --- | --- |
| GHSA-82fw-gwwq-j7x9 | Vitest / @vitest/mocker 3.2.7；redirect mock 未校验 Vite 文件访问边界。公开 mocker plugin 的可达 HMR socket 与带 token 的 Vitest browser RPC 条件不同 | Vitest 与 mocker 升为官方修复 4.1.11；旧 3.x 不提供该补丁 |
| GHSA-68fv-2mgg-jv7q | source-map-js 1.2.1；不可信 indexed source-map offset 可放大同步计算与内存 | 在所有现有兼容 semver 范围内更新锁文件至 1.2.2；不新增直接依赖或 override |
| GHSA-5gmw-xhrv-c9v3 | tinypool 1.1.1 的 Worker options 可将已污染的 inherited execArgv/env 变为 own option | Vitest4 已移除 tinypool，完整依赖树不再包含该包 |
| GHSA-85c8-ppgw-ccpr | tinypool run options 的 inherited filename 可重定向 worker；前提包括上游 prototype-pollution primitive 与传入 options | 同上，删除过时 worker-pool 依赖路径；不强行跨 major override tinypool |

选最小已修复的 Vitest4.1.11，而非跳到5.x或降级到 audit 自动建议的2.0.5。现有 Node >=22.19.0 和 Vite8.1.5 满足其实际 package engines/dependency 范围。保留原测试目录、worker串行策略、timeout和业务断言。

未使用 `npm audit fix --force`、`--legacy-peer-deps`、advisory忽略名单或移除测试来取得绿灯。

## 实际依赖与原始缺陷 smoke

- Node24/npm11 安装并更新兼容 source-map-js 后，`npm audit --json` 返回 vulnerabilities 空对象、total **0**。
- `npm ls vitest @vitest/mocker source-map-js tinypool`：Vitest4.1.11、mocker4.1.11、source-map-js1.2.2；tinypool不在安装树中。
- 真正调用两版本 SourceMapConsumer：原1.2.1接受 indexed offset.line=10,000,001；修复1.2.2立即拒绝 `must not exceed`。没有执行旧版本的巨大序列化循环或挂死进程。
- 合法 offset.line=2 的映射仍将 generated line3/column1 定位到 `erp.js` original line1/column0。检查的是实际调用结果，不是 package 字符串或源码比对。
- 实际 Node24/npm11 `npm run build:site`：Vitest4.1.11 **222 files / 2,259 tests passed**；runtime、agent release gate、preview与site实际构建完成。没有为major升级修改测试实现、缩小测试范围或提高timeout。
- 初次本机 Node23/npm10安装遇到 npm Arborist peer-set `edgesOut` TypeError；改用受支持的实际 Node24/npm11完成依赖解析，没有关闭peer检查、删除锁文件或改业务代码。

## 安全与发布界限

- audit0只代表该时点 registry 已知 advisory 与当前锁定树；不证明没有未知漏洞、所有dev-server配置安全或真实ERP数据已获授权。
- 原 tinypool advisory 要求可利用的上游 prototype pollution；本轮没有捏造本仓库远程RCE利用链。
- source-map-js 是 jsdom/css-tree 与 Vite/postcss 的传递依赖，不把此问题表述为打印金额或ERP账务错误。
- dependency-only cutover不修改金额/分页/会计契约；现有 build:site 包含完整unit suite与实际runtime/site构建。托管main run/SHA/job/annotations记录于GitHub PR验收评论及KB-MCP verification，不用本机结果冒充Linux。
- 依赖 install-script提示、模块类型及第三方browser externalization、官方deploy action弃用日志不是这四项advisory的同义词；不隐藏这些日志。

## 一手来源

1. [Vitest官方redirect mock advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)：4.1.11补丁、旧major不维护、公开plugin与authenticated RPC前提。
2. [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) 与 [官方修复commit](https://github.com/7rulnik/source-map-js/commit/cf7658058ceeaa8619d5ae0ec90be6905209d016)：offset整数、上限、nested合计与线性处理。
3. [tinypool Worker options advisory](https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3)。
4. [tinypool run options advisory](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr)。
5. [Vitest4官方迁移说明](https://v4.vitest.dev/guide/migration.html)：mock、Module Runner与配置变化；具体版本约束另外通过npm官方registry metadata核验。
