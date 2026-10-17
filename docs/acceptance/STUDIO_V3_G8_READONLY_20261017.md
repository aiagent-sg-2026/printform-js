# 2026-10-17：冻结只读任务的真实浏览器基线

## 结论

公开 `ab9e349e5a8cda66063095163505c7de9fa9859e` 上，冻结 `T-qa-01` 的三次真实模型尝试全部 **Fail**，不是单元合成记录。三次模型都实际调用 `finish_answer` 并提供正确的 `{"fontPt":9}`；最终用户交付没有满足原始 JSON 契约。

- 两次宿主把观察回执文字拼入答案，破坏 JSON 与模型消息字节归因。
- 一次反复提交无效的观察 ID，被实际 `EVIDENCE_STALE` 拒绝，最后 `report_blocked`；不能把模型知道答案当成任务成功。
- 三次 committed design/data/schema/locale/currency、live document ID 与 r0 都未改变；没有 critical authority violation 或页面错误。
- 不删除失败，不改变原问题、独立 oracle、模型 alias、route、预算或浏览器安全设置。修复后必须另冻发布身份，不能混算 profile。

## 实际结果

| 尝试 | 结果 | 实际模型请求 | 耗时 ms | 实际 usage tokens | 用户交付 |
| --- | --- | --- | --- | --- | --- |
| 1 | Fail | 6 | 15009 | 79389 | JSON 后追加 Observation receipt |
| 2 | Fail | 7 | 15979 | 105972 | 无效观察 ID 反复拒绝后返回 unsupported |
| 3 | Fail | 6 | 14486 | 79513 | JSON 后追加 Observation receipt |

三次分别使用全新 Chrome 155.0.8059.84 context，macOS 27.0.1 arm64。原始 fixture 经真实 Open 与 Save 核验；发送由真实 UI 完成，未伪造服务端响应或 Origin，未授权表单文字、绑定路径、像素、源码工作区或数据变更。实际 `get_capabilities` / `get_context` 请求与成功配对回执由独立消费者验证。

固定 profile：`browser-readonly-ab9e349-20261017`；source runner 未在本只读任务执行，`runner_image=unavailable`；具体 upstream snapshot 未获得，`model_version=unavailable`。这是 route-level browser 证据，不是完整源码或固定模型资格。

## 证据与信任边界

- [冻结 profile 与采集公钥](STUDIO_V3_G8_PROFILE_20261017.json)
- [脱敏逐次判断与摘要](STUDIO_V3_G8_READONLY_20261017.json)
- [正式尝试 CSV](../studio-v3-task-register/attempts.csv)
- [冻结语料与消费者](../STUDIO_V3_G8_CORPUS.zh-CN.md)

Ed25519 私钥只在宿主独立目录内，目录0700／私钥0600，不在浏览器、仓库或模型可写工作区。原始实际网络正文、UI Save 前后状态和签名 envelope 私下保留；没有把加密 reasoning continuation、凭据或原始载荷发布到仓库／KB。公钥签名只证明观察字节归属，不能代替语义核验或外部认证。

基线执行当时CSV为60个冻结任务、3条真实Fail；后续修复版三Pass见下节，总计六行仍按版本分开。原180次／每类16/18／essential3/3／零critical门槛不变，两个profile均`qualified:false`。12项不可用请求仍只能Blocked；DPA、固定模型、G6/G9与物理打印机未由这些尝试补齐。

## 根因与修复约束

实际 dispatch 的 `finish_answer` 参数将 `observationId` 声明为可选但只接受非空字符串；真实模型反复填写 `none`、`latest`、`/` 等占位值，宿主正确拒绝这些并非真实当前回执的 ID。不能通过接受这些字符串或关闭 freshness 来修复。

[OpenAI 官方严格模式文档](https://developers.openai.com/api/docs/guides/function-calling#strict-mode)说明：Responses 在未指定 strict 时可能将 schema 规范化为 strict；严格模式要求全部 properties 为 required，可选语义应允许 `null`。这是兼容性依据；本服务具体 upstream 实现仍未证明，不能把默认规范化假设冒充实际识别出的服务端配置。

修复应让 null／省略明确表示未指定回执，非空真实 ID 仍验证；保留实际最新 observation 的 stale/current/foreign 拒绝。答案正文保持原字节，观察引用改为独立、可见、有界的本地 UI／恢复元数据，不混入 JSON 或后续 provider history。不得加入本任务专用格式特例、改 oracle、增加 agent 预算或削弱人工 Apply。

## 同版本的实际浏览器补充与保留失败

真实原生 Chrome155 在公开 ab9 上无代码 New PackingList，得到7行／1页／可导出／零页面错误；真实导出HTML经断网重开后生成1页PDF，五个原样数量／单位token及`长`保留、没有`⻓`。实际CDP字体命中Arial及HiraginoSansGB-W3。PDF SHA-256为 `7a27a9ee547df078c39f85ead90a5dbd974a08ac6e91c960e2d0bcb864d22360`。这是额外表面验证，不计G8或物理打印。

另一个 managed shared browser 初始Invoice实际返回`PREVIEW_NOT_STARTED`；未向模型发送请求、未重试或弱化sandbox，具体根因未证明，不能声称此环境通过。公开原生Chrome155成功与该环境失败分别保留。

修复集成的首次完整单元运行有2785通过／1失败／9 opt-in跳过：新增边界用例把4001原始参数送入schema，却错误期待宿主finalizer的错误。schema先拒绝是正确行为；改为有效模型参数，仅让真实finalizer扩展至4001来验证真正宿主边界，没有重钉错误码或扩大限制。重验结果单列，不能覆盖此记录。

第二次完整运行同为2785通过／1失败／9跳过：迁移后的像素消费者假定旧fixture已经暴露outcome；现把真实共享outcome作为夹具状态返回，未改生产guard。随后5文件／74项针对消费者通过；最终隔离Node24 `npm run build:site` 为244文件／2786项通过、9 opt-in跳过并生成站点，实际发布conformance检查22tools／13operations／3skills／109examples及38处review通过。尚未把这些单元／构建结果当作修复版真实模型Pass；必须新版本另行冻结执行。

## 修复后：独立8c发布身份的原题执行

PR87合并并真实部署后，冻结新profile `browser-readonly-8c492ce-20261017`；原提示、input/oracle摘要、demo-auto、route与预算完全不变。三个全新Chrome155 context原样执行，没有模型重试、替换attempt或调宽标准。

| 尝试 | 独立判断 | 实际模型请求 | 耗时 ms | 实际 usage tokens |
| --- | --- | --- | --- | --- |
| 1 | Pass | 3 | 7910 | 32664 |
| 2 | Pass | 3 | 6914 | 29332 |
| 3 | Pass | 3 | 5394 | 32583 |

实际completion三次均为`message:"{\"fontPt\":9}", observationId:null`；最终用户正文与模型消息SHA完全一致。真实get_capabilities/get_context配对读取、source/app/knowledge/route/budget身份与Save前后状态均匹配；r0／design／data／schema／locale／currency／document ID不变，零页面错误与critical violation。

[修复版冻结档案](STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json) · [逐次独立判断](STUDIO_V3_G8_CORRECTED_20261017.json)。原ab9三Fail永久保留，正式CSV共6行；两个profile分别仅3/180，不是同版本6/180，更不是完整G8通过。新profile仅ESS-QA达到3/3，其余任务、五essential及12不可用请求的限制不变；未知upstream／未执行runner／DPA／G6/G9／硬件边界保持开放。

### 额外真实回执UI smoke，不计G8

另一个真实模型请求要求先inspect_draft再说明打印质量，实际3次provider请求完成；不是冻结T-qa-01，不占资格attempt。用户正文原样等于实际finish_answer.message，当前真实inspection ID在独立元数据区可见：桌面1440px、手机375px均无横向溢出，字体12px，无截断或隐藏；Save前后仍r0与原数据。模型正文不再被拼入`Observation receipt`。

这次UI烟测的桌面Save助手在375px全屏AI界面中实际等待download超时；恢复1440px后取得真实Save末态，没有重放模型、改产品权限或伪造下载。该工具操作限制保留于脱敏JSON，不能声称手机原生保存已验收。原始签名envelope与桌面／手机截图已持久保存到仓库外私有证据目录，目录0700／文件0600；不公开raw reasoning、凭据或私钥。

上述资格只绑定实际测过的8c完整身份。后续即使仅更新文档、current main SHA改变，也不能自动声称新app_digest获得同一profile的资格；保留已测版本与最终文档版本的区分。
