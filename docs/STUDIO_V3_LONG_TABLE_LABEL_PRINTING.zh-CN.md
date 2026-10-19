# Studio v3：多页长行与固定模块小标签打印调查

## 结论与范围

本轮是既有[打印兼容性调查](STUDIO_V3_PRINT_COMPATIBILITY.zh-CN.md)的有界延伸，不重复普通单页／Letter／Legal 正例，不创建第二套资格协议。使用现有 `newProject` → `compileProject` → `createStandaloneHtml` → 本地独立 `file://` → 实际 DOM／print media → Chromium PDF 路径。

**已有完整构建上的调查完成：18个引擎场景，4份真实 PDF、6次浏览器 PNG 独立解码及2次真实 PDF 栅格独立解码。** 长行跨页而来源字符与顺序保持；超高原子行／超宽原子标签明确 blocked，而非当作 ready 后丢失或缩放。没有据此发现当前产品缺陷，所以没有改产品代码或添加永久测试。此结果仅属于以下明确 runtime；不冒充父代理最终源码构建或实体打印认证。

原始产物：

```text
/tmp/printform-next-source-print-cd7e70c7-aebd-4c10-9bdb-9897255f468b/printing-long-label-pdf-pixels/
```

报告为 `long-table-label-printing.json`；SHA-256：`14e953c32e0ca33044cc9cd2ae3ade55189d58dc1bf17c86e2a3ec1b6edc5e3a`。目录另含6份独立 HTML、4份 PDF 与6份原生截图 PNG。临时产物归档时应保留原始字节和 hash，不能只留下结论。

- UTC：`2026-10-19T01:10:09.124Z` 至 `01:10:17.964Z`。
- 显式 runtimeDir：`/tmp/printform-next-20261019-8ae4f0bc-eab6-426d-b62c-d4d7c5ed007f/source/dist`，复用上一轮已完成构建，**本轮没有 build**。
- `printform-document.js` SHA-256：`5da592f5f8fba25b29364d925c68ca99773d9a7dde9a7c0616390a4bf7793798`。
- `printform.js` SHA-256：`2781201944f91f80518837c4503c9f40ce8b0a7070e4307be4a5eb173984f582`。

## 有界输入与实际观察

四侧 inset 固定为上7／右11／下19／左23 **CSS px**，不是设备不可打印区；横向交换纸张宽高，不交换四侧 inset。每个 ready 场景分别量测 screen／print 的 wrapper 尺寸、逻辑内容框、页内行／符号边界、无 transform／zoom 缩放。每场景物理页上限12，本轮最多2页。

| 场景 | 物理纸型 | 三引擎实际状态 | Chromium PDF 页数／MediaBox（pt） |
| --- | --- | --- | --- |
| 长表 portrait | 140×180mm | ready，各2页 | 2页，各396.95999×510 |
| 长表 landscape | 180×140mm | ready，各2页 | 2页，各510×396.95999 |
| CODE128 小标签 portrait | 45×62mm | ready，各1页 | 1页，127.919998×175.92 |
| EAN13 小标签 landscape | 80×45mm | ready，各1页 | 1页，227.03999×127.919998 |
| 超高 atomic row | 140×180mm | blocked，FORMAT_FAILURE | 不生成 PDF |
| 超宽 atomic EAN13 | 80×45mm | blocked，BARCODE_CONTENT_OVERFLOW／HORIZONTAL_OVERFLOW | 不生成 PDF |

长表包含3个真实来源行：首行180个 `LINE-0000` 至 `LINE-0179` 标记，加后续两个顺序 sentinel；身份 `SOURCE-00007`／`00008`／`00009`，金额字符串分别为 `MYR 00002.500`、`MYR 00000.010`、`MYR 90000.001`。使用已有导入模板的 `data-pf-cell-policy="first"` 保留首段身份／金额，描述按现有 Range 分割，不建立另一套分页器。

- 每引擎首行均有2个 continuation，来源 row ID 相同，fragment index 为0／1，count 为2。第二页继续首行后才出现后两个来源行。
- 三列分别按渲染顺序连接 `textContent`，**包含空格逐字符等于来源字符串**，没有把金额转成数字、改变前导零、补算或复制金额到续段。
- 每页重复且只出现一次 `Source identity`、`Continuation text`、`Supplied amount` 三个完整表头。
- 本素材允许 `overflow-wrap:anywhere`，分页可发生在 token 内：portrait 的 `LINE-0111` 在页界为 `LI`／`NE-0111`；landscape 的 `LINE-0112` 为 `LIN`／`E-0112`。这不是丢字；逐字符重组仍完整。不能把“每页可独立搜到整个 token”作为此路径的前提。
- 每份 PDF 用 PDF.js 独立读取页树、viewport、文本和坐标；另直接读 Chromium 输出 `/MediaBox` 字典交叉核对。PDF页数等于实际 DOM页数，每页提取文字按输出次序与该页来源 continuation／表头对应；**仅在 PDF 文本比较中去除布局产生的空白**，DOM来源比较不去空白。来源文字高度约9pt，未缩小；坐标在四侧作者 inset 内。

## 符号像素不是自报 label

- CODE128 来源 `00001234`，模块宽1px，完整符号99×64px；EAN13 来源 `0001234567895`，模块宽2px，完整符号226×64px。条高均24px，保留既有 quiet zone／HRI。
- 三引擎实际 print-media `svg.screenshot({scale:'css'})` 得到 PNG；只读栅格第20行黑白采样，交由仓库既有独立 `decodeBarcodeRow` 校验 guard／code set／checksum／quiet zone。**解码器不读 SVG rect、title、aria-label、来源属性或生产编码器。** 每张图还从像素 run 最小宽度分别读回1／2px。
- Chromium 的两份真实标签 PDF 再由 PDF.js 与已有可用的 `@napi-rs/canvas` 按96dpi栅格化，读取对应条纹行；同一独立解码器分别还原完整来源值，像素模块宽仍为1／2。此依赖属于 PDF.js 的可选栅格能力；不可用时报告明确 unavailable，不冒充通过。本次两项均 available。
- 超宽 EAN13模块宽4px，完整宽452px，超出作者内容框。真实状态 blocked，符号仍以原固定宽度留供诊断、未被缩放或默默移除；调查不为它生成合格 PDF。超高 keep-together row 抛出 atomic row 错误并 blocked，mount清空是明确失败状态，不记作内容保留正例。
- 这些小条高是数字边界素材，**不声称符合零售 EAN13 的高度／尺寸规范**；普通 CODE128不等于GS1-128，示例值不证明GS1分配、商业编号所有权、硬件扫描成功或ISO印刷质量。

## 引擎、安全及离线边界

Chromium **151.0.7922.34**、Firefox **153.0**、WebKit **26.5**，均使用既有安装，未升级。仅 Chromium 显式 `chromiumSandbox:true,args:['--enable-automation']`；真实 browser CDP `Browser.getBrowserCommandLine` 观察50个参数，`--no-sandbox` 及赋值形式均不存在。只记录开关与数量，不保留完整启动参数；这不是OS级sandbox渗透验证。Firefox／WebKit启动选项不变。

全部18场景 HTTP(S) 路由阻断，实际请求0、pageerror0；项目 export 前后完整 JSON 快照相同，浏览器内嵌 sampleData 始终逐值等于来源。此次没有 `offline:true`，因此不是 transport-offline 冷启动通过。**原 WebKit 冷上下文 transport-offline `file://` 失败原条件保持不动、不重跑、不以这里的另一条路径改写成绿色。** WebKit不等同Safari，Firefox／WebKit没有PDF产物。

没有调用 `window.print()`、原生打印面板／作业、设备／扫描器、网络发现；没有硬件变更。本轮 `physicalCertified=false`，不会补齐既有实体证据或生产资格门禁。

## 官方一手依据

已实际读取正文，结论不只依赖搜索摘要：

1. [CSS Fragmentation Level 3：break-inside](https://drafts.csswg.org/css-break-3/#break-within)定义 `avoid` 是避免断开；[unforced breaks](https://drafts.csswg.org/css-break-3/#unforced-breaks)允许在空间不足时放弃部分限制，最终可能切割 monolithic 内容以避免丢失。故仅声明CSS avoid不能证明大符号／原子行安全；本调查核实的是产品明确 blocked。该文是工作中的 Editor’s Draft，不宣称所有引擎实现一致。
2. [CSS Paged Media Level 3：page model](https://drafts.csswg.org/css-page-3/#page-model)与[page size](https://drafts.csswg.org/css-page-3/#page-size)区分页框、纸面及设备不可打印区，作者 `@page` 不是设备能力证明；横纵方向、尺寸需以实际DOM与PDF核对。该文同为 Editor’s Draft。
3. [GS1 官方实施十步](https://www.gs1.org/standards/barcodes/10-steps-to-barcode-your-product/english)第4／6／8／9／10步分别要求按扫描环境选择大小、X-dimension和高度、quiet zone／对比、打印方向与印刷质量计划；明确EAN/UPC不能任意截短高度。第10步区分印后ISO verifier分级与一般扫描。本调查像素校验不替代这些设备／介质前提。
4. [GS1 EAN/UPC官方入口](https://www2.gs1.org/standards/barcodes/ean-upc)链接到General Specifications、HRI和verification指南。旧 `www.gs1.org/.../1d-barcodes/ean-upc` 路径404，两个verification PDF下载403，**没有声称已读其PDF正文**；可达的官方HTML十步正文足以支持上述范围界限。

## 探针与复现

```sh
node scripts/studio-v3-long-table-label-probe.mjs /absolute/evidence-directory /absolute/built-runtime-directory
```

或 import `runLongTableLabelStudy({outputDir,runtimeDir})`。两个路径均必须显式提供，runtime目录必须包含 `printform-document.js`／`printform.js`，不会隐式读取旧 `site-dist/dist`。探针串行关闭page／context／browser，失败也保存已取得的报告；拆分为夹具、度量助手及入口三个文件，各自低于300行。父代理负责针对最终独立构建快照运行它及仓库检查。

## 保留的初期失败与旧产物边界

前次代理只留下 `scripts/studio-v3-long-table-label-fixtures.mjs`，没有完成报告；本轮在该夹具上继续，移除无关默认logo并采用真实portrait的45×62mm标签。

- 首轮 `printing-long-label-diagnostic` 把屏幕页间24px外部间隔与print移除间隔后的绝对y坐标直接比较，探针误报；改成页内相对坐标，产品未改。原失败报告保留。
- `printing-long-label-diagnostic-relative` 的旧 `site-dist/dist` 在 CODE128场景显示 ready 但没有SVG。一次有界DOM定位确认旧runtime保留空 `data-pf-barcode` 元素；不能将旧构建当作当前源码证据，未为此修改产品或放宽SVG断言。改为显式使用上一轮已完成的完整构建，`printing-long-label-built-diagnostic` 才完成18场景。
- 最后 `printing-long-label-pdf-pixels` 增加真实PDF栅格解码、DOM含空白逐字符比较和明确portrait尺寸，再完成18场景。早期失败未覆盖、未抹除，不属于原WebKit冷offline失败的重确认。

## 最终源码构建上的独立执行

主集成在最终隔离构建 `final-source/dist` 再执行同一入口：18/18场景完成、4份真实PDF、6份浏览器PNG和2份PDF栅格独立解码，HTTP请求／pageerror均0；实际标签与检验单图像已审阅。runtime两份hash与上方原完整构建相同，不把相同字节当作新增功能或重新认证。

最终报告SHA256为 `42e4b28b06069f7a90739fe8c51754bd11e374fbcfac14c45ca0a2b38b2b809b`，原始目录 `final-printing/` 与上方初期报告分别留存。[可发布脱敏记录](acceptance/STUDIO_V3_SOURCE_PRINT_20261019.json)含运行包hash及范围；仍未重跑原WebKit冷transport-offline file，未调用原生打印／扫描，未发现需修改产品的打印缺陷。
