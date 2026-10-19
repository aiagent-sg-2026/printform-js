# 通用 Studio：2026-10-17 历史交付记录

本页保留当时来源、发布、失败及验证结果；不是当前版本资格证明。现行结论见[能力与生产发布证据](STUDIO_V3_GENERAL_AI_READINESS.zh-CN.md)。

## 2026-10-17：通用独立表、来源事实和分享边界

主表之外最多4张独立来源表，每表最多30列、独立集合和行作用域，不自动join/求和。人工New／加表／集合／币种／映射／下载与callable typed tools明确分开；额外表/表头引用现按实际metadata ownership路由，只能改自身后代或自身label，不能跨表。完整来源事实和新增`/printRows`附加表身份不能被模型替换成捏造static。

离线CODE128／EAN13固定SVG、quiet zones与原字符串；所有同页cell/field祖先均参加overflow门禁，不缩小条码来补绿。原生Chrome155真实像素由独立Apple Vision解码两个含前导零样例；不是GS1、实体扫描器或打印机认证。[表格与AI边界](GENERAL_SOURCE_TABLES_BARCODES.zh-CN.md) · [条码实证](STUDIO_V3_OFFLINE_BARCODE.zh-CN.md)。

16代码仅是Studio主币种UI／项目目录，不缩窄既有合法外币来源事实和core formatter；显式来源币种与显示币种必须一致，没有FX。制造工单与工时表使supplied-business-v1达到9类，保留原数量、工时、UOM、期间、身份、状态及provenance，不展开BOM、不记库存/工资/批准事实。[来源契约及官方研究](GENERAL_CURRENCY_MANUFACTURING_TIMESHEET.zh-CN.md)。

文件读前2MiB/10MiB、fatal UTF8及代际检查守住旧read覆盖新编辑/review；Keep保存显式csv/json格式，不从截断文件名猜测。映射分页10targets并不缩窄全行验证：原生第500行错误拒绝，合法500行实际下载逐项一致。250目标/250来源实际只生成10selectors／2510options，源50,000节点等界限仍同时生效。

默认Save/HTML仍保留完整原来源；显式Share copy只去掉receipt/session，全部live/unbound data仍保留，不是匿名化。实际JSON/HTML下载、原receipt、unsaved/Undo及重新Open均独立检查。六档CSS视口聊天/分享PNG已审阅；320宽长说明内部可滚动。真实27字草稿从桌面转390宽曾64px容器/70px内容裁切，现窗口及面板宽度变化重测为70/70、最窄面板85/85，草稿不变且零模型请求。[文件及原生证据](acceptance/STUDIO_V3_FILES_PRIVACY_20261017.md)。

PR93/main`ed816282`公开同精确请求1run/5HTTP200仍无候选，`draft-not-produced`，Fail；PR94/main`0c02e1bc`1run/8HTTP200最终`AGENT_BLOCKED`，仍Fail。各run实际5242字节Save前后SHA相同、r1/A4、3canary未出站；不把“未修改”或HTTP200记成成功。当前诊断修复仅展示模型自己提交的1..500字符公开blocker，并明确不是宿主已验证能力限制，不读reasoning/wire或自动retry/Apply。[完整历史](STUDIO_V3_AI_DRAFT_OUTCOME.zh-CN.md)。

全局22tools／13operations／4guides；显式design草稿仅12个可用工具，`finish_answer`不在其grant。127实际契约实例、39变更审查保留原a99基线，所有指南仍小于16,000字符。正式G8零新增attempt；旧三Fail/三Pass及冻结12拒绝任务不覆盖、不混profile。固定upstream／DPA／G6/G9／硬件与完整G8仍缺，**不能称已生产就绪**。

完整后续来源隔离构建实际266文件／3238项通过、9opt-in跳过，127契约实例与39审查通过；原警告、首轮9项失败、单次原5s超时、14个陈旧摘要及误写未转义Pointer的测试失败均保留。原生新检查还证明普通主表错误data可到r1但真实print/export锁定，精确修复r2可导出；不放宽声明schema、额外表/条码或AI金融/source边界。

同一55000字符来源长描述合法34页，实际单元格拼接连空白逐字相同；旧“长文必blocked”不是正确oracle。保持原纸张/字号/原文，明确keepTogether的A5原子页尾则实际blocked、210×148mm与print/export锁定。完整旧快照729场景623通过/106失败历史、后续逐类修复及结果分开记，不用模型/测试数量代替用户交付。[本轮完整证据与边界](acceptance/STUDIO_V3_GENERAL_CAPABILITIES_20261017.md)。

最终来源完整构建3244项通过/9opt-in跳过；最终通用spec三引擎30/30通过，原126子集124通过/2失败不覆盖。WebKit transport-offline本地file导航在无项目代码的114字节基线上也失败，仍是明确浏览器验收Blocker；同一真实下载字节的冷offline内容执行和独立解码另证，不冒充file导航通过。AI正式生产门禁不变。

[PR95](https://github.com/yapweijun1996/printform-js/pull/95)已合并main`c89d85bd5d153da81e46c0af9dd426f51b1a2691`，[Pages39039021333成功](https://github.com/yapweijun1996/printform-js/actions/runs/39039021333)。原生Chrome155新源单次原精确任务真实Pass：6HTTP200/19.793秒，正确纸上Preview仍r1，验收驱动显式UIApply后实际Save r2只改188.5×244.2mm纵向自定义纸张与revision，其他字段深比较原样；3canary未出站、pageerror0。先前0请求驱动诊断前置失败亦保留。[完整记录](STUDIO_V3_AI_DRAFT_OUTCOME.zh-CN.md)。不把一次独立Pass冒充完整生产资格或新增正式G8。

