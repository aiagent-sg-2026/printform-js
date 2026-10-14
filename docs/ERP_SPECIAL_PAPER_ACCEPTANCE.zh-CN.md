# ERP 特殊纸张：浏览器与 PDF 验收矩阵

## 范围与证据状态

本矩阵针对真实 PrintForm 分页、真实独立 HTML 运行时与 Chromium PDF，**不代表打印机认证**。
2026-10-14 实际执行四个 profile × direct/standalone × 三引擎，**24/24 passed**；8 个 Chromium 场景实际解析 PDF，保持逐页纸型、文字、金额、日期、ID 与标签资产守恒。
不能从 DOM 的 `.physical_page_wrapper` 数量推断 PDF 已经正确输出。

四个 profile 同时进入 Chromium、Firefox、WebKit 的 screen/print 几何与内容断言。
Chromium 另外调用真实 `page.pdf()`，使用 PDF.js 读取 PDF 页树、每页物理尺寸和文本。
Firefox/WebKit 不伪造 PDF，不使用空白 PDF 替代，也不把 print media 仿真描述为真实打印驱动测试。

## 可执行文件与命令

- 输入：`tests/fixtures/special-paper.js`。
- 可复用场景：`e2e/special-paper-scenario.js`。
- 矩阵：`e2e/special-paper-matrix.spec.js`。
- 使用仓库已有 `playwright.config.js` 三引擎项目和 `scripts/serve-site.mjs`，不另设测试服务器。

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run build:site
npx playwright test e2e/special-paper-matrix.spec.js --workers=1
```

只检查 Chromium（包括 PDF）：

```sh
npx playwright test e2e/special-paper-matrix.spec.js --project=chromium --workers=1
```

`npm run test:e2e -- e2e/special-paper-matrix.spec.js --workers=1` 会通过已有 pretest 自动构建站点，
适合未预先执行 `build:site` 的环境。不要并行启动多个构建或让测试使用旧 `site-dist`。

矩阵为 4 profile × 2 路径 × 3 引擎，共 24 个已实际通过场景；其中 8 个 Chromium 场景解析 PDF。
普通 receipt/continuous 页数由实际字体与测量决定，不能把当前字体页数硬编码为设备认证。
label 由三条完整标签数据定义，预期为三张独立有限页面。

## 配置输入与尺寸

尺寸均为 **宽 × 高**。热敏宽度是本矩阵的名义 CSS 纸张宽度，不是某型号卷纸的精确公差。
`CSS_PX_PER_MM = 96 / 25.4`；PDF 点数为 `mm × 72 / 25.4`。

| profile ID | 物理 CSS/PDF 页面 mm | 左右 / 上下预留 mm | PrintForm 内容预算 mm | 输入特征 |
| --- | --- | --- | --- | --- |
| `thermal58` | 58 × 120 | 每侧 5 / 每侧 4 | 48 × 112 | 有限长度小票；长 CJK 18 次、RTL 12 次 |
| `thermal80` | 80 × 160 | 每侧 5 / 每侧 4 | 70 × 152 | 有限长度小票；长 CJK 24 次、RTL 18 次 |
| `label` | 100 × 70 | 每侧 5 / 每侧 4 | 90 × 62 | 三张明确尺寸标签；CJK 3 次、RTL 2 次；内嵌 PNG |
| `continuous` | 210 × 140 | 每侧 5 / 每侧 4 | 200 × 132 | 连续介质业务语义，输出仍为有限配置页；CJK 90 次、RTL 65 次 |

每个 profile 都有三条虚构源行，ID 为 `${PROFILE_ID大写}-001/002/003`；日期分别为
`2026-10-14`、`2026-10-15`、`2026-10-16`；原样供应金额为：

- `MYR 00123.4500`
- `SGD -0007.0050`
- `JPY 00042`

这些是需要保留的字符串，不是待重新计算的数值；不得截断尾零、改符号、统一币种或重新格式化日期/ID。
混合币种不求和，不补税、汇率、账务过账或付款执行。矩阵逐行、逐字段验证，不以“总字符数相同”替代金融字段守恒。
CJK、RTL 原文和重复次数位于 fixture，金额独占不换行的文本块；没有通过压小字体适配窄纸。

标签 PNG 是虚构提供方供应的 67 × 32 单色 Code39 参考图（`*A*`），展示为 134 × 32 CSS px，
带人读文本 `CODE39 A`。本矩阵不提供产品条码编码接口，不声明扫描器已经解码。

## 实际 API 与宿主纸张职责

`specialPaperFixture(profile)` 返回 `config/templateHtml/themeCss/sampleData` 与实际内容预算。
`openPaperScenario(page, context, fixture, mode, testInfo)` 有两条真实路径：

1. `direct`：真实 `validateProject` 和 `bindTemplate` 绑定输入，等待字体/图片后调用
   `window.PrintForm.format(source, fixture.config)`；DOM-Range 测量和分段来自产品运行时。
2. `standalone`：真实 `createStandaloneHtml(project, {runtimeSources, networkDisabled:true, requireTrusted:true})`
   使用项目验证、现有构建的双运行时和现有导出逻辑；写出独立 HTML 后通过 `file://` 打开，
   拦截所有 HTTP/HTTPS 请求并要求真实 `data-printform-status="ready"`。

两条路径使用同一数据、模板、配置、字体和边距。没有替换 renderer、模拟尺寸或向导出器注入“已通过”验证结果。

配置为 `dpi:96, nUp:1`，`papersizeWidth/papersizeHeight` 是扣除明确边距后的内容预算（CSS px）。
关闭 dummy row、footer spacer 和不存在的重复表头 (`repeatRowheader:false`)；`fillPageHeightAfterFooter:true` 使用现有分页器补足逻辑页预算。direct 路径先启动真实布局，再等待 `document.fonts.ready`，避免 WebKit 沿用上个 DOM 已兑现的 ready Promise。
`nUp=1` 保留宿主纸张职责，不自动注入 n-up 物理纸规则；所以本例显式提供：

- 真实物理 wrapper 的 mm 宽/高与 padding，对应上表纸张与预留边距；
- 每个 profile 的命名 `@page {size:宽mm 高mm; margin:0}`；
- print 下整个 mount 及 wrapper 的同一 `page` 名称，包含分页器生成的换页 divider；
- print 下移除屏幕预览页间距，保留真实分页器的换页，不裁剪、不隐藏溢出；
- Latin/CJK 为 `font:12px/18px Arial,sans-serif`；RTL 显式内嵌 Amiri 1.003、12px/24px，容纳实测 21px 字体框，不降字号；无 CSS zoom、transform 或 PDF fit-to-paper。

这是实际宿主布局，不是把 A4 内容缩放成 58/80mm。若业务需要 n-up，应使用现有 n-up scoped paper
输出并另行验收其缩放、纸张与可读性，不能把这份 `nUp=1` 矩阵误当 n-up 认证。

## 断言与输出证据

所有引擎、两条路径均检查：

- 完整源行与所有字段在续页片段中按原顺序拼回，金额、日期、ID 一次且完整；
- receipt/continuous 确实产生多页与语义行续页；label 三行保持三页、无额外碎片；
- screen 和 print media 下逻辑页、物理 sheet 的真实 `getBoundingClientRect()` 尺寸；
- 所有元素和真实文本 `Range.getClientRects()` 在内容预算内，scroll 宽高不越界；
- 无 hidden/clip 裁切，无 transform/zoom 缩放，字段字体仍为 12px，RTL 方向仍为 rtl；
- 标签图片加载成功、源 data URI 保持一致、自然尺寸与展示尺寸不变。

Chromium 使用 `preferCSSPageSize:true, scale:1, displayHeaderFooter:false`：

- 解析 PDF 实际页树并与真实逻辑页对应，发现额外空白页或分裂页即失败；
- **逐页**检查宽高，允许不足 1 PDF point 的浏览器纸张量化差；
- 按实际页面检查每个供应 ID、日期和金额的位置归属/出现次数，再检查全文件各一次；
- 按页检查 CJK/Arabic Unicode 字符频数（NFKC 归一化处理 PDF 字形连写形式），同时保留 DOM 原文完全相等的更强约束；
- 检查 PDF 文本坐标在声明的可用范围内；标签页面检查人读文本和实际 PDF image 绘制操作数量。

PDF 字符频数不是 RTL 阅读顺序或字形外观认证；DOM 原文/方向、截图和人工审阅仍需保留。
PNG 原始字节在 DOM 中守恒；PDF 绘制操作证明图像进入 PDF，但不声称 PDF 重新编码后的图像字节完全相同，
也不声称码制、静区、热敏打印密度或扫码等级合格。

每个成功执行的场景会生成 geometry JSON 与 print media PNG；Chromium 另附 PDF 和逐页 PDF 尺寸/文本 JSON。
独立路径的离线 HTML 保存在该场景的 Playwright output 目录。附件仅在执行到对应步骤时产生；失败场景以错误、trace
和实际已有附件诊断，不能补制通过报告。

## 连续纸不是无限页面

W3C page box 的宽高有限。浏览器屏幕 continuous media 与连续卷纸/针式连打介质不是同一概念。
`continuous` 在这里明确是 **210 × 140mm 的有限配置页面序列**；续页不丢数据，但不会形成无界纸带或自动裁刀指令。
换成 210 × 279.4mm 等业务页长时，必须同时更新 PrintForm 内容预算和宿主 `@page`/wrapper，并重跑全矩阵。

没有原生 endless spool、ESC/POS、ZPL、自动选纸、票据切刀、黑标/间隙传感器、针式套打/穿孔进纸接口。
不把将 PDF 发送到系统打印队列等同于直接控制打印机；实际卷纸/折叠纸的页长、进纸和切割由设备、驱动及用户设置决定。

## 未验证的设备边界与落地条件

| 边界 | 本矩阵证明什么 | 仍需真实设备/环境验证什么 |
| --- | --- | --- |
| 58/80mm 热敏 | 有限 CSS/PDF 页面、48/70mm 内容预算、守恒 | 实际卷纸公差、不可打印区域、驱动自定义纸长/页数上限、速度与密度 |
| 标签 | 100 × 70mm 页、供应 PNG/文字保留 | 该型号能否容纳 100mm 介质/90mm 内容、gap/black-mark 校准、撕纸/剥离/裁切、扫描成功率 |
| 连续纸/折叠纸 | 有限页序列、跨页完整 | 驱动页长、拖纸/穿孔对齐、打印队列、最大作业/页长与纸尽恢复 |
| 字体 | 内嵌 OFL Amiri 的 Arabic 与当前环境 Latin/CJK 文本/范围/PDF 字符 | 其它字体/系统组合、嵌入许可、实际 fallback、打印驱动栅格化；不是全部字体认证 |
| 金融供应值 | 原始金额/日期/ID 无损 | ERP 金额是否真实、业务金额关系/合计是否由上游验证；本矩阵不做新业务计算 |

具体厂商例子不能外推为认证：Epson TM-T20III Rev.A 手册 Appendix pp.80–81 指出名义 80mm
卷纸（79.5 ± 0.5mm）的最大打印区为 72.1 ± 0.2mm，名义 58mm 卷纸（57.5 ± 0.5mm）为
52.6 ± 0.2mm；本例对称 5mm 预留只是保守布局输入，**不是驱动边距校准结果**。
同手册 p.82 列出的切刀相对打印点距离并不等于 CSS 页边距；实际进纸与切割尚未试验。

Zebra ZD411T 手册 Introduction 的打印宽度为 56mm；因此**不能**凭本例 100 × 70mm 标签 PDF
声称该 2-inch 机型支持本 profile（90mm 内容预算已经超过其打印宽度）。
手册 Loading Roll Media、SmartCal 与 Troubleshooting 要求正确的 gap/notch、mark、continuous 类型和传感器校准。
这类设备设置不由 CSS 或 PrintForm 自动完成。

打印前应记录：浏览器版本、OS、已安装字体、打印机型号/固件、驱动版本、介质实际宽度/页长、
不可打印区、100% 缩放、关闭浏览器页眉页脚、背景图设置、裁刀/传感器模式。
若驱动自动缩放、拒绝自定义长度、裁断内容或字体缺字，应作为环境/设备或产品根因处理，不放宽守恒断言、隐藏溢出或降字号。

## 本轮实际缺陷与修复

- 三张精确 mm 标签原本变成五页：正文高度被 whole-pixel ceil，234.328125px 行与 234.33070866px 预算比较时被错误计为 235px，生成前后空白页。修复保留实测正文小数，仅使用一个 CSS layout unit 的边界容差；同一输入现为三页，每页一行，没有删除空白输出来掩盖错误。`npm run build:site` 完整 **222 files / 2,259 tests passed**。
- 所有 standalone 初次 blocked 的唯一 report 错误为 `ACTIVE_TABLE_HEADER_MISSING`；本例没有 authored header，却未关闭默认重复表头。已使用既有 supported 配置关闭，未更改产品错误语义；实际 offline report 另附，避免把启动页 snapshot 当作离线页。
- Chromium 151 的 ArialMT PDF ToUnicode 将源 U+064A `ي` 编成 U+FBFE，NFKC 后变成不同的 U+06CC `ی`。使用未修改的 Amiri 1.003 修正字体地图，源文不变：独立实际 PDF 原型 source/PDF U+064A 均为 60、PDF U+06CC 为 0；不同两字的额外探针也各保留两次，不通过混同字符放宽断言。
- 字体 assets 为 `e2e/fonts/Amiri-Regular.ttf` 与完整 `OFL-Amiri.txt`；`e2e/special-paper-font.js` 把 font 和 license 全部内嵌到 CSS/离线 HTML，HTTP attempts 为 0。font SHA-256 为 `cd2550c0f4c05eb341bf97958211aaa39382bca96577ba3a67d4a3b4912c43c0`，license 为 `72de68e5954f4fdd24702292ef5a32f003ca960ec9330dc86e5eefb5dffb9b22`。[8]
- Amiri 的 21px Range 框放在 18px 行高会在续页顶端越界 2px；本例显式扩大 RTL 行高到 24px，Latin/CJK 保留 18px，全部字号仍为 12px。未缩字、隐藏 Range、跳过失败 case 或裁剪内容。
- 相关141项旧分页/业务回归：138 passed、1 WebKit CCAR flaky（自动重试通过）、2 有意非 Chromium PDF-only skip。首次 CCAR 失败在 file navigation 等待 load event；改为 DOM parsed 后等待实际 runtime ready，六项 PCAR/CCAR 三引擎专项6/6通过，原金额/行数/越界断言未变。
- 真实 Chrome 另开离线 label 产物：ready、3页/3行，每张377.945×264.563px；三个金额原样、CJK、Amiri Arabic 与 Code39 reference image 已目视检查。只表示资产/文本保真，不表示扫描器或实际标签机认证。


## 官方依据（查阅日期：2026-10-14）

1. [W3C CSS Values & Units Level 3 §5.2](https://www.w3.org/TR/css-values-3/#absolute-lengths)：
   `1in = 25.4mm = 96px`，`1pt = 1/72in`；CSS px 与打印头 DPI 不相等。
2. [W3C CSS Paged Media Level 3](https://www.w3.org/TR/css-page-3/#page-size)
   与[当前工作草案 page model](https://drafts.csswg.org/css-page-3/#page-model)：有限 page box、size、设备相关不可打印区。
   Level 3 是工作草案，不能据此声称所有浏览器/驱动都实现全部特性。
3. [W3C CSS Fragmentation Level 3](https://www.w3.org/TR/css-break-3/)：页/列/区域的分片与换页控制，不定义打印机无限纸带协议。
4. [Chrome 官方：print margins/page model](https://developer.chrome.com/blog/print-margins)：
   `@page` 定义纸张与边距，内容按需要分页；浏览器自动页眉页脚须在打印设置中关闭。
5. [Playwright 官方 Page.pdf](https://playwright.dev/docs/api/class-page#page-pdf)：
   print media、尺寸单位、`preferCSSPageSize` 和 `scale`；默认不优先 CSS 纸张时可能 fit-to-paper。
6. [Epson TM-T20III Technical Reference Guide Rev.A](https://files.support.epson.com/pdf/pos/bulk/tm-t20iii_trg_en_reva.pdf)：
   pp.77–82 的 DPI、介质宽度/打印区及切割距离；手册另区分驱动与 ESC/POS 控制。
7. [Zebra ZD411T User Guide](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/product/zd411t-ug-en.pdf)：
   Introduction、Loading Roll Media、Run a SmartCal Media Calibration、Printer Fonts、Types of Thermal Media；
   continuous 介质的格式长度仍由驱动/软件配置，gap/mark/continuous 模式和字体另有硬件边界。
8. [Amiri 官方 1.003 release](https://github.com/aliftype/amiri/releases/tag/1.003) 与 [SIL OFL 1.1 license](https://github.com/aliftype/amiri/blob/1.003/OFL.txt)：所选字体及许可为原始发布文件，离线产物保留 license；许可不表示扫描、设备或全部字体认证。
