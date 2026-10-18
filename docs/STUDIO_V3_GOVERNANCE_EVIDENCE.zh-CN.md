# 真实资料治理：有来源的离线审查材料消费者

本页说明 `scripts/studio-v3-governance-evidence.mjs`、G8 inventory／preflight 与 `governance` CLI 的实际接口。它不是 DPA 签署工具、法务意见、provider runtime 或新的生产批准机制。浏览器优先通用文档产品同样可能处理联系人、参考图、客户文档与保密文本；本机制不以 ERP 为适用前提。

## 实际缺口与资料边界

原 `data-governance` prerequisite 只核对任意文件 bytes/digest，然后标为 `supplied-for-independent-review`。标题为 DPA、`qualified:true` 或一段厂商“不用于训练”的文字，都没有说明**哪个运营主体、哪个租户、哪条实际 route/provider/model、哪类资料与哪个目的**受其约束，更没有核对备份／日志、适用合同、披露权限或负责审查的人。

本切片检查既有 upstream／inventory／preflight 实现及对应说明，并在可见 KB 跨库搜索实际 operator/tenant 已签 DPA、披露授权和固定路由证据（search events **143992、143993**）。返回的是 gateway 目标、旧配置、部署／迁移记录等，不是适用已签协议；**这两次检索没有找到可提交的实际协议原件，不等于证明任何地方都不存在协议**。历史动态 routing/fallback 源码快照和部署备份记录，也不能成为当前租户的合同或当前 dispatch 证明。本切片不访问私有 wire、reasoning、凭证值、服务日志或真实备份，不发付费 inference、不变更 gateway。

### 官方原始依据（2026-10-19 查阅）

- [OpenAI API Data controls](https://developers.openai.com/api/docs/guides/your-data)：默认 API 不用于训练，**不等于没有 abuse monitoring logs 或 application state**；特殊保留控制需要批准且受 endpoint／feature 限制，第三方服务有自己的政策。驻留也区分存储、处理及系统资料。不能从 alias、`store:false` 或一个地区域名推导整个 gateway 链路零保留。
- [OpenAI DPA](https://openai.com/policies/data-processing-addendum/)：当前页面写明 2026-01-01 生效；§1／§2.1 说明客户、服务、书面指令与配置的关系；§2.3 保密、§2.9 分包、§2.11 终止后删除及法定保留例外；§3.1 客户仍须具备通知／权利／授权，§3.3 客户负责适当配置。公开通用文本本身不是本 demo gateway/operator/tenant 已适用的协议证明。
- [OpenAI Sub-processor list](https://openai.com/policies/sub-processor-list/)：本次页面标注 2026-10-14 更新，按产品／服务、实体、处理地点与目的列出条目，且有 ZDR／客户选择等适用条件。列表中的**可能地点**不能冒充某租户实际使用的国家；也不能据此证明未知 upstream 就是 OpenAI。
- [新加坡 PDPC《Key Concepts》官方指引（2021-10-01 修订）](https://www.pdpc.gov.sg/-/media/Files/PDPC/PDF-Files/Advisory-Guidelines/AG-on-Key-Concepts/Advisory-Guidelines-on-Key-Concepts-in-the-PDPA-1-Oct-2021.pdf?la=en)：§18.1–18.4／18.11 区分目的结束、法律／业务需要、归档仍保留；没有统一固定保留天数。§19 说明跨境转移责任，§21 说明负责人与政策落实。这里只取控制设计理由，**不推定 PDPA 或某厂商条款必然管辖每个租户**。

因此消费者没有内置“30 天即合规”等法律阈值，不给真实资料自动授权；实际适用性、完整法律义务和披露权仍由独立负责者判断。

## CLI：与 upstream 相同的只读约定

```sh
node scripts/studio-v3-g8.mjs governance PROFILE_JSON [EVIDENCE_INDEX_JSON]
node scripts/studio-v3-g8.mjs preflight PROFILE_JSON [EVIDENCE_INDEX_JSON]
```

例如仅用仓库已有公开 profile 清点缺证：

```sh
node scripts/studio-v3-g8.mjs governance \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json
```

`governance` 输出 `schema:"studio-governance-check-v1"`、`offline:true`、`modelCalls:0`、`attemptsWritten:0`，以及同一次 preflight 的 data-governance 项。合法有界材料完整且一致才退出 **0**，状态为 `structured-for-independent-review`、`verification.reviewable:true`。退出 **1** 表示缺失或无效，不是请求模型补造材料。

| 状态 | 含义 |
| --- | --- |
| `missing` | 没有索引 data-governance 声明，且没有无效 inventory／profile 输入 |
| `invalid` | 有声明但缺原件／字段／引文，签名或字节篡改、范围不符、已失效、畸形／危险输入；无效 index 也不是“缺证但有效” |
| `structured-for-independent-review` | 精确身份、collector custody、来源字节及全部标量引文相符，**仅可进入独立审查** |

全部状态始终 `productionQualified:false`、`authorityVerified:false`。`preflight` 始终保留 **`prerequisite-data-governance` blocker**；不更改 G6/G7/G8/G9、原 180 槽、冻结 corpus／attempts、模型／alias／route、预算、sandbox 或 oracle。没有新证据时仍拒绝原完整资格，不迁移历史 Pass。`fixed-upstream` 仍独立核验，治理材料不证明当前请求的实际 upstream。

## 索引与精确适用范围

沿用 `studio-g8-preflight-index-v1`，新增可选 `governanceScope`。只有要提交治理材料时才需要该字段；不扫描目录，不猜适用主体。

- `prerequisites` 中恰好一项 `{id:"data-governance",path,digest}`；digest 为声明文件**原始 bytes** 的 `sha256:`＋64 位小写十六进制。
- `governanceScope` 必须与签名 `statement.scope` 整体相等，恰好以下八个非空字段：`operatorId`、`operatorLegalName`、`tenantId`、`tenantLegalName`、`route`、`provider`、`model`、`modelVersion`。provider 是明确的实际服务／合同主体，不是 demo alias；不接受 unknown/unavailable/default 等占位。运营方／租户不能只用供应商名称替代。
- `route` 必须等于 frozen `identity.provider_route`，且为具体非根 HTTPS 路径，无 URL credentials/query/fragment；`modelVersion` 必须等于 frozen `identity.model_version` 且已知。声明 provider/model 不得用 frozen modelAlias 或 demo provider alias 代替。
- `governanceScope` 是操作者**显式选择的审查目标**，不是新信任根或生产许可。不能单靠把 index 和声明一起改成另一个租户来证明原租户已授权；原件及独立审查仍必需。

### 有意的安全 cutover

CLI 的顶层 `PROFILE_JSON`、`EVIDENCE_INDEX_JSON` 仍可使用操作者显式选择的绝对路径。**索引内部** profiles/envelopes/liveRelease/prerequisites 全部改为复用 upstream 的 `readUpstreamFile` 与严格 JSON parser：只允许 index 目录内的安全相对路径。旧绝对／`..`／反斜杠／空路径段引用现在拒绝，没有兼容 shim；应把授权档案组成有界目录后显式索引，不能以旧遍历能力访问宿主机文件。

声明中的 source 路径相对于**声明 envelope 所在目录**，不是 index 目录。文件须为单硬链接、非 symlink 普通文件；每份最多沿用 `JSON_DATA_LIMITS.maxBytes`（2 MiB）。复用组件 lstat、`O_NOFOLLOW`、descriptor inode、读取前后大小／mtime／ctime 与路径 custody 校验，不在大小检查前分配文件内容。JSON 使用严格 UTF-8／lossless 预检，拒绝重复键、prototype/depth/node 异常；不按 last-key-wins 解读签名资料。

索引还执行独立于 G8 资格门槛的**批次资源准入**：最多8个profiles、1440个envelopes（8×原180槽）、24个prerequisites。profile／envelope不得重复path，prerequisite不得重复ID；不同需求可以显式引用同一份复合审查原件，每次仍独立扣账并验证对应语义，不因此获得批准。集合超限或重复执行／需求引用在打开任何引用目标前拒绝整个索引，不静默截断；分批检查不能拼成生产批准，原180/profile分母不变。

每次 `readInventory` 共享固定 **512 MiB** 累计读取预算（256 × 既有 2 MiB 文件上限），包括 index、profile/envelope/liveRelease/prerequisite 以及嵌套 upstream／governance 原件。shared reader 在安全 lstat/type/size 检查后、目标 open／Buffer 分配前以已检查大小扣账；超预算抛 `INVENTORY_BYTE_LIMIT`，失败读取不退账。集合符合数量上限但总 bytes 超限仍明确失败，不能靠多个别名或文件副本放大内存。顶层 CLI selected profile 另受同一个 2 MiB 单文件上限。此资源限制不是更改 corpus／attempts／G8 门槛。

## 声明 envelope 与 API

外层 `{evidence,signature}`：`signature` 复用 frozen profile `collectorPublicKey` 对 `canonical(evidence)` 的 Ed25519/base64 签名。随包自带的新 key 不能替代它。

`evidence`：

- `schema:"studio-governance-evidence-v1"`；
- `profileDigest:digest(profile)`、`identity`、`releaseIdentity` 与完整冻结 profile 精确一致；profile 自身也须通过既有 preflight 校验；
- `statement` 的 schema 为 `studio-governance-statement-v1`，包含 `issuedAt`、`expiresAt`、`scope`、`controls`、`contract`、`review`、`artifacts`、`citations`。

时间均为非负 Unix 毫秒整数（日期字段除外），`issuedAt <= now < expiresAt`。API `readGovernanceArtifacts(bytes,base,readFile=readUpstreamFile)` 只加载显式来源，返回供进程内消费的 `{envelope,artifacts}`；inventory 给它及 upstream reader 传入共享累计预算的 reader。底层 `readUpstreamFile(base,relative,chargeBytes?)` 仅新增可选的 pre-open 大小扣账回调；`INVENTORY_LIMITS` 导出固定批次上限，`createInventoryByteBudget()` 返回无缓存的累计扣账函数。`verifyGovernance({profile,inventory,profileValidation=[],now=Date.now()})` 返回脱敏状态、固定 false 的权限字段、`errors`、`sourceCount`、`checkedClaims`。`now` 可由确定性回归注入；CLI 使用系统时间，不提供绕过到期参数。

inventory 用不可枚举属性保存已加载 `governance` 和 `governanceScope`，不会在报告中展开协议／原件／引文／reviewer／签名／公钥。报告仍有显式索引的 path/digest 元数据，因此索引名称也不要携带秘密。

### controls 必填内容

| 字段 | 有界要求 |
| --- | --- |
| `dataClasses` | 1–32 个明确资料类别，无重复，不以“所有资料”或空列表替代具体范围 |
| `purpose` / `confidentiality` | 明确处理目的及保密安排，不得空白／unknown |
| `training` | `{operator,provider,conditions}`；双方分别明确 `not-used`、`opt-in` 或 `used`，并说明条件；如实记载使用不等于批准使用，结构成功也不表示 opt-in 已获合法同意 |
| `countries` | `{operator:[...],provider:[...]}`，各为实际 ISO 3166-1 两字母国家／地区代码；拒绝 EU/global 等模糊地区／占位 |
| `retention` | 恰好六项：operator/provider × application-state/abuse-logs/backups，不得重复；每项 `{party,system,policy,deletionTrigger,deleteWithinDays,exceptions}`，删除天数为非负安全整数，触发条件、政策及法律保留／其它例外均须说明；未保留也应明确 0 与理由 |
| `subprocessors` | `{mode:"listed",entries:[...]}`；每项 `{id,legalName,purpose,countries}`，ID 唯一、实际国家列表；至多 32 项。确实无分包时为 `{mode:"none",noneReason,entries:[]}`，仍需原件支持理由，不以缺列表表示没有分包 |

上述层次明确覆盖 gateway/operator 和 upstream provider；不能把 vendor API 政策直接复制成运营方日志／备份政策。consumer 检查条目完整性与引用，不独立探测备份删除、机房或隐藏 subprocessor。所有字符串有界（最多 2000 字符），所有声明标量均须引用来源；200 条引文的总上限仍适用。

### contract／review

`contract` 为 `{reference,parties,effectiveOn,expiresOn,disclosureAuthority}`。`reference` 是可定位的适用协议／合同组合版本，`parties` 必须包含 scope 的 operatorLegalName／tenantLegalName／provider，`disclosureAuthority` 具体说明对本目的／资料范围的披露权依据。`effectiveOn`／`expiresOn` 为真实有效的 `YYYY-MM-DD`，UTC 零点计算，覆盖整个声明窗口；不是凭消费者选择法定保留天数。没有可证的有界有效期时，此格式不能完成结构审查；**不得为取得退出 0 伪造合同到期日**。

`review` 为 `{reviewerId,role,reviewedAt,decision}`；只允许 `decision:"submitted-for-independent-review"`。reviewedAt 不晚于 issuedAt，且不早于合同生效日。这个决策值不是法务 approve；reviewer 身份与职责也须有实际来源引文。单个协议不一定覆盖所有主体，允许多个同 kind 原件组成真实合同链，仍受总数／引用上限约束。

### artifacts：真实引用字节

最多 **8** 份，每项 `{id,kind,path,digest,sourceUrl,scopeDigest,capturedAt,effectiveOn,expiresOn}`：

- `id` 唯一；必须覆盖五种 kind：`contract`、`disclosure-authority`、`route-configuration`、`privacy-controls`、`accountable-review`。不接受 marketing/approved 标题作为另一种来源。
- `scopeDigest:digest(statement.scope)` 绑定相同适用范围；`sourceUrl` 为无凭证/query/fragment 的具体 HTTPS 文档定位符，可属于不同合同方，不要求与 gateway 同域。它**不触发 fetch**，更不证明来源真实。
- `capturedAt <= review.reviewedAt`；来源 effective/expiry 覆盖声明有效期，捕获不能在来源到期后。来源日期／主体的真实性仍需独立确认；不能把新捕获时间冒充新政策生效时间。
- `digest` 检查实际 UTF-8 原件 bytes，不对 JSON canonical 化后偷换原始 bytes。原件可为文本、JSON、HTML 文本，不执行 HTML／脚本，不解析 PDF；非 UTF-8／含 NUL 的二进制不支持。正式 PDF 应由授权保管者先提供可审阅的真实文本档案及原件定位／保管关系，不能让本工具假称验证了未读取的 PDF 字节。

### citations：不是只检查文件名

`citations` 最多 200 项，每项 `{field,source,quote}`：

- `field` 是声明 `{scope,controls,contract,review}` 每个标量的精确路径，例如 `/scope/tenantId`、`/controls/retention/0/deleteWithinDays`、`/contract/effectiveOn`、`/review/reviewerId`。数组使用数字索引。每个标量恰好覆盖一次，重复／额外路径拒绝。
- `source` 必须指向已读 artifact ID，`quote` 为原件中**逐字存在**的连续文本，同时含该标量的完整字面值（ASCII 字母／数字边界，数字 3 不会匹配 30）。每份 artifact 必须真正支持至少一个字段。
- route/provider/model/modelVersion 必须来自 `route-configuration`；operator/tenant 字段来自 contract 或 disclosure-authority；contract 字段来自 contract，唯 disclosureAuthority 必须来自 disclosure-authority；review 字段来自 accountable-review；controls 来自 privacy-controls 或 contract。
- 引文存在与数值相符不等于理解条款含义、核实签署权、确认配置实际执行、证明实际国家／分包全集或取得法律授权。**即使作者把自述写进原件并用 collector key 签名，也只能取得结构审查状态，永远不能令 authorityVerified 或 productionQualified 变 true。** 独立审查必须鉴别原件来源、上下文、完整性与适用性，不接受自签虚构协议。

## 回归与验证责任

`tests/studio-v3-governance-evidence.test.js` 使用隔离临时文件、合成 collector 与显著标注的虚构原件，实际调用 reader、verifier、preflight 和 CLI。覆盖字节篡改／丢失／假引文、scope／profile／release 替换、所有控制缺项、日志／备份、国家／分包、日期／到期、签名、缺证 vs 无效、unsafe 路径／symlink／超限／UTF-8／重复键、envelope-relative 解析以及所有 inventory 引用种类的 traversal 拒绝。额外验证引用数量／重复项在目标 open 前拒绝、1440 槽不静默截断、累计预算在 open／read 前失败且传入两类嵌套来源。成功材料仍有 blocker，CLI 不写 attempts。

主集成在独立治理源码快照实际执行7个相关测试文件，最终**208项全部通过**。首次批次保留1项旧预检失败：不同需求共用同一审查原件被新path去重误拒；修正为只拒绝重复profile／envelope路径及重复需求ID，复合原件每次仍独立扣账，不放宽路径或治理检查。

原索引的`../`越界已用纯虚构文件实际复现：修复前接受目录外JSON，修复后返回`ARTIFACT_PATH`且无envelope读入。实际新`governance`CLI退出1、`missing／reviewable:false／productionQualified:false`；原profile预检退出1、`qualified:false／31 blockers`。两者modelCalls及attemptsWritten均0；冻结tasks／attempts／十份corpus与Git基线逐字节摘要一致。复验入口：

```sh
npx vitest run tests/studio-v3-governance-evidence.test.js \
  tests/studio-v3-upstream-evidence.test.js tests/studio-v3-g8-preflight.test.js
node scripts/studio-v3-g8.mjs governance \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json
node scripts/studio-v3-g8.mjs preflight \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json
```

缺证退出 1 是预期安全行为。没有提交任何实际 DPA、新的生产许可、model/register mutation 或真实客户资料，也没有宣称本次取得生产资格。
