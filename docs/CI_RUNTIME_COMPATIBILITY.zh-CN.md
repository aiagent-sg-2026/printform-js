# CI：Node 24 与固定 Ubuntu runner

## 决策与范围

`.github/workflows/pages.yml` 保留 main push / workflow_dispatch、最小既有权限、串行 Pages 部署和不可取消进行中的 deployment。升级官方 Actions 的运行时及项目构建 Node；不修改发布目录、审批、密钥或业务权限。

- 两个 job 固定 `ubuntu-24.04`，不使用浮动 `ubuntu-latest`。官方计划在 2026-10-19 至 2026-11-19 将 latter 迁移到 Ubuntu 26.04。[1] 固定标签避免 OS、系统库及字体环境未经验收就变化；不表示已认证 Ubuntu 26。
- `node-version: 24` 是 npm/build/test 使用的项目 Node，独立于各 Action 自身的 `runs.using`。本机实际通过 `npx --yes --package=node@24 node --version` 取得 `v24.20.0`。
- 官方 checkout/setup-node/deploy-pages 的所选发布均声明 `runs.using: node24`。upload-pages-artifact 是 composite action；其 v5.0.0 依赖已固定 SHA 的 upload-artifact v7.0.0，该依赖也声明 node24。[2][3][4][5]
- 保留 npm cache 和 lockfile 安装；未增加 registry/token、fork checkout 授权或部署并发。
- 不设置 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 来掩盖旧 Action 元数据。直接选用声明 Node24 的发布；官方已在 2026-09-23 移除 runner 的 Node20，而项目构建 Node 仍由 setup-node 显式选择。[6]

## 已核验的发布契约

| 组件 | 选用发布 | 运行时/要求 |
| --- | --- | --- |
| checkout | v7.0.1 | Node 24；Node24 action 要求 runner >= 2.327.1；Docker 容器内认证 Git 操作另需 >= 2.329.0 |
| setup-node | v7.1.0 | Node 24；项目 Node24、显式 npm cache |
| upload-pages-artifact | v5.0.0 | composite；内部 upload-artifact v7.0.0 为 Node24 |
| deploy-pages | v5.0.1 | Node24；保留 Pages artifact 名称与 page_url output |
| runner | ubuntu-24.04 | 使用 GitHub hosted image，避免 latest 标签自动切换到26 |

这些是研究时 GitHub 官方 release API 返回的完整版本，不是猜测 major tag。版本选择不等于运行成功；真实 workflow 结果才是部署证据。

## 验证方法

1. 本机使用实际 Node24 运行项目 build:site；此脚本包含完整 unit suite、runtime、agent release gate 和 Pages artifact 构建。
2. 本仓库 `github-pages` environment 的 deployment branch policy 经 GitHub API 实读，仅允许 `main`。不为分支测试放宽保护、不尝试已知不允许的非 main deployment；合并前以 Node24 全构建验证实际程序，并核对所选官方 Action 元数据。
3. 使用 `gh run watch <run-id> --exit-status` 等待实际结论。核对 runtime/runner、artifact/deployment 和 job annotations。
4. 合入 main 后观察 main push 触发的真实构建和部署；记录对应 commit/run URL。不同 Node/Ubuntu组合不能共用未经执行的通过结论。

本机 macOS 的 Node24 结果不能代替 hosted Ubuntu24。固定 runner 降低漂移，不取消安全更新；未来迁移 Ubuntu26 必须单独跑相同构建与目标浏览器/PDF 验收。此 CI 当前只运行 build:site 中的 unit suite，不自动执行全部 Playwright journeys。

## 本轮实际 Node24 验证

- `npx --yes --package=node@24 -- npm exec -- node --version`：实际 npm 子进程为 `v24.20.0`，不是只修改 YAML 字符串。
- 首次 Node24 全构建：13 个真实 HTTP boundary 测试失败，原因是全局 JSDOM 的 AbortSignal 与 Node24 native fetch 的 branded AbortSignal 不同 realm；没有 HTTP/事务语义错误证据。该文件是 native server 测试，改用 `@vitest-environment node`，保留2000ms signal timeout、IPv6/token/fault/crash/evidence断言，不移除signal、mock fetch或跳过case。
- 该文件在实际 Node24 **37/37 passed**；随后 `npx --yes --package=node@24 -- npm run build:site` 完整 **222 files / 2,259 tests passed**，runtime/site/agent release gate 和 Pages artifact 构建成功。
- 真实 hosted Ubuntu24 的 checkout SHA、不可变 run URL、job 结果和 annotations 由 GitHub main workflow、PR 验收评论和 KB-MCP verification 元数据记录。本文不预写尚未执行的托管成功结论，也不为记录刚发布的 SHA 再触发第二次源码部署。


## 一手来源

1. [GitHub runner-images #14748：Ubuntu latest 迁移通知](https://github.com/actions/runner-images/issues/14748)。读取于 2026-10-14；以官方滚动迁移时间为准。
2. [checkout v7.0.1 action.yml](https://raw.githubusercontent.com/actions/checkout/v7.0.1/action.yml) 与 [README runner/凭据要求](https://raw.githubusercontent.com/actions/checkout/v7.0.1/README.md)。
3. [setup-node v7.1.0 action.yml](https://raw.githubusercontent.com/actions/setup-node/v7.1.0/action.yml) 与 [README breaking changes/cache](https://raw.githubusercontent.com/actions/setup-node/v7.1.0/README.md)。
4. [upload-pages-artifact v5.0.0 composite](https://raw.githubusercontent.com/actions/upload-pages-artifact/v5.0.0/action.yml) 与 [内部 upload-artifact v7.0.0 runtime](https://raw.githubusercontent.com/actions/upload-artifact/v7.0.0/action.yml)。
5. [deploy-pages v5.0.1 action.yml](https://raw.githubusercontent.com/actions/deploy-pages/v5.0.1/action.yml)。
6. [GitHub：Node20 Actions runtime 弃用与迁移](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)，包含 2026-08-25 更新时间说明；Action runtime 与项目 Node 不能混同。
