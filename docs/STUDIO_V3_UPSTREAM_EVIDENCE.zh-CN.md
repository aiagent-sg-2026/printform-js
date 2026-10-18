# 固定 upstream：服务方原件、逐请求归属与离线消费者

本页是资格证据消费者说明，不是新 provider runtime 或生产批准。复用原 G8 的 canonical JSON、Ed25519 collector envelope、显式路径/原始字节摘要 inventory；未改 alias、route、预算、sandbox、冻结 60 题/20 holdout、历史六次 attempt 或任何原门槛。真实数据 DPA 仍是独立前置条件。

## 本次实际观察

2026-10-18T05:28:26.679Z，在不提交 inference 请求的情况下，读取仓库现有 gateway 配置及其 `/demo/v1/models` 安全能力元数据：

- 仓库配置仍是 `https://gpt.yapweijun1996.com/demo/v1`、默认 `demo-auto`；本切片没有改服务配置。
- 无认证 GET `/demo/v1/models` 返回 HTTP 401。未带公开页面 Origin 的 session 请求返回 403；按现有公开页面 Origin `https://yapweijun1996.github.io` 请求后，session 为 201、models 为 200。session 值只在内存传递，未打印、保存或写入文档。
- 实际发现六个 alias：`demo-fast`、`demo-auto`、`demo-openai-mini`、`demo-openai-quality`、`demo-groq`、`demo-gemini`。
- 六条均没有字符串 `provider`、`model_version`、`snapshot`、`signature` 字段，也没有 `fallback` 字段。能力标志或 alias 名称不能证明底层 provider、不可变模型版本、fallback 策略或服务方签名。
- inference 请求 **0**。没有读取模型 reasoning、私有 wire、服务日志或凭证值。未尝试换 alias 获取绿灯。

随后实际执行：

```sh
node scripts/studio-v3-g8.mjs upstream \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json
```

观测退出码 **1**；`offline:true`、`modelCalls:0`、`attemptsWritten:0`、`status:missing`、`verified:false`、`productionQualified:false`。具体缺项：

1. 缺恰好一份显式索引的 fixed-upstream 服务方证明；
2. 缺服务方签名 snapshot、owner-key 来源原件及 dispatch attribution 原件；
3. 原冻结 profile 的 `model_version` 仍为 `unavailable`，只能证明 route-level 行为。

命令还出现既有 Node `MODULE_TYPELESS_PACKAGE_JSON` warning；未为隐藏 warning 改 package 类型。本次没有补造 owner 签名、请求 receipt、生产同意或新冻结身份；真实固定模型资格**仍未取得**。原 profile 不能事后改写来继承旧 Pass。

## 新 CLI 与现有预检的关系

```sh
node scripts/studio-v3-g8.mjs upstream PROFILE_JSON [EVIDENCE_INDEX_JSON]
node scripts/studio-v3-g8.mjs preflight PROFILE_JSON [EVIDENCE_INDEX_JSON]
```

两个命令调用同一个消费者。`upstream` 只输出 fixed-upstream 的脱敏报告；签名、原件和所有已索引请求归属验真成功才退出 0。该退出码只表示**证据完整性/身份/归属校验**，不表示任务成功、180 次执行、当前生产流量、DPA 或 G9 已通过。

`preflight` 无论该项验真成功与否，仍保留 `prerequisite-fixed-upstream` 的独立审查 blocker；成功状态叫 `verified-for-independent-review`，不是 approved。其它 prerequisite 文档仍沿用 `supplied-for-independent-review`。本切片不会凭 JSON 关闭生产 gate。

## 索引和签名格式

继续使用 `studio-g8-preflight-index-v1` 的 `prerequisites`：恰好一项 `{id:"fixed-upstream",path,digest}`，digest 是文件**原始 bytes** 的 `sha256:` + 64hex。请求 envelope 仍放在同一个索引的 `envelopes`；不能只提供一张 standalone approved JSON。fixed-upstream 证明路径须在索引目录下；其 artifacts 路径相对于**证明 envelope 所在目录**。消费者不扫描目录。

证明外层仍为 `{evidence,signature}`：

- `signature`：既有 frozen profile 的 `collectorPublicKey` 对 `canonical(evidence)` 的 Ed25519/base64 签名；模型、源码工作区或随 JSON 附送的新 collector key 不能替代它。
- `evidence.schema`：`studio-upstream-evidence-v1`。
- `profileDigest`、`identity`、`releaseIdentity`：必须逐字匹配完整冻结 profile 摘要、八项执行身份及完整 release 身份。原 profile 自身也必须通过既有校验。
- `ownerPublicKey`：服务方 Ed25519 公钥。
- `ownerSignature`：该 key 对 `canonical(statement)` 的 Ed25519/base64 签名。
- `statement.schema`：`studio-upstream-owner-statement-v1`；包括 `issuedAt`、`expiresAt`、`snapshot`、`dispatches`、`artifacts`。所有时间为 Unix 毫秒整数。

签名复用既有 custody 信任模型，不是自动证明互联网服务真实。独立 collector 必须先从实际服务方核实 owner-key 来源及原件来源，再签署。软件检查该绑定的完整性与内容一致性；无 owner 证明时不能由本助手签一份自述来代替。即使密钥持有者签了假话，密码学也不能使其成为真实观察，因此保留独立审查 blocker。

### 固定路由 snapshot

`snapshot` 必须包含：

| 字段 | 校验 |
| --- | --- |
| `route` / `alias` | 等于 frozen `provider_route` / `modelAlias`；route 为无凭证/query/fragment 的 HTTPS URL |
| `provider` / `model` | 服务方实际明确名称，不得 unknown/unavailable/auto/default 等占位 |
| `modelVersion` | 等于 frozen `model_version`，且不得 unknown 等占位 |
| `snapshotId` / `configurationRevision` | 服务方实际不可变 snapshot 和配置修订标识，不得占位 |
| `fallbackPolicy` / `fallbacks` | 必须为 `disabled` / `[]`；不把未知或动态 fallback 当固定模型 |

`issuedAt <= 当前时间 < expiresAt`，且失效时间须晚于签发时间。原件 capture 和请求 dispatch 也必须在同一有效期内。时间来自已签服务方声明；消费者不臆造有效期或把过期材料视作新鲜证明。

### 三类实质原件

`artifacts` 每项为 `{kind,path,digest,sourceUrl,capturedAt}`。证明和原件只读受限普通文件：拒绝绝对路径、遍历、反斜杠、符号链接、非普通文件及多硬链接；路径每段须为 ASCII 安全名称。每份 JSON 最多沿用既有 `JSON_DATA_LIMITS.maxBytes`（2 MiB），最多三份 source 原件；打开前检查类型/大小，读取前核对路径组件与 descriptor inode，读取后核对大小/mtime/ctime 与路径身份，变动拒绝。严格 UTF-8 解码，并复用 `parseLosslessRecords` 拒绝 duplicate/prototype/depth/node 异常，再按签名数据类型解析；不接受 replacement-character 或 last-key-wins 歧义。`sourceUrl` 必须是 route 同源、具体非根路径的 HTTPS 服务方文档 URL，禁止凭证/query/fragment；它是已签来源定位符，不是自动网络抓取或独立真实性证明。

需要以下全部原件，不能用任意标题/status/`qualified:true` 替代：

1. `owner-authorization`：内容为 `schema:"studio-upstream-owner-authorization-v1"`、实际 `ownerId`、route 的 `origin`、`publicKeyDigest:digest(ownerPublicKey)` 以及完全相同的 `issuedAt/expiresAt`。独立 collector 的外层签名保护此 owner-key 来源绑定。
2. `route-snapshot`：内容为 `schema:"studio-upstream-route-snapshot-v1"` 与 `snapshot`；后者须与签名 statement 的固定配置完整一致。
3. `dispatch-attribution`：内容为 `schema:"studio-upstream-dispatch-attribution-v1"` 与 `dispatches`；数组须与签名 statement 完整一致。

三类各一份；重复 kind、缺文件、摘要不符、捕获时间越界、非同源定位符或只有标题/status 都拒绝。原件应只包含必要配置和归属元数据，**不要索引 token、认证头、私钥、reasoning 或无关资料**。

### 逐请求归属

先沿用原库存消费者检查请求 envelope 的签名、冻结身份、登记 row/digest/duration/usage/outcome 与独立 oracle；不把失败任务冒充 Pass。upstream 归属校验不要求任务必须 Pass：真实失败同样需要准确归属。

`dispatches` 对 selected profile 每个已索引 envelope 的每个 `providerBodies` 项恰好覆盖一次：

- `evidenceDigest`：`digest(envelope.evidence)`；`requestIndex`：providerBodies 的零基下标。
- `runId`：该实际执行 run；`requestId`：服务方唯一且不重复的请求 ID。
- `requestDigest`：匹配该 provider body 的摘要及其实际 body bytes；`responseDigest`：匹配对应 `providerResponses` 的实际 response body 摘要。
- `dispatchedAt`：位于对应执行 `startedAt..endedAt`、owner 有效期及当前时间之前。
- `snapshotDigest`：`digest(snapshot)`；`route/alias/provider/model/modelVersion/snapshotId`：逐项与固定 snapshot 完全一致；`fallbackUsed` 必须是 false。

缺一个请求、额外/重复归属、重复 requestId、错 run/response 摘要、未知 provider/model 或 fallback 均 fail closed。输出仅含请求数量、归属数量、状态及错误，不输出原始请求/响应、owner 公钥、签名、requestId 或原件内容。覆盖范围只限**显式索引**的观察，不推论未索引请求、未来流量或当前生产服务。

## 集成验证实录

2026-10-18，在隔离源码快照运行七个相关测试文件：首次 **231 Pass／2 Fail**，失败均为正向合成 fixture 的 Pass row 缺少既有 register 必填 `oracle_result`，消费者正确拒绝该记录。补齐合成 oracle 记录并增加 register／envelope 错误断言后，仅复验受影响文件：**17／17 Pass**。未放宽 gate、签名、路径或正式登记条件；首次失败记录保留。

同一快照实际执行上述 `upstream` 和原 `preflight`：均退出 1；后者 **31 blockers／qualified:false**，两者均 `modelCalls:0`、`attemptsWritten:0`。冻结 tasks、attempts 及十份 corpus 文件前后字节摘要一致。KB 可检索的 gateway 源码知识说明历史上支持动态 provider 选择及 fallback，但只是源码快照，不能代替当前固定 upstream 的服务方原件或真实 DPA。生产资格仍未取得。

复验入口：

```sh
npx vitest run tests/studio-v3-upstream-evidence.test.js \
  tests/studio-v3-g8-preflight.test.js tests/studio-v3-g8-corpus.test.js \
  tests/studio-v3-g8-answer.test.js tests/studio-v3-g8-geometry.test.js \
  tests/studio-v3-task-register.test.js
node scripts/studio-v3-g8.mjs upstream \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json
node scripts/studio-v3-g8.mjs preflight \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json
```

新增测试只使用隔离临时文件和合成 key/receipt，检验消费者 valid/tamper/identity/expiry/缺 attribution/错归属/fallback/伪审批文档/双签名/畸形输入/CLI，以及恶意绝对/遍历路径、文件/目录 symlink、超限文件、duplicate JSON、非 UTF-8、读取前 inode 置换、读取中增长和 envelope-relative 路径行为；不提交模型请求、不写正式 register，不把合成结果写成真实服务资格。
