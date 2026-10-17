# General Studio：独立表格、条码、来源事实与文件验收

## 范围

这是一般无代码 Printform Studio，不要求 ERPNext。保留现有交易适配器；新增能力不是任意 ERP/raw 格式、法定单据或实体设备认证。

- 原主表加最多4个独立来源表，每表最多30列；各自集合/行作用域，没有自动join/合计。
- CODE128原字符串1–128个可打印ASCII字符；EAN13严格13位含给定校验位。离线固定SVG、quiet zones及原文，不裁切/缩小以通过检查。
- 16主币种仅限制Studio UI/项目构造；既有合法外币来源与core formatter未缩窄，不做FX。制造工单/工时表使supplied-business-v1达到9类；不推BOM、库存、工资、审批或完成事实。
- 人工New、加表/选集合、币种、映射、保存/分享与callable tools明确分开。额外表/表头引用只授权实际拥有的后代或label；数据/金融/source绑定及人类Apply不放宽。

## 已执行的来源与契约检查

完整隔离Git归档加显式归属overlay，使用Node24.21.0及项目原始`npm run build:site`：266文件通过、3238测试通过、9 opt-in跳过，运行119.20秒并实际生成站点。不是根工作树build；未读取/复制/摄入用户私有进度审计文件。

发布CLI实际执行127契约实例，22tools/13operations/4guides，39变更审查，原a99c932基线不移动。四指南字符数14894、5603、11330、5212，均低于原16000边界。

保留此前失败：初次单元9项失败；源边界修复后3230通过；并行负载时知识同步原5000ms超时；手工提示/依赖变化造成14个审查摘要过期；新增JSON Pointer预期误写未转义`~`。最后按RFC6901纠正测试预期、同步真实依赖摘要后运行上述完整构建；不增超时、不改格式器或冻结G8。

## 原生Chrome155/sandbox实际消费者

| 路径 | 真实观察 |
| --- | --- |
| 大文件/UTF8 | 10MiB+1 project、2MiB+1 dataset零次native内容读取；非法UTF8明确拒绝，原实际Save不变 |
| 异步文件 | 旧Open不覆盖同bus较新编辑；旧CSV不覆盖新review；坏JSON后重试保留data/schema |
| 大映射 | 250target/250source仅10selectors、2510options；1→25→1页映射保留；初始92ms、48翻页及预览7963ms只是单机观察，不是SLA |
| 全行校验 | 第500行错误显式数值转换被拒且Apply禁用，实际Save原data不变；合法500行完整下载、每行词形/显式数值及原CSV完全一致，操作473ms不是基准 |
| 分享 | 实际ordinary/share JSON及HTML文件：默认保留source-only filename/value，分享去掉receipt/session；全部live/unbound data及`00007.500`保留，原receipt不变，分享JSON可重开 |
| 源项目状态 | 分享前后均r7/unsaved、Undo可用，不把副本下载当成保存原文件 |
| 人类修复 | 普通主表错误data可提交为r1，但实际print/export锁定；精确修复到r2后可导出，data逐项原样。additional/barcode/声明schema仍严格 |
| 聊天草稿 | 27字草稿桌面64px，390宽原64容器/70内容裁切；修复后70/70，最窄面板85/85，原文不变，零模型POST |
| 长描述 | 原输入55000字符合法分到34页；全部实际数据单元格拼接连空白逐字一致。仅按原semantic ID取两段得到3167字符是假不完整观察，原记录保留，不是正文丢失 |
| 原子页尾 | 同纸张/边距/72pt/原文加明确keepTogether，实际A5 210×148mm报告blocked，print/export锁定；不把可拆长文误当原子溢出 |

六档CSS视口320×720、390×844、430×932、768×1024、1024×768、1440×900实际PNG尺寸核对并审阅，无全局横向溢出。320宽长分享说明在modal内滚动，全部原操作可达；不声称初始全按钮同时可见、真实手机软键盘或辅助技术认证。

实际原生两张PNG由独立Apple Vision解码CODE128 `00012345-AB`和EAN13 `0123456789012`，confidence分别0.9696496725082397、0.9910118579864502。不是读取标签/源值自证，不是GS1/物理扫码认证。实际264px条码在104.84375px cell被拒；只分配更宽314.546875px后通过，SVG/来源未改。600px内层field不能绕过外层cell。

## 浏览器失败历史

第一完整旧快照729场景：623通过/106失败，完整报告保留。首个受影响子集108场景：81通过/27失败；主要包括raw源码模块图未发布导致404、旧Data入口/隐藏structure、UTF8英文文案、旧AI终止/原生File.text假设和主表过早拒绝。不能把这些记录删掉或把未运行场景当Pass。

纯SDK构造/HTML解析迁到真实Node API；独立HTML仍用实际发布预览的运行时字节，数值源错误仍用实际PaperPreview及inspect/finish拒绝/恢复；不暴露src、不伪造ready、不改sandbox/时间/字号/几何。新CommonJS助手import.meta错误发生在收集前，单独保留，不算产品断点。

完整后续729场景原配置2workers、0retry、原超时，实际700通过/29失败（21.3分钟）。15次条码overflow/nested失败是Node exporter缺document；3次offline像素decoder取fit缩放后错误行；3次Open升级错误假定clean r0也必须弹Keep；3次坏collection期待已不存在按钮；3次55000字错误期待blocked；另两次Firefox分别120s/90s超时，未假定已修复。原记录保留`complete-browser-verification.json`，修复后独立输出到`consumer-browser-verification.json`，不覆盖失败或把统计相加充作一次全绿。

解析用jsdom不负责测量，仍由实际三引擎测量源几何；1:1只是显示zoom，不改打印符号。升级新增真实未应用label草稿，使Keep前提成立并检查字节来源/草稿恢复。主表坏数据仍检查真实输出和保存锁定及精确修复恢复。

第一修复子集120场景85通过/35失败（8.1分钟）；27项升级在构造前被正确的陈旧review摘要门禁拒绝，不是升级功能回归，未隐去；随后重新冻结所有132归属文件并逐字节核对、刷新39项审查。额外发现并修复真正产品缺陷：原始primitive row被catalog错误建议成`.`，现在只排除根标量，保留声明的空object子字段和缺失字段诊断；坏行仍锁print/export。条码3项quiet-zone失败另查明是蓝色2px选中框污染截图，改由真实UI移去selection，不补白、不裁边、不改符号或decoder。

最终独立源码原始`build:site`实际266文件通过/1文件跳过、3244项通过/9opt-in跳过（330.10秒）；127契约实例、39项审查、22tools/13operations/4guides保持。原asm.js、jsdom、module-type及node:fs浏览器externalization警告原样保留。Firefox实际两处在srcdoc替换后的FrameLocator断言超时，改为特权验收驱动读取当前不透明frame的main world；不改变sandbox、期待值或任何运行预算。

最终来源126场景124通过/2失败：Firefox旧frame的500行采样仍超时，WebKit `file://`在transport offline时internal error。后续生命周期33场景30通过/3失败继续原样保留；最终使用新真实preview token与运行时实际页HTML计算同样精确行数，通用spec三引擎30/30通过（69.61秒），不累加成一次126/126。

WebKit缺口未跳过或改绿：不包含Printform/脚本的114字节最小HTML，online本地file成功、同版本offline本地file也报同internal error，证明当前工具的该导航前提不可用。独立冷offline上下文以data URL载入真实下载328604字节（SHA256 `8a89f7f721ef76bce45563bc12f4bc1152e84c21d80d472f8cc6a04e8d82cfa2`），`navigator.onLine=false`、零HTTP/错误，原生PNG像素独立解出CODE128 `00A<&`和EAN13 `0001234567895`及精确金额`00012.3400`；这证明离线内容执行，不替代仍Blocked的WebKit offline file导航。首次浏览器Blob像素解码InvalidStateError也保留，改用既有Node原生PNG解码器，不改变截图/模块decoder。

## 模型与生产资格

公开e385/ed816282原同请求分别5个HTTP200但无候选，0c02为8个HTTP200、21.315秒最终AGENT_BLOCKED；均实际任务Fail。各run独立5242字节Save前后SHA相同、r1/A4、3canary未出站；未读取/转录私有reasoning/wire。新公开source必须单次另记，不用同失败profile反复刷绿。

原冻结60任务/20holdout、六条历史正式attempt与所有失败不覆盖；本轮零新增正式G8。12拒绝任务决定原集合上限144/180低于162，data0/18及bindings/refs/files各12/18低于16。固定upstream、DPA、完整G8/G6/G9、物理打印/扫码与自然语言独立oracle仍缺，AI继续Production Pilot，不是Production Ready。

[通用表格边界](../GENERAL_SOURCE_TABLES_BARCODES.zh-CN.md) · [条码实现与独立解码](../STUDIO_V3_OFFLINE_BARCODE.zh-CN.md) · [来源及官方研究](../GENERAL_CURRENCY_MANUFACTURING_TIMESHEET.zh-CN.md) · [文件证据](STUDIO_V3_FILES_PRIVACY_20261017.md) · [AI交付历史](../STUDIO_V3_AI_DRAFT_OUTCOME.zh-CN.md)。
