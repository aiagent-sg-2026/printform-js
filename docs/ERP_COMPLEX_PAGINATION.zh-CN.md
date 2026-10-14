# ERP 复杂分页：测量续片与物理 n-up

## 范围与证据边界

本实现面向 PTAC、PADDT 以及超高普通 `.prowitem` 的可分文本；不是把空白词数当作纸张容量，也不是通过隐藏、裁切或任意缩小文字消除溢出。

测试素材为作者自行编写的虚构维护单、Unicode 文本与金额。它们不是客户 ERP 样本，也不构成真实 ERP 过账、打印机、驱动、条码扫描或硬件认证。本文描述源码契约与已编写的验收；实际浏览器/PDF 执行结果应由相应验收记录提供，不能从“存在测试”推导“已经通过”。

## 1. 为什么不能只按词数分段

CSS Fragmentation 把页面剩余块轴空间视为真正的分页预算；同一行不同表格单元格属于独立的并行流。[1] 空格切词无法描述不使用空格分词的中文等文字；`Intl.Segmenter` 提供 locale-sensitive 的 grapheme/word/sentence 分割。[3][4] Unicode UAX #29 说明一个用户感知字符可以包含组合附加符、代理对或 emoji ZWJ 序列，不能随意按 UTF-16 下标截断。[5]

因此物理续片使用浏览器真实布局，不使用“每 200 个词必定适配”的假设：

1. 在保留原节点的 working clone 上，以配置的逻辑纸宽完成布局、测量页眉、文档信息、各表头和页脚。
2. PTAC/PADDT 先注册为可分页行，不提前克隆第一格并重复其它格。
3. 为待分行计算预算：逻辑纸高减第一页页眉/文档信息、当前表头、重复页脚。第一页非重复 chrome 也预留；后续页可能留白更多，但不会因过于乐观而遗漏这些高度。
4. 表头切换时按当前表的实际重复表头高度更新 page context，不沿用其它表的预算。
5. 表格先建立真实row/column占用网格，以目标纸宽扣除border/padding/separate border-spacing并分配实测列宽。多tr与rowspan按源row窗口重建，跨度裁到窗口交集；每格独立消费DOM Range，不flatten或重复金额。Range端点只能落在完整grapheme边界，已消费block提升到其外侧sibling gap，避免下一片克隆空固定高度段落。
6. 二分搜索前缀时检查真实行高、单元格/文本 Range 宽度、scroll geometry；拼回多格后再次检查组合续片。
7. 普通分页器按原有页眉、页脚、显式换页和页码流程放置这些续片；最终逻辑纸高检查仍然有效。

没有 `Intl.Segmenter` 的运行环境明确失败，不退化成会切断组合字符的近似算法。字体及宿主 print-only CSS 改动必须在目标浏览器另行验收；同步 formatter 不伪称能等待尚未完成加载的字体/图片。

### 词数是附加可读性上限

`paddtMaxWordsPerSegment` 保留已有配置/API，正数取整，非正/无效值按原配置规则回退。它限制一个 PADDT 格内续片的空白分词数量；PTAC 使用默认 200。这个上限只能让续片更短，不能放宽真实宽高检查。

无空白 CJK 即使只被词数算法视为一个 token，仍按 grapheme 与实际宽高拆分。普通行不附加 PTAC/PADDT 的词数限制。原子资产/货币节点不能为了满足可读性上限而切断。旧的独立 whitespace-to-HTML splitter 已移除：真实 renderer 只有一条 DOM Range 测量续片路径。

## 2. 单元格策略与守恒

在 `td`/`th`（非表格行则在行根）上设置 `data-pf-cell-policy`：

| 值 | 行为 |
| --- | --- |
| `split`（默认） | 每格是独立流；文字按序消费，耗尽后其它续片的此格为空。短数量、金额、标签默认只出现一次。 |
| `first` | 内容必须整体适配，且仅第一片出现。适合不应拆分的短字段。 |
| `last` | 内容必须整体适配，仅整行最后一片出现。 |
| `repeat` | 内容必须整体适配，明确重复到每一片；只用于作者确实要求重复的参照字段。 |

未知策略明确失败。默认不会因描述太长而重复金额、数量或业务标签。`repeat` 是显式业务选择，不是默认财务行为。

守恒以**每个源单元格的逻辑顺序**定义：将各片同一格的文本依次连接，应等于源格文本；inline 元素属性、方向、链接、组合字符及注释通过 Range 保留。不同格是并行流，不能把所有物理片的 `textContent` 扁平连接后，误当成原表按列依次连接的字符串。

跨片的 inline/container 元素可能有多个 DOM 实例，这是保留包裹样式所需；不会为这些实例重复其源文本。宿主应使用续片身份而不是 DOM `id` 判断源业务行，亦不应依赖克隆节点 ID 的全局唯一性。

## 3. 业务行与物理片不是同一计数

formatter 在 working clone 中清除来源携带的以下 reserved attributes，再为自己产生的续片填写：

- `data-pf-source-row`：本次分页生成的文档范围唯一、不透明源行 token。
- `data-pf-fragment-index`：从 0 开始的连续片号。
- `data-pf-fragment-count`：该行的总片数。

原有 `data-pf-row-repeat`、`data-pf-row-index`、table identity 不改写。来源不能预填续片 attributes 来把真正的重复业务行伪装成合法续片。

v2 `analyzeRowIntegrity` 只有在 source token、table/repeat/index、所属 formatter、片总数一致，且所有片完整、连续、按序出现时才将它们计为一条业务行。合法片可跨逻辑页；不能跨 formatter 输出合并。未标记的重复行、缺片、重复片、乱序或不一致身份仍报错，且错误片不会被折叠隐藏。

`inspectRowIntegrity` 保留原错误数组 API。验收 metrics 中 `renderedRows` 是业务行数，`renderedRowFragments` 是物理行实例数。几何检查仍扫描每一个物理片，不因业务行折叠而减少检查范围。

## 4. 真正的物理 n-up

逻辑分页和物理拼版分两个阶段；只有全部逻辑页通过未缩放高度检查后才执行 n-up。

- `nUp=1` 保留宿主原有 wrapper padding、尺寸及印刷样式；不新增纸张 `@page` 规则。此模式的物理纸张仍由宿主负责。
- `nUp>1` 创建真正的物理 sheet grid 与 cell。枚举列数，选择能容纳 `nUp` 页且统一缩放比例最大的网格；比例相同优先减少空格。
- 各逻辑页在 cell 中以显式统一 CSS `zoom` 缩放；不旋转、不放大，不删减业务内容。`zoom` 同时缩放布局几何；仅用 `transform:scale()` 会保留未缩放打印分片尺寸，现场曾使页脚落入额外 PDF 页。[7] n-up 缩放是用户选择的拼版行为，不是超高行的文字降级修复。
- 纸张 preset 按 96 CSS px/in 解析；未指定 preset 时使用配置的宽高。CSS 绝对单位规定 `1in = 96px`，不是打印机硬件 DPI。[6]
- wrapper 的现有 padding/border 从物理可用空间中扣除；网格、缩放后页面必须同时适配 cell 和 sheet，否则明确失败，且不裁切。
- 每个输出使用不同的命名 `@page`，配置真实纸宽/高、零页边距及 sheet 换页；混合纸型不由最后一个全局 `@page` 覆盖全部表单。[2]
- 逻辑页号、逻辑总页数、物理 sheet 号及物理总页数保持各自语义。PADDT 仍保留业务页之后另起物理页的既有契约，所以非末 sheet 也可能只有部分 cell。

可审计标记包括 `data-pf-n-up-geometry`、`data-pf-physical-page`、`data-pf-physical-width/height`、`data-pf-n-up-columns/rows`、`data-pf-cell-width/height`、`data-pf-logical-page`、`data-pf-logical-width/height`、`data-pf-logical-scale`。这些标记同样由 formatter 覆盖来源值。DOM 的实际 sheet/cell/page rectangles 应与配置及有效比例一起记录，不能用逻辑行验收替代物理纸张验收。

CSS Paged Media 明确区分 page box、page sheet 与设备可打印区域；真实打印机不可打印边界和驱动调整依赖设备。[2] 因此 Chromium 的 PDF 页数/尺寸证明仅是浏览器 PDF 路径的证据，不是打印硬件认证。

## 5. 明确失败，而非虚称全面支持

自动续片支持独立文本行、单tr多格，以及同一业务table内多tr、rowspan（包括0的当前行组余行语义）、colspan；内部tr不重算为新业务行。first/last/repeat相对于cell参与的片段定义；详情与实际验收见[多行续片契约](ERP_MULTIROW_CONTINUATION.zh-CN.md)。并非任意嵌套table、富文本CSS或全部字体组合已认证。

以下内容无法完整适配时明确失败：

- 真正原子的图片、SVG、canvas、嵌套 table、inline-block/flex/grid、keep-together 节点或货币 token。
- 强制固定高度、单个 grapheme、单元格 padding/border/chrome 已大于预算。
- 需要重复的源行/格根生成式 `::before/::after` chrome：不能把生成式财务标签悄悄重复到续片。
- 原子 subtotal/footer 组合、页眉/页脚等 chrome 大于纸高。
- 宿主覆盖导致逻辑宽度被改窄、页面已被预缩放，或物理 n-up cell/sheet geometry 不兼容。

源 DOM、原节点身份及事件监听器保留在失败回滚边界内；半成品输出删除。动态选择器或只在打印媒体生效的版式可能改变 Range 的高度，必须通过目标媒体验收；没有“静默 clip / scale / 忽略几何错误”的退路。

## 6. 永久验收素材与执行入口

- `tests/fixtures/complex-pagination.js`：虚构四格维护单，长 CJK/RTL 两个独立文本流、跨 inline 的组合字符、emoji ZWJ、金额/数量/标签，以及 first/last/repeat 策略；另有继承示例宿主 CSS 的 auto-layout 纯文本多格、padding 与 separate border-spacing 素材。
- `e2e/complex-pagination.spec.js`：PTAC/PADDT/普通超高行在 260px 与 340px 纸宽上的真实分片、每格文本/金额守恒、完整身份、inline/RTL、无溢出、页码、可读性上限、reserved 元数据与原子失败回滚。
- `tests/text*.test.js`：实际 DOM Range 的 Unicode、inline、注释、资产/货币原子守恒，以及续片不复制已耗尽固定高度 paragraph；不伪造测量结果来证明物理适配。
- `tests/studio-v2/row-continuation.test.js`：实际物理片内容消费、业务行计数与重复/缺片/身份/顺序错误、保留物理几何错误。
- `tests/fixtures/n-up-fictional.js`、`tests/n-up-geometry.test.js`、`e2e/n-up-geometry.spec.js`：虚构七页单据、RTL、外部 padding、不同 paper/DPI、部分末 sheet、PADDT 强制物理边界、混合纸型隔离；三浏览器实际 DOM/print geometry；Chromium PDF 解析页数、页面尺寸及内容。

### 2026-10-14 实际集成结果

- `npm run build:site`：**221 files / 2,174 tests passed**；runtime/site/agent release 构建成功。
- `npx playwright test e2e/complex-pagination.spec.js e2e/n-up-geometry.spec.js e2e/renderer-integrity.spec.js e2e/studio-v3-globe3-progress.spec.js e2e/studio-v3-erp-settlement.spec.js e2e/studio-v3-globe3-claims.spec.js e2e/studio-v3-receivable-claims.spec.js --workers=3`：Chromium/Firefox/WebKit **112 passed / 2 intentional skips**。两项 skip 仅为非 Chromium 的 PDF emission；对应 screen/print geometry 已由三引擎其它 case 执行。
- 同一真实 Chrome 四格窄纸输入：旧公开 runtime 因逻辑高度 **2706 > 180** 拒绝；新 runtime 输出 **20 页**，每页最大 **168px**、四格原文守恒、`MYR 123.45` 仅出现一次，已查看实际界面。
- 实際 PDF.js 验证：七逻辑页四联输出 **2 页**、三联 **3 页**、带 padding 的 Letter 双联 **4 页**；custom+Letter 混合输出 **4 页**，各纸型尺寸正确。每个 ID/金额在所属物理页恰好一次、不出现在别页；页脚不再溢入额外页。
- 初次 browser 失败中有三类素材配置错误：未启用 repeat footer、`END` 25px 不足、Firefox 字形 13px 放入 10px chrome。已显式启用重复、维持总纸宽重新分配列宽，并将虚构页眉/页脚与行高设为 16px；没有放宽几何、金额或 PDF 页数断言。
- 真实产品修复还包括 SVG 原子节点小写 tag name 导致重复、耗尽固定高度段落的空 wrapper 续片、intrinsic 超宽表格列，以及 transform-only 打印分片。以上只证明所列浏览器/虚构场景；仍不表示 live ERP、任意 CSS/字体、真实打印机已认证。

## Primary sources

1. W3C CSS Fragmentation Level 3：[fragmentation model 与 parallel cell flows](https://drafts.csswg.org/css-break-3/#parallel-flows)。编辑草案，按工作中的规范引用；已发布入口为 [CSS-BREAK-3](https://www.w3.org/TR/css-break-3/)。
2. W3C CSS Paged Media Level 3：[page model](https://drafts.csswg.org/css-page-3/#page-model)、[page size](https://drafts.csswg.org/css-page-3/#page-size)、[printable area](https://drafts.csswg.org/css-page-3/#page-terms)。编辑草案；已发布入口为 [CSS-PAGE-3](https://www.w3.org/TR/css-page-3/)。
3. ECMA-402：[Intl Segmenter specification](https://tc39.es/ecma402/#segmenter-objects)。
4. MDN：[Intl.Segmenter API 与 whitespace 分词的限制](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)。
5. Unicode UAX #29：[Grapheme Cluster Boundaries](https://unicode.org/reports/tr29/#Grapheme_Cluster_Boundaries)。
6. W3C CSS Values and Units Level 3：[absolute lengths](https://drafts.csswg.org/css-values-3/#absolute-lengths)。

[7] [CSS Viewport Module Level 1 §4 / §4.1（编辑草案）](https://drafts.csswg.org/css-viewport/#zoom-property)：zoom 影响布局，DOM client rects 返回缩放后的长度；[MDN zoom](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/zoom) 对比 transform 的非布局缩放。草案仍是 work in progress，浏览器支持必须通过实际 journey 验证。

## 2026-10-14 精确 mm 纸型补充

正文 fit 保留实测小数，不把234.328125px 行 ceil成235px后与234.33070866px纸高比较；行及最后页的 fit 共用一个 CSS layout unit 容差，现有物理几何验收不放宽。同一三标签输入的前后空白页已修复；[特殊纸型矩阵](ERP_SPECIAL_PAPER_ACCEPTANCE.zh-CN.md) 24/24、完整 build222 files/2259 tests 已实际通过。字体本身的 PDF 字符地图与行框仍需独立验证；见新契约的 Amiri/OFL 与设备边界，不能推导全部字体或硬件通过。

