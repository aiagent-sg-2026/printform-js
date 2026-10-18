# Studio v3：实体打印／扫描与 WebKit 离线文件边界

## 本轮结论与已观察事实

2026-10-18 只读本机盘点：

- `/usr/bin/lpstat -p -d -v`：退出码 **1**；两条 `lpstat: No destinations added.`，`no system default destination`；没有配置好的 CUPS 打印目标。
- `/usr/bin/lpstat -p -d`：退出码 **1**；`lpstat: No destinations added.`、`no system default destination`。这是新 CLI 使用的无 URI 盘点方式，不输出打印机网络地址。
- `/usr/sbin/system_profiler SPUSBDataType -json`：退出码 **0**，原结果为 `{"SPUSBDataType":[]}`，没有可供绑定的 USB 设备候选。
- 这些命令不证明本机之外没有打印机，也不排除未暴露在 USB 盘点中的蓝牙／网络设备；没有探测网络、读取配对设备私有数据、发送打印／扫描任务或改变队列／设备。
- 本轮没有实体纸张、相机原照、独立量具读数及硬件扫描原始输出，所以 **physical gate = missing**。不能以数字条码、HTML、PDF、截图或人工填写的 JSON 补成已通过。

本切片新增可运行的只读盘点／证据检查实现。主集成代理已在隔离源码快照实际执行新增 `inventory`、无包 `check` 及物理证据消费者测试：测试文件通过；两个 CLI 均退出 **2**，打印队列 **0**、USB 候选 **0**，`check` 为 `missing／certified:false／physicalGate:missing`。没有提交打印或扫描任务；同批上游 fixture 的两项首次失败及后续修正另见[归属验证记录](STUDIO_V3_UPSTREAM_EVIDENCE.zh-CN.md#集成验证实录)，不混写成整批全绿。

## WebKit：已观察失败仍保留，不能冒充 Safari 结论

[此前实际失败记录](acceptance/STUDIO_V3_GENERAL_CAPABILITIES_20261017.md#浏览器失败历史)：同版本 WebKit 的 114 字节无脚本 HTML，online `file://` 成功，冷上下文 transport-offline `file://` 报 internal error。真实下载 328604 字节 HTML 的独立 data URL 离线执行／PNG 解码已成功，但它只证明内容能离线运行，**不替代 file 导航认证**。首次 Blob 解码失败以及原浏览器批次失败均保留。

本轮从本地安装元数据读取：`playwright-core` **1.62.0**；其 `browsers.json` 列 WebKit **26.5 / revision 2336**，并有平台 revision overrides。这是安装清单，不是一次新的 browser launch/version 或成功导航记录；没有安装／升级／更换浏览器。

### 2026-10-18 新取官方证据

1. [Playwright 官方 WebKit 说明](https://playwright.dev/docs/browsers#webkit)：Playwright 使用带补丁的 WebKit，不支持 branded Safari；WebKit main 与 Safari 发行节奏不同，平台能力也不同。因此 bundled WebKit 失败不能写成“Safari 已坏”，更不能把 Safari 手动成功当成 bundled WebKit 的通过。
2. [Issue #34402](https://github.com/microsoft/playwright/issues/34402)：2025-01-20 报告 1.49.1 在加载前 `setOffline(true)` 的 WebKit／Firefox 失败。GitHub API 当前 `state=closed`、`state_reason=not_planned`；[2025-01-29 关闭说明](https://github.com/microsoft/playwright/issues/34402#issuecomment-2621723478)是 stale triage，**不是修复证明**。其场景也不是本仓库的冷 `file://` 测试，不能直接当成同一根因。
3. [Issue #42775](https://github.com/microsoft/playwright/issues/42775)：报告 1.63.0 WebKit 对由 service worker 返回 literal/cache 响应的 HTTP 导航仍报 internal error。它是相关的离线导航证据，但不是 file 复现。
4. [PR #42894](https://github.com/microsoft/playwright/pull/42894) 已于 **2026-10-05** merge，merge SHA `ea75b9f32ca4120efdfaf8f5b8cfd292f548f197`；标题明确是 `allow service worker navigation while offline`。[实际 diff](https://github.com/microsoft/playwright/pull/42894/files)将 page target 初始化从仅发送 `offline:true` 改成配置存在时发送其实际 boolean，并新增 service-worker HTTP 导航测试，且 frozen WebKit 分支跳过该上游测试。该 diff **没有 cold file 导航回归测试**，不证明本地 1.62.0／2336 或原 file 条件已修复。
5. [v1.62.0 WebKit patch](https://github.com/microsoft/playwright/blob/v1.62.0/browser_patches/webkit/patches/bootstrap.diff) 中 `InspectorNetworkAgent::setEmulateOfflineState` 将参数交给 `platformStrategies()->loaderStrategy()->setEmulateOfflineState(offline)`；这说明 offline 是加载策略仿真，不等同于“只拦截 HTTP”。仅凭该源码不足以证明 file 失败的完整内部根因。

结论：最有证据支持的边界是**现有 bundled WebKit 的 transport-offline 本地文件导航前提不可用**；尚无在原条件下观察到的源无关驱动修复。保持 `e2e/studio-v3-offline-barcode.spec.js` 原 `browser.newContext({offline:true})` → `goto(fileURL)` 验收不变，不改 flags／sandbox／版本，不改用 data／HTTP／先 online 后 offline，不 skip／xfail。不因相关 PR merge 就改绿。

## 只读 CLI

仓库根目录运行：

```sh
node scripts/studio-v3-physical-check.mjs --help
node scripts/studio-v3-physical-check.mjs inventory
node scripts/studio-v3-physical-check.mjs check
node scripts/studio-v3-physical-check.mjs check /absolute/local-bundle/bundle.json
```

`inventory` 只执行固定的 `lpstat -p -d` 和 `system_profiler SPUSBDataType -json`；15 秒超时、每条最多 1 MiB。输出时间、命令／退出码／stdout+stderr SHA-256、CUPS queue、USB candidate identity hash。USB 原始 serial 仅参与 identity hash，不输出；USB candidate **不自动认定为 scanner**。命令不可用与确认为空分开报告。非 macOS 缺少相同绝对路径工具时 fail closed，不擅自选择替代工具或安装驱动。

`check` 每次取得新库存，然后只读显式指定的包及其相对引用文件。没有生成／提交／签署收据、打印或硬件扫描入口。输出中的 scanner `decodedValue` 仅来自原始硬件捕获文件的字节解码，不读取 SVG label。输出含供应条码值；应按其原有数据分类本地保管，不自动上传。

退出码：

| 码 | 意义 |
| --- | --- |
| 0 | 帮助，或库存具备打印队列＋USB 候选；**不是硬件验收通过** |
| 1 | 参数、严格 JSON、来源、hash、观察值、几何或证据结构非法 |
| 2 | 未给证据、工具不可用或对应设备不在新库存；`missing`／`no-device` |
| 3 | 文件及关联一致、设备存在，`supplied-for-independent-review`；**仍不是认证成功** |

所有 check 结果固定 `certified:false`。缺失／非法为 `physicalGate:missing`；结构完整也只能 `physicalGate:independent-review-required`。没有 JSON 中可写入的“approve”或“pass”字段。独立审查不能被 CLI 自己生产的收据替代。

## 显式证据包字段契约

严格 JSON：UTF-8 无损解码；元数据每文件最多 128 KiB；复用现有 `parseLosslessRecords` 拒绝重复键（包括转义后的同键）、prototype／constructor 字段、尾随文本、过深结构，然后保留原 JSON 数字／字符串类型。不允许额外字段。引用文件最多 20 MiB、包累计读取最多 80 MiB；不执行 HTML／PDF／图片／脚本。

每个文件引用均**恰好**为 `{path,digest,mediaType}`：`digest` 为精确原始字节 `sha256:`＋64位小写 hex；`path` 相对于 bundle 所在目录，每段仅字母数字开头及字母数字／`.`／`_`／`-`，拒绝绝对路径、`.`／`..`、URL、反斜杠和任一层符号链接，只读非空 regular file。不跟随来源文本中指令或隐式发现其它文件。

读取前冻结 canonical base、路径各层 `lstat` 的 dev/ino；打开使用 `O_NOFOLLOW | O_NONBLOCK`，先确认 regular file／额度，再对比打开 descriptor 的 dev/ino 与原路径身份，并重新确认整条路径身份和 realpath containment，之后才消费字节。读取后再次检查 descriptor 大小／mtime／ctime、路径每层身份及 containment；相同字节但被替换的文件／祖先目录也拒绝。读取缓冲按已检查大小有界，文件增长不能触发无界读取。

这是 Node 可移植文件 API 的前后快照防护，**不是原子 `openat`／`openat2` 或恶意主机隔离保证**：Node 标准 API 未在这里提供以已打开目录 descriptor 为锚的逐层打开；有权限并发改动整棵树、跨检查来回切换的对手不在可证明范围。证据包应置于本地可信、无其它写入者的目录；签名／hash 也不能补足真实相机／纸张／人的观察。测试用真实文件 rename／copy／symlink，在确定的打开／读取边界触发替换，不用调度概率冒充覆盖所有 race。

根对象恰好含以下字段：

| 字段 | 契约 |
| --- | --- |
| `schema` | `studio-physical-evidence-v1` |
| `id`, `sourceAuthor` | 本次实体样张唯一标识、来源作者标识；不为空且最多240字符，无控制字符 |
| `source` | `application/json` 精确供应项目／数据快照引用；条码 pointer 相对于此文件根，例如 `/sampleData/codes/ean13` |
| `artifact` | 真正用于打印的导出文件引用；`text/html` 且有 HTML doctype，或 `application/pdf` 且有 PDF magic；记录下载的真实字节，不是传给 Blob 的推测字符串 |
| `printer` | 恰好 `{queue,model,dpi}`；queue 必须在新 CUPS 库存中，型号需另核设备铭牌；dpi 为正有限数值 |
| `scanner` | 恰好 `{usbId,model,firmware,mode}`；usbId 必须匹配新库存，mode 固定 `hardware-barcode-reader`；库存不能独自证明实际读码的就是该设备 |
| `media` | 恰好 `{id,type,widthMm,heightMm}`；id 标识纸张／标签批次与样张，type 记介质，尺寸单位 mm，正有限数值 |
| `print` | 恰好 `{operator,printedAt,scalePercent}`；scalePercent 数值100（不能字符串或 fit-to-page）；printedAt 为 UTC ISO 时间 |
| `capture` | 恰好 `{observer,method,capturedAt,artifact}`；method 固定 `camera-photo-of-physical-sheet`，artifact 为相机拍摄该实体样张的 PNG/JPEG 原图引用 |
| `measurements` | `application/json` 独立测量文件引用，见下表 |
| `symbols` | 2–16项，包含 CODE128 与 EAN13 两种，id 不重复 |

日期使用严格 `YYYY-MM-DDTHH:mm:ss.sssZ`；照片不得早于打印，不得在未来；观察者必须与 print operator、sourceAuthor 都不同。PNG/JPEG magic 仅作**文件类型初筛**，拒绝 SVG／文字标签直接重命名的提交；它不做完整图片解码，也无法辨别数字截图、损坏图片、伪造相机来源或人的真实独立性。没有添加图片解码依赖，必须看原纸张／相机来源及保管链，不会自动放行。

每个 `symbols` 元素恰好 `{id,format,pointer,scan,terminator}`：

- format 只 CODE128／EAN13；pointer 是严格 RFC6901 绝对 pointer，从实际 source bytes 解析，值必须为符合现有条码规则的字符串；不修剪／补零／计算 check digit／转换数字。
- scan 是硬件扫描器实际输出的 `text/plain` 原始捕获文件，不是人抄写期望值、截图 OCR、SVG 几何 oracle 或由 source 复制的文件。
- terminator 显式指定 `none`／`LF`／`CRLF`／`CR`；文件必须**逐字节等于**供应字符串＋该 terminator，不允许额外前缀／后缀／第二条读数／前导零丢失。捕获应使用独立终端记录并保留硬件、模式、时间与操作者的外部保管证据；本 CLI 不自行发起扫描。

测量文件恰好含：

| 字段 | 契约 |
| --- | --- |
| `schema` | `physical-measurement-v1` |
| `evidenceId` | 等于根 id |
| `sourceDigest`, `artifactDigest`, `captureDigest` | 等于供应源、实际导出与相机原图精确 hash |
| `printerQueue`, `scannerUsbId`, `mediaId`, `observer` | 与根记录精确相同，不能拿其它设备／纸张／作者的记录套用 |
| `measuredAt` | 不早于照片及量具校准，不在未来 |
| `instrument` | 恰好 `{id,model,calibratedAt}`，独立量具身份与校准时间；原校准证据仍需独立审查 |
| `mediaWidthMm`, `mediaHeightMm` | 实体纸张实际读数，不是 CSS 尺寸，正有限数值 |
| `clipped` | 必须 boolean false，不能剪掉条码或 quiet zone |
| `symbols` | 与根数量相同，每个 id 恰好匹配一次 |

每项测量恰好 `{id,format,scanDigest,moduleWidthMm,barHeightMm,quietLeftMm,quietRightMm}`。format／scanDigest 关联根真实 scan 引用；其余为独立量具实测 mm 的正有限数值（所有数值字段上限10000只是输入大小边界，不是设备能力认证）。CODE128 左／右 quiet zone 至少10模块；EAN13 左11／右7，沿用现有条码 quiet-zone 约束，不降低门槛。

本工具不从供应声明猜测打印机能力，也不由量具数字推断打印 scale、导出与来源语义完全一致、相机原图真实性、解码器真实硬件来源或 GS1 资格。独立审查必须把原始来源／打印导出、原纸张、纸张介质、量具读数与相机视图、原始硬件扫描记录对应起来；数字截图解码只能记数字证据。只能在有真实设备和这些独立观察后由有权验收者另行决策，不能直接引用 CLI 的一致性状态为实体通过。

## 已执行验证与可复验入口

```sh
npm test -- --run tests/studio-v3-physical-evidence.test.js --maxWorkers=1 --no-file-parallelism
node scripts/studio-v3-physical-check.mjs inventory
node scripts/studio-v3-physical-check.mjs check
```

安全测试覆盖：缺证据／无设备、严格 JSON、路径／目录符号链接逃逸、lstat→open 文件／祖先替换（拒绝且不消费替换文件字节）、读取后相同字节祖先替换、字节篡改、原始扫描前导零／终止符／额外内容、非字符串来源、SVG／label 冒充、数字截图来源、作者自证、测量／扫描 hash 串用、quiet zone／裁切、重复符号、额外认证字段及 CLI 非法参数。完整结构的测试输入明确为 synthetic digital fixture，断言它**永远不产生 certified:true**；不是实体打印／扫描通过记录。

原 WebKit file spec 未改；主代理只有在新的独立证据确实支持且保留原验收条件时才能另记结果，不能仅为确认已知失败而重跑。当前无设备是完整而明确的缺失结论；工具、契约和安全消费者已实现，不以伪造提交、自动批准或“用户日后自行补做”充当完成。
