# Studio v3 文件读取、恢复与分享副本

## 范围与证据边界

本分片针对通用无代码 Studio；不是 ERPNext 专用导入器。原始文件及映射保持用户提供的原样语义，不补算税额、总额、状态或批准事实。

源审计入口为 `app.js` 的真实文件输入事件、`file-io.js` 的 Save/Open/HTML、`structured-import-*` 的映射与 receipt、`update-work.js` 的 Keep 恢复。没有访问用户私有进度审计文件；没有运行根目录 `build:site`。

本 worker 按任务约束没有运行测试、构建、格式化、浏览器或 lint。下述“新增用例”是待主代理执行的永久消费者测试，不是通过声明。主代理单独报告了基线 `42e014b` 在 Chrome 155、sandbox=true、零模型请求下的四个真实缺陷；修复版结果须由主代理另附实际运行记录。

## 基线实际缺陷与修复

| 入口 | 基线证据／源路径 | 修复合同 |
| --- | --- | --- |
| Open 大文件 | 主代理观察到 10 MiB + 1 的真实 File 调用了 `File.text()`；旧处理器先读后在 `readProject` 检查 | 与导入共用 `readTextFile`，先检查原生 `File.size`，超限不调用 `.arrayBuffer()` 或 `.text()` |
| Dataset 大文件 | **旧版本已经**在读取前拒绝 2 MiB + 1；其 reads=[] 不是新发现缺陷 | 保留该行为及同样上限，不能把它写成基线缺陷 |
| 同文档迟到 Open | 主代理观察到同 bus 上 r2 人工标题修改被迟到 Open 覆盖成旧标题／r0；旧代码只比较 bus identity | 全局 latest-read ticket 同时记录 bus、project snapshot、当前 review/mapping/preview 和草稿，读取后及入编辑队列后都检查 |
| 非法 UTF-8 | 主代理观察到 `File.text()` 将标题非法字节替换为 `�` 并成功打开 | 使用 fatal UTF-8 decoder；字节读取错误、编码错误、JSON 错误均不安装候选项目 |
| 导入读完成顺序倒置 | 主代理观察到旧 CSV 读晚完成后覆盖新 review，newerRetained=false | Open／导入共享一个 generation；新文件选择、文档变化、review 修改／取消均使旧读取失效，旧失败也不覆盖新提示 |
| 映射选择器规模 | 源路径为 `mappingTable` 对每个 target 重建每个 source option；250×250 形成至少 62,500 source options，且重复构造首行样本 | 每页只呈现 10 个 target，原上限与所有映射保留；首行每个 source 样本每次渲染仅构造一次。Preview／Apply 仍验证所有记录／全部页映射 |
| 更新丢失 import review | 原 `pending()` 没检查 `database.importReview`，capture 也没有 source/mappings | review 是未保存工作；Keep 保存原 text、已判定 format、显示 filename、scope、mapping、页码。恢复后重新绑定到当前项目，预览过期，必须再 Preview／Apply |

基线对照脚本 `scripts/studio-v3-file-consumer-probe.mjs` 只依赖基线已经存在的真实 DOM 入口、File 与下载，不 import 新 helper。原脚本的 Cancel locator 曾因页面两个合法同动作按钮触发 strict locator 错误；已改 `.first()`。这是探针错误，不是产品错误，不改变上述独立已保留的基线证据。

## 保留的限制与失败恢复

- CSV／JSON 文件仍为 2 MiB、每 scope 最多 500 条记录；JSON 仍为深度 16、50,000 nodes。
- 可编辑项目仍为 10 MiB、深度 18、50,000 nodes；Save 验证实际序列化 envelope，避免下载不能再 Open 的超预算项目。
- JSON 大小计数不再为了检查字节数分配完整 TextEncoder buffer；UTF-8 汉字、成对 surrogate 与孤立 surrogate 的计数仍按标准编码字节数。
- 原文件 source text 不截断、不清洗；CSV／JSON 数字词形继续保留，转换仍须显式选择。
- 错误的新文件不能删除现有 review、提交新 revision、替换当前 sampleData/schema 或覆盖原 receipt。错误修正后可重新选文件；input value 每次释放，允许重选同名文件。
- JSON 项目允许 UTF-8 BOM；BOM 在项目 envelope 解析时处理。导入的原文 BOM 仍保留在 source receipt 中。
- Keep 恢复沿用原 4 MiB sessionStorage 上限；包含历史、原文件的工作若超限，阻止更新并要求先保存或留在当前版本，不偷偷删除 source/history 以塞进恢复空间。
- 新增表只按各自显式 collection 映射，不 join、不拼接。读取新 additionalTables／barcode 时验证真实集合和值；旧普通缺失 binding 仍可打开以便用户修复，不强制默默补全。

### 恢复必须保留已判定格式，不能从显示文件名重猜

主代理在本轮新增恢复路径实际重现：245 个 ASCII 字符的合法文件名（`'a'.repeat(241)+'.csv'`）导入 `{code}\n00007\n` 时，按 `.csv` 正确解析；现有显示文件名上限 240 会截掉后缀。旧 snapshot 没保存 format，恢复时按 `{` 重猜成 JSON，错误地报 `JSON object keys must be quoted`。该缺陷属于本轮恢复实现，不应算成原 `42e014b` 已有问题。主代理给出的 before 证据为 `/tmp/printform-general-next-d80a577d-acb8-4470-b820-856951ffce83/general-consumer-before.json`；本 worker 没有重跑确认。

现在 snapshot 必须保存实际 `review.source.format`，严格只接受 `csv`／`json`。恢复复用既有 receipt 的显式解析约定：用 `local.<format>` 选择原有 CSV／lossless JSON parser，再保留 snapshot 中原来的有界显示名。内部解析选择名不会成为用户看到或下载 receipt 中的伪造源文件名。未增加第二解析器、未扩大文件名上限、未改原文或数值词形。

**文件名来源边界：** 当前 review／receipt 的 filename 是按既有规则最多 240 字符的显示值，可能只是原始长文件名的前缀，不承诺恢复已丢掉的后缀或完整原名。格式不再依赖该显示值。非法、缺失或与原文不符而解析失败的 format 不会回退到 sniffing；Keep 恢复失败仍保留 backup，当前项目不安装、不自动 Apply，成功恢复的 preview 也始终过期。

## 两种不同的导出合同

### 保留源的可携项目

顶部 **Save with source** 仍是原有 Save（包括 Ctrl/Cmd S）的默认合同：保存完整 active sampleData、schema、设计，以及存在时的 `manifest.localImport`。receipt 包含完整原文、文件名、scope 和 mapping，包括没有选中的原文件列。

顶部 **HTML with source** 仍将这些数据嵌入独立 HTML；与原行为一致，不偷偷删除用户溯源信息。

### 明确选择的分享副本

顶部 **Share copy…** 打开真实对话框，提供：

1. **Download editable share copy** → `printform-share.printform.json`，可在 Studio Open。
2. **Export share HTML** → `printform-share.html`，沿用当前真实渲染／验证门禁。

两个输出共用 `projectForSharing`，只对副本删除 `manifest.localImport` 和非持久的 session snapshot；不会修改源项目、原 receipt、脏状态、Undo／Redo 历史，也不另建数据存储。文件名固定为 share 名称，不把原 source filename 加入下载名称。

**隐私边界必须诚实：** 只存在于被删原文中的 unmapped source values 与 receipt filename 不进入分享文件。所有已经进入 live sampleData 的数据（包括未绑定／未打印字段）、映射值、打印值、标签、设计元数据、图片仍保留。若用户把原文件名或敏感文字另写进 live data／标签／标题，它也仍保留。这不是匿名化，不保证不可识别；用户须检查输出内容再分享。功能不自动上传，不扩大 AI 授权或发模型请求。

底层 APIs：`saveProject(project,{omitSource:true})` 与 `exportProject(project,report,{omitSource:true})`；缺省 `omitSource:false` 保留原 Save／HTML 合同。

## 已执行的有界覆盖

- `tests/studio-v3-file-workflows.test.js`：原生 File 读前大小拒绝；重叠导入；review 修改／取消；同 bus 新编辑及文档切换；非法 UTF-8、读取失败、JSON 失败及 retry；精确 UTF-8 边界；跨页映射不丢失；真实 Keep／restore 的 source+mapping 恢复，不自动 Apply。
- `tests/studio-v3-import-format-recovery.test.js`：长文件名＋`{code}` CSV 的 createReview→snapshot→restore→Preview→receipt→Save/Open；CSV／JSON BOM 与精确数字词形；格式篡改／缺失拒绝；被拒 Keep 保留 backup，当前项目不安装／Apply。这些规格已随完整隔离构建执行。
- `tests/studio-v3-export-privacy.test.js`：真实导入→历史提交→JSON Save/Open、source-only canary 缺席、完整 live data 与原 receipt／项目／历史守恒，以及缺渲染时拒绝 HTML。已删除依赖未构建 dist／动态 Vite URL 的非隔离 HTML 单元用例；独立 HTML 的正向证明来自以下真实浏览器下载，不用 mock/Blob observer 代替实际文件。
- `scripts/studio-v3-file-consumer-probe.mjs`：基线／修复版同一实际浏览器入口的四缺陷对照，以及已有 dataset size 护栏和失败后 retry。
- `scripts/studio-v3-share-consumer-probe.mjs`：先运行上一个探针安装真实 Blob observer，再从原 Save JSON 打开 fixture，操作实际 CSV scope／mapping／Preview／Apply，下载普通与分享 JSON／HTML，再 Open 分享文件。基线诚实报告 featureAvailable=false，不把缺失新功能伪装成通过。

## 桌面／手机验收路径

在隔离同源环境启动 Studio，先运行文件消费者探针；不要为了填结果重复已确认的旧缺陷。然后运行分享消费者探针，保留真实下载字节、读取计数、revision、canary 检查与 Open 后 sampleData/schema。

桌面与窄屏都应实际打开 Share copy 对话框，确认长隐私说明可读、按钮换行可点；下载 share JSON 与 HTML，检查 source-only canary 缺席而 `00007.500`／`-001.250` 等映射原词形不变。分享完成后，原标题、unsaved 状态及 Undo 可用性保持；再次 Save with source 应仍含原 receipt。最后 Open 副本确认可重开并在原生 print preview 检查实际打印页。此文不代替主代理的原生桌面／手机运行证据。

## 原生 Chrome155／sandbox 实际结果

- 10MiB+1 project 与2MiB+1 dataset均零次 native File 内容读取；非法UTF8明确拒绝。延迟Open不覆盖同bus新编辑；旧CSV不覆盖较新review；坏JSON后有效文件可重试，data/schema保留。
- 实际文件系统持有 ordinary/share JSON 与HTML。默认HTML保留原 filename／未选 source-only canary，分享两格式去掉它们；全部 live data（包括未绑定 canary）逐值保留，`00007.500`词形不变；分享前后均`r7 · unsaved template`、Undo可用、原receipt不变，分享JSON可重开。
- 250目标／250来源字段只呈现10个target select、2510个options；页1→25→1保留映射。一次本机初始可用92ms，含48次翻页与预览7963ms；不是基准或SLA。
- 另500行场景在第500行错误显式数值转换时禁止Apply，原实际Save data不变；合法版本预览500行、只显示前10行，实际下载500行逐项及完整原CSV一致。一次本机操作473ms；不推断所有250×500组合都可用，2MiB／50,000节点等界限同时生效。
- 六档CSS视口320×720、390×844、430×932、768×1024、1024×768、1440×900均实际截屏审阅，无全局横向溢出。320宽的长说明在modal内滚动，每个原按钮均可达；不声称所有按钮初始同时可见或真实手机/辅助技术认证。
- 原分享探针合成change后又原生blur导致额外title revision，首次状态比较false及真实r3→r5下载保留；改用真实Tab提交后前后状态一致。初始双视口控制器截图不匹配也保留，最终PNG尺寸与CSS视口逐一核对；不是产品失败或允许删除旧记录的理由。
