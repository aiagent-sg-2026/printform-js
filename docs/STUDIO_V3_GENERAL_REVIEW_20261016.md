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

## 没有冒充产品缺陷的失败

- 临时Playwright配置默认导出互操作失败，浏览器未启动。
- 静态业务行被测试误当成0条repeat数据；改用输入原行计数，只有真实repeat才验repeat身份。产品行完整性没有放宽。
- “256KiB控制字符源码一定超过1MiB”的假设被实际offset/maxChars分窗否定：5窗完整读回、最大384586bytes。没有因此增大权限/预算。
- 未发布模块使用非允许revision标签被生成器拒绝，改用既有 `local`，不把本地代码伪标成已部署SHA。

## 仍开放的改进与资格风险

| 项目 | 当前事实 / 下一验证边界 |
| --- | --- |
| 全面生产资格 | 2026-10-17已冻结60输入/20holdout，语料提交尚无正式attempt；12项不可用请求只能Blocked，不能满足G8。DPA、固定模型/价格/SLA/数据驻留、G6/G9和外部业务授权仍开放 |
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
