# ERP 扩展纸张：A5 横向、小标签与有限连续纸

## 范围与执行状态

新增真实消费者验收，不改动原特殊纸张矩阵、helper 或核心分页器：

- `tests/fixtures/additional-paper.js`：复用既有 `specialPaperFixture`，只添加纸型、明确源行和小标签布局。
- `e2e/additional-paper-matrix.spec.js`：复用既有 direct / 独立 HTML 场景与字体 helper。
- 本文件：尺寸、官方约束、运行命令和设备边界。

本轮编写阶段**未执行构建或测试**；下面是可执行验收要求，不是已经通过或获得硬件认证的报告。
3 纸型 × one-row / multi-row × direct / standalone × Chromium / Firefox / WebKit = 36 场景；
其中 12 个 Chromium 场景生成并解析真实 PDF。父任务集成后串行执行并记录真实结果。

## 配置矩阵

尺寸为宽 × 高。物理页面、wrapper padding 与 PrintForm 内容预算同时配置，`dpi:96, nUp:1`。
CSS px 按 `96 / 25.4` 换算，PDF point 按 `72 / 25.4` 换算；这不是打印头 DPI。

| profile | 名义 CSS/PDF 页面 mm | 每侧水平 / 垂直预留 mm | 内容预算 mm | multi-row 输入 |
| --- | --- | --- | --- | --- |
| `a5wide` | 210 × 148 | 5 / 5 | 200 × 138 | 3 条原始行，长 CJK / RTL 产生真实续页 |
| `label50` | 50 × 30 | 2 / 2 | 46 × 26 | 3 条独立短标签，每条完整占一页 |
| `fanfold280` | 210 × 280 | 13 / 5 | 184 × 270 | 3 条原始行，明确有限页长、长 CJK / RTL 续页 |

每种纸型另有 **one-row** 输入：仅保留第一条原始金额/日期/ID，使用明确短 CJK/RTL 内容，
要求一个源行、一个片段、一个实际页面；不复制行来凑页数。
长文使用既有虚构维护说明，重复段落是分页压力输入，不是生成重复业务行。

原始金额字符串保持 `MYR 00123.4500`、`SGD -0007.0050`、`JPY 00042`，日期保持
`2026-10-14/15/16`。大纸 ID 来自既有 fixture 的 profile 大写前缀；小标签为
`L50-001/002/003`，短 CJK 分别为 `巡检甲/乙/丙`，RTL 为 `فحص`、`سجل`、`تم`。
金额不做 numeric coercion、求和、税额/汇率推导、过账或付款；不声称实时 ERP 已连接。

小标签保留 12px 字号，Latin/CJK 行高 18px，内嵌未修改 Amiri 的 RTL 行高 24px；
三条 Latin 行 + 一条 CJK + 一条 RTL 共 96 CSS px，内容高约 98.27px。
不压缩字号、不使用 zoom/transform、不隐藏溢出。每条标签的 table 显式占用内容页高，
source/processed selector 都保留该高度，不插入 dummy row。
50 × 30mm 不塞入既有 134 × 32px Code39 参考图及人读标题；这不是丢弃供应资产，
本 fixture 的 barcode 字段明确为空、模板没有图片。原 100 × 70mm 标签矩阵仍负责资产保真。
既有 Code39 PNG 是供应参考资产，**不是编码器、扫描器或条码质量认证**。

## 横向与连续纸限制

W3C CSS Paged Media §7.1 的 `size` 语法中，长度分支和纸型名称/方向分支是不同选择：

```css
/* 两个长度依次为宽、高，本矩阵使用这种写法 */
@page paper_a5wide { size: 210mm 148mm; margin: 0; }
/* 标准纸型名称可与方向组合，是另一种合法写法 */
@page example { size: A5 landscape; }
/* 不采用：size: 210mm 148mm landscape; */
```

A5 的标准纵向尺寸是 148 × 210mm，横向 page box 为 210 × 148mm。
不能给两个显式长度再附 `landscape`，也不能把 CSS transform 旋转当作纸型配置。
`page-orientation: rotate-left/rotate-right` 是**排版后的输出旋转**，不是重新分配内容宽高；
本矩阵不依赖它，不宣称跨引擎旋转、反向横向、双面装订或混合方向作业已经验收。
W3C 文档是草案，实际引擎行为仍由消费者几何/PDF 检查证明。

`fanfold280` 是 210 × 280mm 的有限 page box 序列，**不是无界纸带**。
280mm 也不等于 11in（279.4mm），不偷换成常见英制穿孔节距。
浏览器 screen 的 continuous media 与针式拖纸/卷纸介质不是同一个概念。
没有新增 ESC/P、ESC/POS、ZPL、裁刀、黑标/间隙传感器、穿孔对齐或 endless spool 控制。

## 官方设备约束：尺寸不等于认证

### Epson LX-350

官方 User’s Guide 的 Paper / Recommended printable area（PDF pp.85–86）区分：

- 连续纸宽 101.6–254mm，每页长度 101.6–558.8mm。
- 连续纸左右最小边距各 13mm，穿孔上下最小边距各 4.2mm；最大打印宽 203.2mm。
- 单页纸左右最小边距各 3mm，上下各 4.2mm；最大打印宽也为 203.2mm。

因此 fanfold fixture 用水平 13mm、垂直 5mm 和 184mm 内容预算，而不是把整个 210mm
纸宽称作可打印宽。A5 fixture 的 200mm 内容预算也不等于驱动已校准。
这些数字说明布局预留的依据；仍未验证具体驱动接受 280mm 页长、拖纸孔、穿孔、
多联纸厚度、top-of-form、skip-over-perforation 或真实进纸。不能由范围内尺寸推导设备认证。

### Zebra

ZD411T 官方指南 Introduction（PDF p.11）给出 203/300dpi 版本打印宽均为 56mm；
General Media and Print Specifications（p.175）给出 ZD411/611 介质最大宽 57mm、
系列最小介质宽 15mm。这里 **57mm 介质宽不是 56mm 打印宽**。
本例 50mm 名义纸宽 / 46mm 内容预算没有越过这两个数字，但不能据此断言已适配实际标签机。

ZD421/621 官方 media specifications 另列出 Direct Thermal 最大介质宽 108mm、
Thermal Transfer ZD421/421CN 112mm、ZD421 Cartridge/621/621R 118mm，
Tear Off / Label 的最小长度 6.35mm、Peel 的最小长度 12.7mm；型号与选件不得混用。
50 × 30mm 的标签面尺寸不等于 backing liner 宽度/厚度、gap、black mark、卷芯与卷径均已合格。
仍需实际打印宽设置、SmartCal、驱动纸型、传感器、打印密度及真实设备验收。

## 消费者断言与证据

三引擎、两条路径都执行真实 `validateProject/bindTemplate/PrintForm.format` 或
`createStandaloneHtml` 导出后的实际离线运行时。离线产物通过 `file://` 打开，既有 helper
阻断 HTTP/HTTPS，要求 `ready`；使用内嵌 Amiri 字体与原始 OFL license，不模拟 renderer。

每个 screen / print 场景检查：

1. 将真实续页片段按源行索引拼回，全部字段与原始行完全相等；行顺序不倒置、不漏行。
2. ID、日期、原样金额全作业恰好一次；小标签逐页全部字段与对应原始标签相等。
3. one-row 必须一页一片段；大纸 multi-row 必须真实多页与续行片段；小标签恰好三页。
4. 逻辑内容页与物理 sheet 的真实尺寸、所有元素与文本 Range 边界、scroll 宽高。
5. 没有 hidden/clip 裁切、transform/zoom 缩放，字段仍为 12px、RTL 方向为 rtl。
6. screen/print 完整行值和逐页字段相同，生成 geometry JSON 与 print PNG。

Chromium 使用 `page.pdf({preferCSSPageSize:true, scale:1, displayHeaderFooter:false})`：

- PDF.js 解析**实际 PDF 页树**，页数必须与实际逻辑页一致，不用 wrapper 数替代 PDF 检查。
- 每页实际尺寸与目标 mm 换算 point 相差小于 1pt，发现空白增页/拆页即失败。
- **逐页**验证 ID/日期/金额的出现次数与该逻辑页对应；全 PDF 各源字段恰好一次。
- 逐页 CJK/Arabic 字符频数守恒，NFKC 仅处理 PDF 字形连写；DOM 原文完全相等仍是更强约束。
- PDF 每个非空文本 item 的水平范围/基线在声明内容边距内，附件记录文字、宽高与 transform。
  这不是 PDF glyph 轮廓或 RTL 视觉阅读顺序认证；DOM Range 约束和 PNG 人工审阅仍需保留。
- 附加真实 PDF 与逐页尺寸/文本/坐标 JSON；Firefox/WebKit 不伪造 PDF。

附件仅在真正执行到对应步骤后产生；失败场景不能补制成功证据。
打印前仍须记录浏览器/OS/字体、型号/固件/驱动、实际介质及不可打印区，100% 输出、
关闭页眉页脚，并实测进纸/穿孔/裁切。自动缩放、字体缺字或裁断应修根因，不能放宽原样字段断言。

## 父任务执行命令

先完成依赖安装与浏览器准备；已有环境不重复安装。一次构建后串行运行：

```sh
npm run build:site
npx playwright test e2e/additional-paper-matrix.spec.js --workers=1
```

只执行 Chromium（包含 12 个真实 PDF 场景）：

```sh
npx playwright test e2e/additional-paper-matrix.spec.js --project=chromium --workers=1
```

需同时回归旧矩阵时，在同一构建后执行：

```sh
npx playwright test e2e/special-paper-matrix.spec.js e2e/additional-paper-matrix.spec.js --workers=1
```

### 实际集成记录：2026-10-15

- Node24 完整 `build:site` **226 files / 2,351 tests passed**，runtime/site/agent gate 成功；没有同时运行完整单测和浏览器。
- 新三纸型 × one/multi-row × direct/offline × 三引擎 **36/36 passed**；旧四纸型24项、原始退货15项、canonical transaction27项、settlement12项同一轮，合计 **114/114 passed**，无 retry/flaky/skip。
- Chromium 新纸型 **12 份真实 PDF**，页树、mm/pt尺寸、逐页来源字段与字形频数、文本坐标全部实际断言；Firefox/WebKit 只声明实际 DOM/Range/screen/print 几何，不伪造 PDF。
- 实际查看 Chromium A5横向、50×30mm三标签、210×280mm有限连续页的完整离线 print PNG；打印原样金额及 CJK/RTL 保留。截图视口空白不代表额外物理 PDF 页，页数以实际 PDF 页树验收。
- 仅这些有限 profile/fixture 获得上述 browser/PDF 记录；实体介质、不可打印区、驱动、切刀、穿孔、传感器和扫码仍未现场认证。

## 官方引用（查阅日期：2026-10-14）

1. [W3C CSS Paged Media Level 3，size / orientation](https://www.w3.org/TR/css-page-3/#page-size)；
   [编辑草案 §7.1](https://drafts.csswg.org/css-page-3/#page-size)、
   [§7.1.2 page-orientation](https://drafts.csswg.org/css-page-3/#page-orientation-prop)：长度/纸型方向语法与排版后旋转。
2. [W3C page terminology / page model](https://drafts.csswg.org/css-page-3/#page-terms)：
   设备相关不可打印区、有限 page box；草案不是设备实现认证。
3. [W3C CSS absolute lengths](https://www.w3.org/TR/css-values-3/#absolute-lengths)：CSS px/mm/pt 换算。
4. [Epson LX-350 User’s Guide](https://files.support.epson.com/pdf/lx350_/lx350_ug.pdf)：
   pp.85–86 Paper / Recommended printable area；Printing on Continuous Paper 的 top-of-form 与 tear-off。
5. [Zebra ZD411T User Guide](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/product/zd411t-ug-en.pdf)：
   p.11 print width、p.175 media width；Loading Roll Media / SmartCal / Adjusting Print Width。
6. [Zebra ZD421/621 General Media and Print Specifications](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/c-zd620-420-media/r-zd421-zd621-ug-general-media-and-print-specifications.html)：
   按打印技术/型号区分介质宽、选件区分最小长度。
7. [Playwright Page.pdf](https://playwright.dev/docs/api/class-page#page-pdf)：真实 Chromium PDF、CSS 纸型优先与 scale。
8. 字体/参考 Code39 资产的既有来源与边界见 [原特殊纸张验收](ERP_SPECIAL_PAPER_ACCEPTANCE.zh-CN.md)。
