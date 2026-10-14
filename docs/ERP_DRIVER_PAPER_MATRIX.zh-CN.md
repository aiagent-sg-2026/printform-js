# ERP 打印：Letter／Legal 与驱动／介质边界矩阵

## 本次范围与证据分层

新增的是有限 **Letter／Legal portrait／landscape** profile 和可执行浏览器／真实 PDF 验收，不重复 A5、50×30 标签或连续纸旧矩阵，不改变分页引擎，不把 CSS 页尺寸当作设备可打印区。

证据分为：①原始来源与浏览器排版，②真实 PDF page tree／物理坐标，③OS 队列／驱动设置，④实际设备、介质、进纸／切纸与可读性。本切片只实现①②的验收代码；③④不能被前两层替代。

集成负责人已实际执行本机 `lpstat -p -d`，返回 exit 1：

```text
lpstat: No destinations added.
no system default destination
```

因此 macOS 当前没有可用 CUPS 打印队列／默认 destination，**没有发送任何打印作业，也没有 Epson／Zebra 现场认证**。此实际环境证据由集成负责人提供；本切片没有重复查询或谎称设备可访问。

新增profile实现与实际执行分开记录；下表状态及末节只采用观察到的运行结果，不把“可执行”写成“已通过”。

## 固定有限纸张预算

`tests/fixtures/letter-legal-paper.js` 复用既有 `specialPaperFixture`，`e2e/letter-legal-paper-matrix.spec.js` 复用 `openPaperScenario`、`inspectPaperScenario` 和既有离线字体助手。

| profile | 物理宽×高 mm | PDF 宽×高 pt | 四侧作者 inset | 逻辑内容宽×高 mm |
| --- | --- | --- | --- | --- |
| letterportrait | 215.9×279.4 | 612×792 | 10 mm | 195.9×259.4 |
| letterlandscape | 279.4×215.9 | 792×612 | 10 mm | 259.4×195.9 |
| legalportrait | 215.9×355.6 | 612×1008 | 10 mm | 195.9×335.6 |
| legallandscape | 355.6×215.9 | 1008×612 | 10 mm | 335.6×195.9 |

换算严格为 CSS `96px/in`、PDF `72pt/in`、`25.4mm/in`。`@page` 用显式物理宽高／margin:0；物理 wrapper 的 padding 承担作者 inset。10mm 是此 fixture 的版面选择，**不是任何打印机／驱动的保证值**。

不启用 fit-to-page、transform/zoom、overflow:hidden/clip、字体缩小或截断。每个 profile 分 one-row／multi-row，再分 direct formatter／真正 standalone export。one-row 必须一页；multi-row 必须实际多页且有内容拆分，不能填充假行凑页数。

## 可执行浏览器／OS／目的地矩阵

| 浏览器引擎／宿主 OS | 目的地／驱动 | 介质与模式 | 可观察验收 | 当前状态 |
| --- | --- | --- | --- | --- |
| Playwright Chromium／集成宿主 macOS | 浏览器内建 page.pdf，无实体驱动 | 四 profile × one/multi × direct/standalone | 真实PDF页树、mm/pt、逐页ID/日期/原样金额、CJK/RTL、坐标/字体；screen/print对照 | 实际16/16通过，16份真实PDF |
| Playwright Firefox／集成宿主 macOS | 浏览器formatter，不伪造PDF | 同上 | screen/print几何、来源顺序、无溢出/剪裁/缩放、12px字体、RTL、离线file:ready | 实际16/16通过，无PDF能力冒称 |
| Playwright WebKit／集成宿主 macOS | 浏览器formatter，不冒充Safari驱动 | 同上 | 同Firefox；不等于Safari系统打印面板或AirPrint认证 | 实际16/16通过，不认证系统驱动 |
| 实际 Chrome／Windows 或 Linux | 系统 printer queue 或 Save as PDF | Letter／Legal，正确 portrait/landscape | 目的地、paper、比例、margin、页眉页脚、纸盘的现场截图／PDF | 未现场认证，不从 macOS 外推 |
| 实际 Firefox／Windows 或 Linux | 系统 queue／厂商驱动 | Letter／Legal | Original format、比例100%、1 page/sheet，逐页审查来源与边界 | 未现场认证 |
| 实际 Safari／macOS | macOS Print dialog／CUPS／AirPrint | Letter／Legal；driver 必须实际支持 | 纸型匹配、100%而非Scale to Fit、非Printable Area裁剪、选择纸盘 | 无可用队列，未现场认证 |

48 个引擎测试组合来自 4 profile × 2 coverage × 2 runtime mode × 3 browser；其中只有 Chromium 的 16 组合生成真实 PDF。Firefox/WebKit 没有 page.pdf 产物，不能把其几何检查写成 PDF 验证。

## 自动验收实际断言与产物

- 所有作者数据均 fictional；`id`、`date`、`amount` 原字符串必须逐行无丢失、无重排、无重复。金额素材刻意包含 `MYR 00123.4500`、`SGD -0007.0050`、`JPY 00042`，不调用默认货币 formatter。
- CJK 与 Arabic 字段原文逐 row 拼接守恒；所有来源 ID／日期／原样金额在整份输出各出现一次。RTL 使用既有内嵌 Amiri 1.003 字体与许可证，12px，24px line-height；不缩字。
- screen 与 print 的页面字段一致；每个逻辑页与 physical wrapper 按真实 mm→CSS px 量测，所有文字 range／元素都在预算内，没有 overflow、缩放或隐藏剪裁。
- Chromium 实际 `page.pdf({preferCSSPageSize:true,scale:1,displayHeaderFooter:false})`；PDF.js 检查 page tree 页数等于 formatter 物理页数，尺寸误差 <1pt，每页 ID／日期／金额归属正确，CJK/Arabic NFKC 字符计数守恒。
- PDF 每个非空 text item 的 x／y 坐标必须在作者 inset 内；字体 item.height 必须对应原12px的9pt，不许缩小字体掩盖分页错误；字体 style 映射存在。
- 产物为实际 `.pdf`、`*-pdf-pages.json`（page bounds、text、fontName、font styles、transform）、`*-geometry.json`、print screenshot，以及既有 standalone runtime report。若某引擎阻断／overflow，保留真实失败，不伪 ready。

集成负责人串行运行；不提高现有 deadline，不裁减断言：

```sh
npm run build:site
npx playwright test e2e/letter-legal-paper-matrix.spec.js --workers=1
```

若只分批执行某引擎，必须三者都最终覆盖并分别保留报告：

```sh
npx playwright test e2e/letter-legal-paper-matrix.spec.js --project=chromium --workers=1
npx playwright test e2e/letter-legal-paper-matrix.spec.js --project=firefox --workers=1
npx playwright test e2e/letter-legal-paper-matrix.spec.js --project=webkit --workers=1
```

before 是不存在 Letter/Legal 新 profile／物理PDF组合覆盖，不声称原引擎必然无法打印这两种纸。本次不是把已有 A5 结果改名作 Letter/Legal 证据。

## 官方打印设置依据

2026-10-15 实际查询的官方来源：

1. [Google：Print from Chrome](https://support.google.com/chrome/answer/1069693?hl=en)：选择 destination 与首选打印设置；设备初始化遵循厂商说明。浏览器打开 Print 不证明驱动已接受正确纸型。
2. [Mozilla：How to print web pages in Firefox](https://support.mozilla.org/en-US/kb/how-print-web-pages-firefox)：官方搜索结果明确列出 More settings 的 Paper size、Scale、Pages per sheet、Margins、Original/Simplified、headers/footers、backgrounds；正文读取受 Client Challenge 阻挡，未伪称已成功读取全文。
3. [Apple：Choose a paper size](https://support.apple.com/guide/mac-help/choose-a-paper-size-printed-document-mac-mh26678/mac)：paper size 匹配实际纸张。
4. [Apple：Reduce or enlarge pages](https://support.apple.com/guide/mac-help/reduce-enlarge-pages-fit-a-page-mac-mchlb55f61d4/mac)：系统可缩放文档适配另一纸型，因此 UI 显示一页不等于物理尺寸保真。
5. [Apple：Custom paper size](https://support.apple.com/guide/mac-help/print-unusual-sized-paper-creating-a-custom-mchlp15541/mac)：非标准纸要设置自定义 paper size；不能据此宣称设备支持该介质。

本项目现场操作基准：实际支持的纸型、正确方向、100% scale、1 page/sheet、关闭浏览器额外页眉页脚、与 fixture 一致的 margin／背景设置。以上是待验收条件，不宣称所有浏览器／OS 的设置菜单相同。

## Epson／Zebra 型号与介质／驱动边界

官方资料：

- [Epson TM-T88VII Technical Reference Guide Rev. G](https://files.support.epson.com/pdf/pos/bulk/tm-t88vii_trg_en_revg.pdf)：p52 纸宽切换，p97 Windows APD／Mac CUPS raster／Linux CUPS raster 驱动，p117–121 打印宽度与左右不可打印区。
- [Zebra ZD421 Technical Specifications](https://www.zebra.com/content/dam/zebra_dam/en/tech-specs/zd421-tech-specs-en-us.pdf)：203dpi 打印宽104mm，300dpi108mm；介质宽因 t/c/d 子型号不同；说明明确要求按实际应用充分测试。
- [Zebra ZD421 官方支持／驱动与校准流程](https://www.zebra.com/us/en/support-downloads/printers/desktop/zd421.html)：推荐 Windows Printer Driver v10、先装驱动后连接USB；设置匹配实际介质；SmartCal；换尺寸/类型或出现漏标漂移时重新校准。不能把 v10 自动替代为已测版本。

| 浏览器／OS | 明确型号／驱动 | 介质／官方有限边界 | Letter／Legal 结论 | 现场状态 |
| --- | --- | --- | --- | --- |
| Chrome／Firefox，Windows | Epson TM-T88VII／EPSON APD，版本待现场记录 | 79.5±0.5mm卷纸，典型可打印72.2±0.2mm／512dot；48-column模式另为67.7mm | **不适用**：不是Letter/Legal sheet printer；不得把215.9mm页缩成80mm再称原尺寸通过 | 无设备，未现场认证 |
| Safari／Chrome，macOS | TM-T88VII／厂商Mac CUPS raster driver，版本待记录 | 57.5±0.5mm卷纸，可打印50.8±0.2mm／360dot；左约3.7mm、右约3.0mm；纸宽硬件/软件配置须一致 | 不适用Letter/Legal；现有58/80mm CSS名义纸预算不自动证明该可打印区 | 当前无CUPS队列；未现场认证 |
| Chrome／Firefox，Linux | TM-T88VII／TM Series CUPS raster driver，版本待记录 | 同型号80/58mm，但OS栅格、切纸／留白设置须独立测量 | 不适用Letter/Legal，不从Windows/Mac转移认证 | 无设备／队列证据，未现场认证 |
| Chrome／Firefox，Windows | Zebra ZD421d 203dpi／Windows Driver v10，确切build待记录 | 介质宽15–108mm，最大打印宽104mm；die-cut/continuous/gap/black-mark按实际配置 | **不适用**Letter/Legal；不能用“最大长度991mm”掩盖打印宽不足 | 无设备，未现场认证 |
| Chrome／Firefox，Windows | Zebra ZD421t 或 c，203/300dpi／对应厂商驱动 | t介质15–112mm、c介质15–118mm；203dpi104mm／300dpi108mm打印宽；TT还需正确ribbon | 不适用Letter/Legal；子型号、DPI、介质宽和打印宽不可混用 | 无设备，未现场认证 |
| Safari／macOS 或浏览器／Linux | Zebra具体队列／CUPS/IPP路径未提供 | 不把Windows driver证据当作Mac/Linux驱动证据；须记录实际队列、协议、纸型、传感器与校准 | 没有设备支持证明；不得发Letter/Legal作业伪测 | 未配置／未现场认证 |

Epson／Zebra 行用于明确已有热敏／标签方向与新 sheet profiles 的边界，**本次不重复旧特殊纸自动矩阵，也不伪造新设备实测**。Letter/Legal 真纸验收需要另一台明确支持该 sheet size 的打印机及其型号、驱动和纸盘资料；当前没有可访问设备，故不认证任何 Letter/Legal 实体输出。

## 现场才能补齐的验收记录

每一条真实设备结果需保存：OS/build、实际浏览器/version、printer型号/firmware/DPI、driver名称/version、连接协议和queue、实际介质尺寸/类型/纸盘、paper size/方向/比例/margin截图、原始HTML与PDF、实际输出照片／尺量可打印区、进纸/切纸/漏标/漂移、CJK/RTL/金额可读性。编号／日期／金额必须与来源逐条核对，不能只看总页数。

若设备纸型不支持、驱动自动缩放、不可打印区裁切或跨页漏字段，应记录不通过／不适用，调整明确模板预算或设备设置后重新验收；不得隐藏文字、缩字、重算金额、伪造 ready 或把 headless PDF 当成实体合格证。

## 实际集成记录（2026-10-15）

- Node24完整228文件/2406项通过，runtime/site/agent gate完成；专项ERP相关四文件247项通过。该结果不替代纸型的浏览器/PDF/设备验证。
- 复核Apple实际打印选项正文及Zebra ZD421原PDF：系统可另设paper size/scale/tray，203/300dpi最大打印宽分别104/108mm，介质子型号宽度不同；资料明确要求真实应用测试。没有把驱动名义支持或991mm最大长度冒充Letter/Legal宽度能力。
- Letter/Legal完整三引擎 **48/48通过，0重试/0失败/0跳过**；实际Chromium16份PDF均核对页树、尺寸、9pt字体、全部文字坐标及来源字段守恒。Legal横向真实PNG已查看；归档`/tmp/printform-letter-legal-acceptance-20261015.tar.gz`保留离线HTML、截图和PDF证据。
- 同轮原生Payment18、旧settlement12、transaction27、原始return15另通过；完整五文件合计 **120/120**。新增实际PDF为Payment6+本矩阵16共22份；各完整文件新进程、无retry，不提高deadline。物理队列/设备仍未认证。
