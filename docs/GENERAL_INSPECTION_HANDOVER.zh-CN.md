# 通用检验报告与资产交接：供应事实，不推断认证或签收

## 无代码入口与适用范围

Studio v3 → **New → Business demo templates**：

- **Inspection report · 检验报告**：独立观察、测量原文、来源给出的要求/方法/结果。
- **Asset handover · 资产交接**：资产身份、序列号、状况、附件说明、可选数量及起止方。

沿用同一个编辑器、绑定、分页器、Save/Open、离线 HTML 与浏览器 Print；不绑定 ERPNext，不执行 ERP、库存、资产或会计过账。New 中的身份和数值全部虚构。现有五类 supplied-facts 表单继续可用；七类共用 `supplied-business-v1`，没有第二套打印引擎。

这是有限的通用供应事实契约，不是所有检验规范、资产制度或表单格式均已认证。真实来源可由接入方使用原 creator API 生成工程；普通 CSV/JSON 映射不能直接改写本 canonical profile 或派生 `/printRows`，应选择普通/空白表单，或使用该来源的 canonical adapter。

## 共同来源契约

`normalizeBusinessDocument(input)` 与 `createBusinessDocumentProject(input)` 沿用原入口。根层要求：

- `profile: "supplied-business-v1"`。
- `source:{system,documentType,id,number}`：明确的来源标识，不代表 Studio 已认证该来源。
- `document:{kind,number,date}`；本两类不接受根 document/source currency，不把资料变成金融事实。
- `company:{id,name,address?}`；可选 `notes` 原文。
- 带来源的上下文对象必须提供 `provenance:{sourcePath,meaning}`。状态只能是带 provenance 的分支状态；禁止用 `document.status` 冒充无来源结论。

拒绝未知 canonical 字段、危险键、非有限数、无效日期、重复事实 ID 和空必需数组。每个事实数组至多500行；不省略错误记录，也不填充缺失事实。

## InspectionReport / inspection

| 字段 | 实际约束与打印含义 |
| --- | --- |
| `reference` | 带来源的 `{id,number}` |
| `subject` | 带来源的 `{id,name,lot?,serialNumber?}` |
| `status?` | 带来源的 `{value}`；缺失时不补“合格” |
| `checks[]` | 每项 `{id,characteristic,observed,expected?,method?,result?,measure?,provenance}` |
| `measure?` | `{amount:string,decimalPlaces:0..6,uom:string,provenance}`；允许真实供应的负向测量，保留符号、前导零及小数原文 |

每个 check 单独成行，observed/expected/method 为明确标注的来源文字；measure 独占原文数量格，result 只显示源方提供的原文。**不比较限值、不计算通过/失败、不推断抽样代表性、不证明仪器校准或 ISO 认证。** 没有 result 或 measure 就保持缺失，不从其它字段推算。

## AssetHandover / handover

| 字段 | 实际约束与打印含义 |
| --- | --- |
| `record` | 带来源的 `{id,number,purpose}` |
| `from` / `to` | 各为带来源的 `{id,name}`，可表示明确的来源方或位置 |
| `status?` | 带来源的 `{value}`；不是 Studio 生成的签收证明 |
| `assets[]` | 每项 `{id,asset:{id,name,serialNumber?},condition,accessories?,quantity?,provenance}` |
| `quantity?` | 原文数量/UOM/精度/来源；非零负数拒绝，负零原文保留；缺数量不补1 |

条件与附件说明原样打印；每项资产独立成行。不把附件文字解析为数量，不根据序列号推算数量；不计算价值或折旧，不推断完成交付、法律所有权、签名、付款或接收方认可。

## 绑定与可移植性

打印行由 canonical 输入归一化产生，不允许只改源分支后假设派生行自动更新。重新接入来源时应重新调用 creator；手动工程 JSON 的来源真实性和 canonical/打印快照一致性仍须接入方负责，schema 不是事实认证。

保留中的 `/inspection`、`/handover` 上下文身份及 `/printRows` 的来源事实绑定，受到原 `protectedBindings` 链保护：模型不能改为 static、换 pointer、换格式、替换事实或保留列时换 collection。标签、样式及原有结构删除仍允许；删除重加原身份不能抹掉保护。源数据不因设计调整而改变。

消费者规格：`tests/studio-v3-inspection-handover.test.js` 验证原样测量、缺值、真实绑定与 Save/Open、来源上下文替换拒绝、重复 ID/负资产数/无来源状态等边界；实际运行13项通过。七种表单真实三引擎生命周期最终21/21、7份Chromium实际PDF通过，并入全量2873项/9跳过与75/75组合验收；不是实体打印或认证证明。[完整证据与保留失败](acceptance/STUDIO_V3_GENERAL_IMPORT_MEDIA_20261017.md)。
