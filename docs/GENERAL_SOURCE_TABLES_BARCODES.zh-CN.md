# 通用独立来源表格与离线条码

此功能面向一般 Printform Studio，不是 ERPNext 专用界面，也没有建立任何 ERP 连接。以下描述是实现契约；浏览器、原生打印和物理扫描/打印机验证仍应分别记录，不能由单元测试或本文代替。

## 独立表格

原有主表 `collection`、`columns`、`blocks.items`、稳定的 `items-*` IDs 保持原样。主表之外可选 `additionalTables` 最多四项，每张表最多30列，每项是：

```json
{"id":"table-operations","label":"Supplied operations","collection":"/operations","enabled":true,"repeatHeader":true,"breakBefore":false,"columns":[{"id":"operation","label":"Operation","pointer":"./operation","format":"","width":100}]}
```

表格集合必须是绝对 JSON Pointer，列使用相对 Pointer。不允许通配符、表达式、prototype 路径、对象单元格或重复组件 ID。每个启用表格按自己的真实数组逐行绑定、按独立 table ID 分页、控制自身表头重复。表格按创建顺序放在原 Items 位置之后，即便主表隐藏，额外表仍可打印。无数组合并、跨数组 join、金额或工时求和。

人类流程：

1. 在当前文档数据中提供第二个对象行数组（可通过已有 JSON 编辑器或明确结构化导入）。
2. Template structure → **Add independent source table**。没有第二个可绑定集合时明确报错，不虚构空数据。
3. Properties 修改名称、集合、显示、重复表头和分页设置，按 **Apply source table**。选择列可以编辑字段、绑定、格式、宽度、上下移动及删除；新增列默认复用该表已有源路径，不更改主表。
4. 删除额外表只移除布局；原源数组和主表不删除。Apply 使用同一命令总线、Undo/Redo、Save/Open 以及独立 HTML 输出生命周期。

新增、重新启用或更换集合／列绑定的空表需要显式来源 schema 字段；保持原绑定的合法空表仍可编辑布局。新增表选择器会跳过标量数组、混合行及没有安全 `./` 标量列的候选，并继续查找后面的兼容集合。

结构化导入以真实集合 JSON Pointer 为目标；同一目标下所有启用表格的绑定组成必填要求。每次明确映射一个集合，不猜第二数组的 join 或列别名。

## 真正离线条码

字段新增 `kind: "barcode"`，必须绑定一个已有字符串值，不支持数值转字符串、trim、补零、12位自动补校验或使用静态文本伪造来源：

```json
{"id":"source-code","label":"Source code","kind":"barcode","pointer":"/identifiers/ean","text":"","format":"","barcode":{"format":"EAN13","moduleWidth":2,"height":48,"displayValue":true}}
```

人类流程：新增独立字段 → Data binding → Value source **Printable barcode** → 原字符串 Pointer、CODE128/EAN13、模块宽/条高/可读原文 → Apply binding。行内条码也使用该表自己的集合与相对 Pointer。金融字段和受保护 canonical/supplied facts 不能替换成条码；需要另外添加条码字段。

- CODE128：恰好1–128个可打印 ASCII 字符（U+0020–U+007E），原始大小写、空格、前导零不变。
- EAN13：严格原始13个数字且校验位正确；`0123456789012` 可用于前导零消费者场景。拒绝12位、数值、错误校验位和附加空白。
- UI 模块宽为整数1–4 CSS px、条高为整数20–160 CSS px。quiet zones 和 SVG 保留固定几何，不静默缩放。实际 SVG 必须放得进同页内所有包含它的 `td/th/.field` 祖先内容盒（逐层扣除 padding/border）；扩大内层 `.field` 不能绕过外层单元格／字段。`BARCODE_CONTENT_OVERFLOW` 对每个失败条码计数一次、明细最多20条，并报告真正失败容器的 available_size，即使还未超整页也阻止 ready/export。原整页门禁不变；需要明确加宽分配或选择可容纳配置，不修改原字符串、不声称打印机可读。
- 真实输出是安全 SVG bars，外层 `[data-pf-barcode]`，内部 `[data-pf-barcode-svg]`。值通过 DOM 文本节点写入，无外网图片、远程字体或脚本请求；独立 HTML 的现有运行时打包包含编码器。
- 所用 JsBarcode `3.12.1` 为 MIT，许可保留在本地 vendor 中。库来源：<https://github.com/lindell/JsBarcode>。EAN13校验位语义：<https://www.gs1.org/services/check-digit-calculator>。
- 校验通过不证明 GS1 编码所有权、application identifiers、认证或任何扫描器/打印机资格。

## 复核入口

新增消费者测试：`tests/studio-v3-additional-tables.test.js`、`tests/studio-v3-barcode-authoring.test.js`；runtime条码独立测试见同目录 barcode suites。浏览器联合流程：`e2e/studio-v3-additional-tables-barcode.spec.js`，包括65条第二集合、主表3条、前导零 EAN13、人类 Apply、GBP、Save/Open、禁网独立 HTML 及实际 SVG 截图。

聊天提案恢复使用同一 `validateBarcodeSettings()` 限定条码配置对象；新增表列的历史宽度仍限1–100%。恢复的 diff 一律是过期历史，不可作为可直接 Apply 的活提案。对应消费者测试为 `tests/studio-v3-capability-chat-recovery.test.js`，不存条码源值或引入额外联网请求。

已从原生Chrome155实际PNG用独立Apple Vision读回EAN13 `0123456789012`和CODE128 `00012345-AB`，不是从SVG label或同一编码器自证。[具体像素与容器检查](STUDIO_V3_OFFLINE_BARCODE.zh-CN.md)仍不是物理扫描器/打印机认证。

16币种仅用于 Studio 主币种 UI／项目构造，不缩窄来源 ISO 事实或核心 formatter；制造工单／工时表来源契约见 `GENERAL_CURRENCY_MANUFACTURING_TIMESHEET.zh-CN.md`。没有汇率、税或金额重算。

## 人工与 callable 边界

创建／删除独立表、选择其集合、添加／排序额外表列仍是人工操作。V3 `set_field`／`remove_field` 可操作已存在的额外表列；`add_field`／`reorder_fields` 的 section 仍只有原五区块，不可用于额外表列。条码可通过字段操作配置，但不获得创建业务数据的权限。

New 只创建已列出的虚构 starter。Data → Import CSV / JSON 是人工文件选择、映射、Preview、Apply 流程；profile normalizer／SDK adapter 不是原生 ERP JSON 的直接 UI 导入承诺。保存、数据集管理与分享下载不是 callable tools。

Save with source／HTML with source 保留原始本地导入文件、文件名和映射。Share copy 仅去掉 import receipt、原始源文本及其文件名；全部 live data（包括未绑定值）、打印值、标签、图片及模板元数据仍保留，不是匿名化，也不上传。写入 live data 或模板文字的源文件名也仍保留。

额外表及表头的Add to chat引用由同一metadata block ownership消费：表只能改自身已有列／标签，表头只允许自身`label-*`，不会把目标错路由到主表。真实chat parser与private draft调用在修复前均`UNSAFE_SCOPE`，修复后创建候选且源数据原样；跨表及表头body-value仍拒绝。此检查不代表模型已经在公开服务完成请求。
