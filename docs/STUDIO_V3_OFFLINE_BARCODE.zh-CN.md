# Studio v3 离线条码：CODE128 / EAN13

本说明描述条码实现、接口与已观察证据边界；不是实体扫描器、打印机或 GS1 资格认证。

## 人工配置与数据边界

在 Design 中新增独立字段，打开 Binding，将 Value source 设为 Printable barcode。
选择现有字符串来源、Barcode format、Bar module width、Bar height，以及是否 Print exact supplied text，再点 Apply binding。
条码配置保存在 `manifest.studioV3` 字段中；项目 JSON 与 standalone HTML 沿用现有保存、打开和导出入口。

```js
{
  id: 'shipping-code', kind: 'barcode', label: 'Shipping code',
  pointer: '/shipment/code', format: '',
  barcode: {format:'CODE128', moduleWidth:2, height:48, displayValue:true}
}
```

数组行使用 `./code`，根字段使用 `/shipment/code`。来源必须是字符串；数值不会被转成条码字符串。
必须新增独立条码字段，不可把现有金融或 canonical supplied facts 字段替换为条码。
条码不计算金额、税项、产品编号、校验位、编号归属或业务事实。

- CODE128：恰好1–128个可打印 ASCII 字符（U+0020–U+007E），使用库的自动码集选择；不 trim、改大小写或删除前导零。
- EAN13：必须提供恰好 13 个 ASCII 数字，并且第 13 位满足校验规则。12 位输入、错误校验位、空白、全角数字、非字符串均拒绝；绝不自动补校验位。
- 示例 `0001234567895` 的前导零属于原始内容；保留在编码、人可读文字和已保存项目中。
- CODE128 的功能字符、GS1-128、非 ASCII 内容、EAN 扩展码不在支持范围。

## 离线与许可证

编码使用本地固定版本 **JsBarcode 3.12.1**，不是运行时 CDN：

- 上游发行文件：<https://cdn.jsdelivr.net/npm/jsbarcode@3.12.1/dist/JsBarcode.all.min.js>
- 固定 tag：<https://github.com/lindell/JsBarcode/tree/v3.12.1>
- MIT 原许可证：<https://github.com/lindell/JsBarcode/blob/v3.12.1/MIT-LICENSE.txt>
- 上游原始 minified 文件 SHA-256：`9c6d079b69a763191e38de8f3d69a252cb2413ea8f35af15478a5a870c7edfa2`。

`studio-v2/vendor/jsbarcode-3.12.1.js` 保留上游 generated distribution，增加隔离导出捕获，完整 MIT 文本放在 `@license` 注释内。
包装只隔离库的浏览器导出命名空间；不伪造 document、canvas 或 SVG DOM。
业务代码只调用 JsBarcode 的 ObjectRenderer 获取二进制 encodings，不调用库的 canvas/SVG renderer。
最终 SVG 由 `createElementNS` 与 `textContent` 构造；来源字符串不拼入可执行 HTML，不产生 fetch、图片 URL、eval 或动态代码。

## 运行时与导出链

`studio-v2/core/binding.js` → `barcode-binding.js` → `barcode.js` → 本地 vendor。
预览与 standalone 都调用相同 `bindTemplate`。
`src/document-runtime-entry.js` 导入共享 runtime；`scripts/build-document-runtime.mjs` 的现有 Vite IIFE 构建会沿静态 import 打包条码代码。
无需单独的运行时下载或导出后 CDN。导出器继续内嵌 document runtime，并使用其既有脚本 hash CSP 和 `connect-src 'none'`。
站点构建复制 `studio-v2`，Studio v3 的构建依赖收集与不可变 shell 沿用既有流程。
这些构建和实际离线行为必须由主代理执行验证；此子任务没有运行构建或测试。

模板接口：

```html
<span data-pf-barcode="/shipment/code"
  data-pf-barcode-format="CODE128"
  data-pf-barcode-module-width="2"
  data-pf-barcode-height="48"
  data-pf-barcode-display-value="true"></span>
```

`data-pf-barcode` 不能同时出现 `data-pf-text`、`data-pf-href`、金额或显示格式属性。
找不到来源、值非法或配置非法都会产生带 pointer/component 的 binding error，清空旧内容并阻止成功渲染。
固定 SVG 同时接受原整页越界检查和同页内所有包含它的 `td/th/.field` 祖先内容盒检查（逐层实测，扣除 padding/border），不能只看最近 `.field`。扩大内层字段不能绕过外层单元格／字段。任一祖先失败即以 `BARCODE_CONTENT_OVERFLOW` 阻止 ready/export；每symbol只计一次、总明细最多20条，available_size来自真正失败的容器。不得缩小模块、裁剪或修改 quiet zones。布局回归须由主代理运行真实浏览器/E2E验证；本切片未运行，不把 JSDOM 零几何或伪造 bbox 视为已验证适配。新增嵌套回归见 `e2e/studio-v3-barcode-nested-overflow.spec.js`。

## 核心 API

`studio-v2/core/barcode.js` 导出：

- `barcodeOptions(options)`：检查并返回完整配置。
- `validateBarcode(value, options)`：检查原始字符串与配置，成功返回配置，否则抛出带 `code` 的错误。
- `encodeBarcode(value, format)`：返回 `{value, format, bits, quietLeft, quietRight}`。
- `renderBarcode(document, value, options)`：返回自包含 SVG。

核心模块宽度必须为整数 1–4 CSS px，条高整数 16–200 CSS px；V3 配置契约（不只是人工控件）采用更紧的整数 20–160 px 条高。
默认宽度 2、条高 48、显示原文。`displayValue` 必须为 boolean。
CODE128 左右各至少 10 个模块 quiet zone；EAN13 左 11、右 7。条形黑色、背景白色，固定尺寸，不自动压缩。

## 独立解码辅助与实际证据

`tests/support/barcode-decode.js` 不导入编码器或 vendor，也不读取来源标签、aria-label、人可读文字。
其 CODE128 run-width 表独立对照 ZXing JS v0.21.3，保留 Apache-2.0 归属及 `tests/support/ZXING-LICENSE.txt`。
`decodeBarcodeSvg(svg, format)` 只读取实际矩形几何；`decodeBarcodeRow(row, format)` 从 0/1 光栅扫描行恢复模块并检查码字、校验位和 quiet zones。
EAN13 独立恢复首位 parity，因此前导零不会作为 UPC-A 被省略。
这只是整齐、轴对齐测试图的独立 oracle，不是摄像头、损坏图、实体扫描或 GS1 验证器。

可重复运行入口（各次执行结果独立记录，不把 authored coverage 当作通过）：

1. `tests/studio-v3-offline-barcode.test.js`：两个格式的独立几何解码、前导零、大小写/空白、escaping、错误校验位、12 位拒绝、类型与尺寸负例。
2. `tests/studio-v3-barcode-binding.test.js`：根/行绑定、来源数据不变、金融文字不变、显示控制、定位错误、清空旧符号、水平越界。
3. `e2e/studio-v3-offline-barcode.spec.js`：人工控件 → preview → JSON 保存重开 → standalone HTML 重开 → `file://` 离线打开 → print media；对实际浏览器截图的像素行独立解码。
4. Chromium 分支导出真实浏览器 PDF 并核对供应文本；所有浏览器分支检查 standalone 错误输入阻止渲染、无外部 HTTP 请求。
5. 检查打印预览中的宽度、quiet zone、字体与纸张；实际打印和实体扫描需另有明确设备证据。

完整隔离单线程构建已包含并通过上述单元消费者；三引擎生命周期结果由本轮总验收记录给出，不从单元测试推断。

原生 Chrome155／sandbox 的两张实际 PNG 已由独立 Apple Vision 解码：CODE128 `00012345-AB`（confidence 0.9696496725082397），EAN13 `0123456789012`（0.9910118579864502）。保留前导零；不是读取 SVG label／来源值代替解码，也不是实体扫描认证。

同一原生 DOM 的 264px 条码放入 104.84375px 单元格时，旧 page-only 检查遗漏，新检查报告 `BARCODE_CONTENT_OVERFLOW`；只将该列从15%扩到45%后单元格314.546875px、错误消失，SVG outerHTML和来源原样。600px 内层 field 曾绕过 nearest-only 检查，现遍历所有同页 td/th/field 祖先，原例被拒；没有缩小模块、quiet zone或门禁。

最终消费者：Chromium/Firefox实际离线file、独立栅格解码、print media及Chromium PDF通过；三引擎预览和JSON/HTML重新Open解码通过。WebKit offline `file://`导航仍Blocked：114字节无脚本HTML也同样失败，不能声明该组合通过。真实下载328604字节在WebKit冷offline的data URL执行，原生PNG解出`00A<&`/`0001234567895`，金额`00012.3400`与零HTTP/错误均成立；不是替代file导航认证。[完整失败与边界](acceptance/STUDIO_V3_GENERAL_CAPABILITIES_20261017.md)。
