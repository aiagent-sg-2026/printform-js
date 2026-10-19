# 通用Studio代码/网页研究与缺陷清单（2026-10-16）

范围：本轮实际阅读的分页/模板、通用业务creator、Pi授权/工具/发布、源码companion与浏览器传输。不是声称对任意输入、所有ERP或整仓库完成数学意义的穷尽审计。既有历史证据和失败不覆盖。

## 已确认并修复

| 问题 | 影响与原因 | 修复及实际证据 |
| --- | --- | --- |
| 最终footer提前增页 | 估算空间不等于实际输出宽度和最终页总数 | 真实试排/回滚；独立构建2486项、三引擎42项及Chromium PDF |
| 摘要/签名拆散 | 相邻末页块缺少共同可容纳判定 | keep-next链、显式分页和超长链退让；金额/文本/签名守恒 |
| 嵌套签名错误拒绝 | 原子后代未获得无首次页眉的续页预算 | 共享原子内容识别，原RangeError用例修复为完整2页 |
| 一次性表头空白页 | keep-next试排遗漏尚未消费的表头 | 探测与实际搬移复用同一谓词；原3页变2页 |
| Payroll可选字段编译失败 | camelCase源键被直接用作受限field ID | field ID转kebab，原JSON Pointer不变；35业务消费者回归及9浏览器生命周期 |
| Docker启动失败 | local日志驱动max-file=1却启用压缩 | 显式compress=false；真实sealed镜像和服务启动/执行成功 |
| 公开浏览器到本机fetch失败 | 当前Chromium的实验性targetAddressSpace参数不兼容 | 删除不必要的参数，保留真实Origin、LNA权限和CORS；没有关安全或伪造来源 |
| BOM源码静默改变 | UTF8解码丢掉BOM，无关全树patch改写原文 | raw decode保留BOM；只在JSON parse视图忽略；EFBBBF78保持 |
| 真实命令完成却客户端拒绝 | 原始输出限制未计JSON六倍转义，导致旧revision继续使用 | 明确1MiB序列化边界；50000NUL实际300864bytes接受且状态一致；未知效果仍fail closed |
| 发布依赖误判生成源码 | 正则把template字符串内示例import当作宿主依赖 | 固定现有es-module-lexer2.3.2语法扫描；实际发布草稿恢复，computed import仍拒绝 |
| 测试伪造导航被403 | Node fetch不能冒充真实人类导航，安全门禁正确拒绝 | 永久Docker集成采用真正浏览器导航/自动Origin；负向恶意header仅作协议攻击用例，不冒充生产证据 |
| Stop后恢复时序回归 | 等待源码清理让较新的选择恢复先启动，旧Stop反而等待新恢复 | committed恢复立即启动，与源码清理共同等待；原真实竞态测试通过，不增加超时 |
| 重复面板宿主构造失败 | 重复ID使局部ID快速查询落到其他实例而返回null | 密码控件改为相对属性选择；原附件行为规格通过 |
| 不存在cwd误判配对过期 | `DIRECTORY_NOT_FOUND`未映射为准入前路径拒绝 | 保留lease，允许模型修正路径；未知效果仍停止 |
| strict cwd无根目录表示 | optional参数经provider变成必填，原schema排除空串 | canonical `cwd:""`显式可表达；不接受"."或绝对路径 |
| cwd lookahead阻断真实模型 | 相同alias/预算下，仅加入该schema即空incomplete；并非已证明真实token耗尽 | 保留相同安全语义的正向分支恢复22工具；公开74073f0实际完成源码→候选→人工Apply→离线PDF→Undo，正式G8不计分 |
| 复合来源描述可被模型替换 | 原金额保护不覆盖描述中的工时/费率；实际API接受static0，原费率111.000仍存但未打印 | 初始/printRows四种复合事实固定原绑定，不交给单值数值oracle；43行业消费者与原7绑定规格通过，合法样式/删除/原绑定恢复保留 |
| 同profile混用执行身份仍误报qualified | 真实API合成控制把模型、route、预算换掉仍返回true | 固定八项执行身份；合法基线仍通过、混合身份拒绝，不改阈值或混入真实attempt |
| 显式只读被否定修改词误判可写 | “只读…不要修改”含“改”，旧分类false且真实API接受font-change proposal | 前导read-only/只读/唯读优先限制；实际API转为true并拒绝修改，不变提示/模型/预算/字体formatter |
| 装箱重量复合单元格阻断导出 | 同一 amount 塞入 Gross/Net 两个来源事实，真实既有数值几何门禁拒绝 | 毛／净重各独立来源行，包装头数值为空；真实预览4行受阻→7行1页可导出，canonical 数据原样保留 |
| 非财务状态可被伪造为已验收付款 | ServiceReport/PackingList 上下文未受原始绑定保护；实际 API 接受 `Accepted and paid` | `/printRows` 限定的上下文值／provenance 保留初始绑定及格式；实际 API 拒绝，标签／样式与普通表单契约不变 |
| macOS PDF 中文字符映射错误 | 原字体路径把来源 `长` 提取成 `⻓`，原 PDF 文本断言真实失败 | 三份隔离字体 PDF 中 Hiragino Sans GB／Songti SC 保留原字，PingFang SC 未保留；主题优先既有 Hiragino Sans GB，不改来源或比较规则 |
| 观察回执破坏机器可读答案 | ab9真实模型三次均提供正确JSON，宿主两次追加回执文字，实际用户结果Fail | 正文与独立可见／可恢复回执身份分离；旧失败保留，当前状态／外来／过期校验与受保护历史排除不变 |
| 可选回执ID缺明确空值 | 实际wire只接受非空string，模型反复提供none/latest等占位值并被正确拒绝；一次最终Blocked | 标准nullable optional ID表达未指定；不接受占位值，不关闭freshness。官方Responses默认规范化是兼容性依据，不冒充已识别服务端实现 |

## 没有冒充产品缺陷的失败

- 临时Playwright配置默认导出互操作失败，浏览器未启动。
- 静态业务行被测试误当成0条repeat数据；改用输入原行计数，只有真实repeat才验repeat身份。产品行完整性没有放宽。
- “256KiB控制字符源码一定超过1MiB”的假设被实际offset/maxChars分窗否定：5窗完整读回、最大384586bytes。没有因此增大权限/预算。
- 未发布模块使用非允许revision标签被生成器拒绝，改用既有 `local`，不把本地代码伪标成已部署SHA。

## 仍开放的改进与资格风险

| 项目 | 当前事实 / 下一验证边界 |
| --- | --- |
| 全面生产资格 | 60冻结输入／20holdout已校验；旧ab9三Fail保留，新8c同原题3/3 Pass，各profile仅3/180。12请求仍Blocked，完整G8、DPA、固定模型／价格／SLA／驻留、G6/G9和外部业务授权未关闭 |
| 所有ERP/法定格式 | 仅声明的交易适配器与supplied-business-v1有边界；任意raw ERP、混合币种对账、法定工资/税务需显式映射及独立审核 |
| 无代码优先 | 普通设计无需companion；源码profile需要管理员本地Docker及真实浏览器配对，不是已认证托管多租户服务 |
| 业务纸面密度 | 旧三份样张各2页的记录保留；新局部预设组合快照三引擎9/9、三份Chromium PDF各1页，来源全文及字号/几何检查通过。超长内容允许正常分页，不宣称任意输入全局最优 |
| 业务事实 | 新增显式lot/serial/expiry/仓位来源及独立工时/费率；不由序列号推数量，不乘工时费率，不补余额/净薪酬，不做账龄/FX/UOM/过账/支付。任意其他行业字段仍需明确契约 |
| 平台与隔离 | 当前实际Darwin arm64/OrbStack/Chromium151；Docker/seccomp不是完美隔离，其他OS/浏览器/负载及宿主安全须独立资格 |
| 模型可改测试 | 真实exit只证明进程结果，stdout或可写测试不能认证需求正确；仍需独立oracle和人工纸面审核 |
| 硬件打印 | 浏览器几何和Chromium PDF不认证热敏、连续纸、驱动、真实打印机或全部字体组合 |

## 依据与契约

[末页实际证据](acceptance/STUDIO_V3_FINAL_PAGE_FLOW_20261016.md) · [通用业务及OASIS/GOV.UK研究](GENERAL_BUSINESS_FORMS.zh-CN.md) · [源码操作及Docker/Chrome/Node/RFC研究](STUDIO_V3_CODING_RUNNER.zh-CN.md) · [生产证据](STUDIO_V3_GENERAL_AI_READINESS.zh-CN.md)。

2026-10-16完整组合 Node24 `build:site`：240文件/2601项通过，9项opt-in跳过；当时新增行业字段在真实三引擎9/9生命周期中保留。2026-10-17资格任务独立快照为243文件/2728项通过、9项opt-in跳过；冻结语料与API拒绝证明不等于模型180次资格，亦不替代纸面或物理设备验收。

2026-10-17行业集成隔离构建：244文件／2778项通过、9项opt-in跳过；五类单据三引擎15/15、5份Chromium PDF。Firefox重导入后的定位挂起与失败报告保留，最终统一读取当前真实主世界DOM，不复用桥接HTML或放松断言。完整记录：[服务／装箱及官方语义研究](GENERAL_SERVICE_LOGISTICS.zh-CN.md)。

同次纸张子集108/108、36份实际PDF通过；本机队列／设备只读发现未找到可用物理打印机，零打印任务。有限纸张与硬件阻塞详见[2026-10-17实际纸张审计](acceptance/STUDIO_V3_SPECIAL_PAPER_20261017.md)，不认证任意卷纸长度、驱动或全部字体。

实际回答修复最终验证：244文件／2786项通过、9 opt-in跳过；109可执行conformance示例与38处发布review通过。公开8c原题三次JSON保持原字节，未改变r0／数据／schema／document ID；额外真实模型回执在桌面及375px可见无溢出，不计G8。[保留失败与修复结果](acceptance/STUDIO_V3_G8_READONLY_20261017.md)。

## 2026-10-17：通用导入与真实设备边界补充

| 本轮确认的问题 | 源头修复与实际检查 |
| --- | --- |
| 一般表单仍被旧`/items`与数字quantity规则拦截 | 改用既有source schema及启用绑定验证；真实`/records`字符串`-001.250`和无表格工单经Apply/Undo/Save/Open/HTML，不改schema或伪造数据集 |
| 普通对象型profile被误判canonical | 实际API复现拒绝后，将来源档案识别限定为非空字符串标签；真实导入/打印/回执/重开保留客户profile对象，字符串来源标签仍拒绝 |
| 打开无表格表单仍选隐藏items并报Missing value | 默认选择启用的实际区域，不隐藏真正校验错误；原生Chrome从一项假错误到零，修订仍r0，三引擎加入消费者回归 |
| 手机源选择框仅约40px | 复用了旧field-table的16%/32%列宽；移除无关类而非!important覆盖。375px实测三行的来源/转换框均339px、行355px、全局溢出0 |
| 物理纸面内部少约24px | 屏幕分页间隔误入逻辑纸面；移到物理包装外，A4逻辑页1099→1123px，字体/边距/来源token和严格独立PDF尺寸预期不变 |

InspectionReport/AssetHandover补齐到既有业务profile的七类；不是认证、签收、产权或支付推断。一般导入允许2MiB/500条受限记录映射到既有字段；不是任意Excel、未知来源profile、无限卷纸或全币种/法定格式自动支持。完整原文件（含未选列）有意进入Save/HTML，必须显式提示。

本轮最终75/75三引擎含18导入、21业务、36纸张；独立全量2873通过/9 opt-in跳过，114契约示例。首次66场景30通过/36失败、后续71/72 Firefox定位挂起及72/75测试助手命名冲突均保留；最后使用既有真实主世界DOM及可见Print preview流程，不回放桥接HTML、放松oracle或延长90s/12s预算。[完整审计](acceptance/STUDIO_V3_GENERAL_IMPORT_MEDIA_20261017.md)。

生产与硬件仍开放：G8原冻结集合最高144/180；本机CUPS无配置目的地，零打印任务。浏览器/PDF与用户声明能力表都不替代实际走纸、裁切、驱动、切刀、字体/条码及跨OS验收。

### 公开版本的实际AI交付缺口

e385公开版本接受自然语言改纸/先预览后人工Apply任务，原demo-auto实际5次HTTP200但返回说明和额外确认，没有修改候选，按任务Fail保留；不是授权误判，design effect本可调用set_page，answer终止本身合法但不证明完成需求。独立实际Save确认r1/A4与完整项目未变，原始文件/设备/未选列canary未出站。没有调prompt/alias/预算或弱化finish来补绿。仍需明确的意图完成策略与独立多任务资格，不能把安全不变与生产可用混为一谈。[非G8原始结论](acceptance/STUDIO_V3_GENERAL_AI_LIVE_20261017.json)。

## 2026-10-17：独立来源表、文件隐私及实际消费者审查

下表包含已发布AI缺口和本轮**未发布集成中**发现的回归，不把开发态错误倒算成旧main缺陷；不是整仓库“所有bug已清零”结论。

| 已复现问题／风险 | 根因与修正 |
| --- | --- |
| 编辑请求以回答终止却没有候选 | 明确draft意图删除answer effect，仍无权强迫模型成功；ed5HTTP200与0c8HTTP200真实Fail保留 |
| 模型公开blocker丢失 | Pi正常/中断catch和UI不共用公开字段；统一仅AGENT_BLOCKED的1..500字符reason，归属明确且不读私有推理 |
| 空集合的声明schema被改设计丢掉 | 按稳定表/列身份保留既有声明；改变/新增/重新启用绑定仍需schema |
| 加表错误选择纯量数组 | 只选择所有行都为安全对象的合法候选，跳过tags等纯量数组 |
| 条码切换真实图片残留配置 | 清除旧barcode配置，保留可返回的来源pointer；不是隐藏验证错误 |
| 条码仍在纸内却跨单元格 | page-only和nearest-only都不足；遍历所有同页cell/field祖先，原生窄列拒绝、只加宽分配后通过，SVG/数据不变 |
| 主币种目录错误缩窄外币来源 | 开发态16代码共用validator曾拒绝原合法BHD/AED；恢复原来源/core支持，只限制主币种UI/构造 |
| 换显示币种重贴已有来源金额 | 显式document.currency参与一致性检查和映射预览；不重算、不做FX |
| 通用invariant误锁普通quantity主集合 | 恢复原非财务主表可换collection的语义；额外表集合和canonical来源仍保护，未修改原正向契约样例 |
| 工时附加身份可伪造成static | `/printRows`档案附加表固定原身份/绑定/kind；实际API由接受变UNSAFE_PROPOSAL，label/style保留 |
| 额外表引用进入旧范围消费者 | 实际chat及private-draft两个路径曾UNSAFE_SCOPE且表头广告错指主表；统一metadata block ownership，自身header仅label，不扩跨表权限 |
| 老文件read覆盖较新编辑/review | 读前大小及代际/上下文检查；原生延迟Open和两CSV竞态守住较新工作 |
| 非法UTF8被替换字符接受 | fatal decode明确拒绝，实际Save不变；大project在native读取前拒绝，dataset原有大小护栏保留 |
| 长CSV名称截断导致恢复猜JSON | recovery保存并验证显式csv/json格式，不能靠截掉扩展名的display label猜测；raw source/mapping/backup保留 |
| 分享时原始文件仍嵌在输出 | 默认来源合同不变，新增明确share clone只去receipt/session；真实下载证明unbound live data仍在，不伪称匿名 |
| 手机旋转/面板缩放裁切聊天草稿 | 原生27字草稿64px容器/70px内容；resize及面板宽度改变重测后70/70、最窄85/85，文本不变、零推理 |
| 普通主表坏data不能进入可修复状态 | 过广collection guard把原人类JSON/缺失路径编辑提前拒绝；仅普通主表保留invalid-authoring，原生r1锁输出→原数据r2可导出，source/schema/additional/barcode守卫不变 |
| primitive row被错误建议为对象根`.` | `observedFields([7])`把空后缀前缀成`.`；仅排除标量根，保留声明空object子字段与缺失诊断，坏行仍不可打印/导出 |

独立只读审查中，文件/恢复/隐私未发现进一步有证据的P0/P1/P2；契约审查发现的额外表scope P2已修复并复核。该审查不是runtime Pass。真正原生下载、250目标分页、500末行拒绝/完整成功、六档视口与独立条码像素解码见[文件证据](acceptance/STUDIO_V3_FILES_PRIVACY_20261017.md)及[条码证据](STUDIO_V3_OFFLINE_BARCODE.zh-CN.md)；最终浏览器/发布记录须另记。

错误的Intl负号精确文案、版本/registry镜像、CSV selector/源码清单镜像及依赖未构建dist的HTML用例已删除，不重新钉住实现。合成change重复触发、双视口截图、外部配置default互操作等驱动故障与首次失败均保留，不伪装成产品缺陷或模型通过。

继续开放：任意ERP/raw格式/法定本地化、原生XLSX/未知连接器、join/会计/税/FX/工资推算、GS1/真实扫码/打印、固定上游与DPA、完整同profile G8/G6/G9。当前是有界通用Studio，不是通用任意代码执行或Production Ready。

后续完整来源构建266文件/3238项通过、9opt-in跳过，原127契约实例与39审查通过。旧729场景623/106保留；发现的raw模块404、旧入口/隐藏结构、终止文案/原生File.text假设分开修复，不把Node SDK本身当浏览器集成证明。原生55000字符长描述实际合法34页且逐字完整；错误按semantic ID只取两段的3167字符观察也保留，改读真实续页单元格而不是宣称数据丢失。原子页尾则保留所有纸张/字体/原文，仅明确keepTogether并实际阻断。[完整范围](acceptance/STUDIO_V3_GENERAL_CAPABILITIES_20261017.md)。

[PR95/main c89d85bd](https://github.com/yapweijun1996/printform-js/pull/95)构建发布成功；单次原精确公开纸张任务真实Preview/显式验收驱动Apply/实际Save深比较Pass，6HTTP200/19.793秒，全部其他属性守恒、3canary未出站、0pageerrors。与旧三个Fail分别保留，不把一次独立Pass或已修复宿主误完成当作完整AI生产资格。[证据](STUDIO_V3_AI_DRAFT_OUTCOME.zh-CN.md)。

## 2026-10-19：源码所有权、制品歧义及检验来源

- 确认缺陷：`DockerBroker.cleanupExpired()`只凭managed／过期标签就可删其他broker资源；受控命令夹具实际发出2次foreign删除，没有执行真实foreign删除。修复为当前owner过滤、metadata核验及最终`remove()`重读；2项资源存留／替换竞态与9项实际Docker／浏览器协议通过。
- 确认缺陷：原制品hash／custody正确仍接受重复`summary`并last-key-wins。复用既有严格parser在native类型解析前拒绝重复／危险键；17项实际typed消费／inspection／AIPanel状态机回归通过，同源码真实测试exit1→0／build0及真实候选纸面另证。[完整边界](STUDIO_V3_SOURCE_ARTIFACT_LIFECYCLE.zh-CN.md)。
- 新的固定ERPNext检验来源复用InspectionReport：原Data词形不数值化，Float只用另行授权精确事实，不求平均或重算Accepted。57项Node与三引擎实际文件／冷HTML消费者通过；独立来源语义和runner安全静态审查均无新增实质缺陷，静态审查不是runtime Pass。
- 18场景长表／固定模块标签与4份PDF／独立像素解码未发现需改产品的打印缺陷。生成物顺序、残留源码文本断言、新夹具变量与首次镜像不可见等失败分别保留；不改预算／模型／原WebKit冷offline条件，不把数字验证当实体或生产资格。[打印记录](STUDIO_V3_LONG_TABLE_LABEL_PRINTING.zh-CN.md)。
