# Studio v3 本地 CSV / JSON 导入与字段映射

这是通用 printform Studio 的本地数据导入，不是 ERP 连接器，也不执行数据库写回、审批、过账或计算。入口在 **Data → Import CSV / JSON**，无需编写 Studio 内部 JSON 包装。已有 `printform-studio-v3-dataset` 导出文件仍沿原有数据集导入契约加载；下面的审阅流程适用于普通 CSV / JSON 记录。

## 审阅、预览、Apply

1. 打开普通商业模板或已有的一般自定义表单，进入 Data，选择本地 `.csv` 或 `.json` 文件。一般表单不需要 `/items`、发票字段或启用表格。
2. 选择 **Source record / collection**。JSON 的根记录、根记录数组及嵌套对象记录数组会列出具体 JSON Pointer。嵌套数组保留父记录索引，例如 `/batches/0/lines` 与 `/batches/1/lines` 是两个独立来源，不会自动合并、展平或重排。
3. 选择 **Existing form target**：现有集合（整组替换记录）或 Form fields（只允许单条来源记录）。目标来自当前数据、现有源 schema 及当前模板绑定；界面显示模板标签、路径、类型与 required 标记。它不创建新字段、不猜测别名、不把一个行业的字段套到另一行业。
4. 对每个需要的目标显式选来源字段。集合中所有 required 目标必须映射；旧行的值和默认值不会复制到新行。未选来源字段仍留在原始文件收据中，不会偷偷绑定到表单。
5. 点击 **Preview mapped data**。全部记录均经过目标类型、当前 JSON Schema 及当前启用的实际打印绑定验证；界面只展示前 10 条的原值与结果，展示限制不减少验证范围。此时打印预览、修订号、当前数据和已存数据库都不变。
6. 明确点击 **Apply reviewed import** 后，当前真实表单才改变，并进入原有 Undo / Redo 历史。若有未应用的表格 / JSON 草稿，会先询问是否替换。Save form / Open 保留完整一般数据、schema 和收据。数据库记录仍未被写入；只有兼容旧 `/items` 数据集契约时，才另外提供 Save as new / Save & apply。
7. 改映射会使旧预览失效；Replace import file 可换文件；Cancel 保留当前表单、表格草稿和已存记录。格式错误、缺失映射、后续行缺字段、schema 失败或审阅后项目改变，都不会提交数据。切换项目不会把旧审阅应用到新项目。

### 不依赖发票根结构的一般表单

例如现有严格 schema 的工作记录表单可以只有 `workOrder` 与 `records`，其中 `/records` 的列为 `code:string`、`quantity:string`、`uom:string`，完全没有 `/items`。选择 `/records` 后将 CSV 三列明确映射进去，`quantity` 的 `-001.250` 保持字符串原拼写，不会因为字段恰好名为 quantity 而套用发票数字规则；启用的列格式若明确要求 number，则仍必须满足该数字绑定。原 schema 的 required / additionalProperties / pattern 等约束仍全量执行。

无表格的工单或仅有 `/media/token` 的表单默认选择 Form fields。未启用或不存在的 `/items` 不会成为导入前置条件，也不会自动创建空数组。集合与非表格字段均可通过真实表单预览、Undo / Redo、Save form / Open 及 Export HTML 完成生命周期。

现有本地 demo 数据库与 `printform-studio-v3-dataset` JSON 包装仍保留旧的 `/items` 契约，并未另建一套仓库。若当前一般表单不兼容，Data 会明确解释并禁用这三个旧功能：Save & apply、Save as new、Export dataset JSON；不会为了存进去而加包装字段、删原字段或放宽源 schema。请使用 Save form 保存一般表单。

## CSV：值一律先保留为文本

默认模板可直接使用下面这个完全虚构的文件：

```csv
n,code,description,qty,unit,total
1,00007,"Fictional, 中文 item",2,001.250,2.500
2,00008,Second fictional item,3,2.000,6.000
```

在 `/items` 目标中映射：`/no ← /n`、`/sku ← /code`、`/description ← /description`、`/quantity ← /qty`、`/rate ← /unit`、`/amount ← /total`。其中 no / quantity / rate / amount 必须明确选择 number 转换，其余 Keep exact source。`00007` 保留前导零；转换后的 rate 为数字 `1.25`，原文件中的 `001.250` 仍在本地收据中。金额来自文件，不由数量乘单价生成；原有汇总、税额不会重算。

CSV 使用逗号分隔、第一行表头，支持双引号包裹的逗号、换行与 `""` 转义双引号；支持 CRLF、LF 和 CR 行结束、可选 UTF-8 BOM。字段两侧空格属于原值，绝不自动 trim。表头保留原拼写，但在去除两侧空格、Unicode NFC 归一化及忽略大小写后重复的表头会拒绝，避免同名映射歧义。空表头、原型相关表头、字段数不一致、未闭合引号、引号后多余字符都会拒绝。尾部普通换行不创建新记录；额外空白记录不被静默丢弃。

`=SUM(...)` 等单元格只是普通文本：不会执行公式、脚本、链接或外部请求。分号 / Tab 分隔、Excel 工作簿、压缩包及自动编码侦测不在这个入口的格式范围内；请明确另存为 UTF-8 CSV。

## JSON：普通记录与嵌套记录数组

```json
{
  "customer": "Fictional local customer",
  "batches": [
    {"lines": [{"id": 9007199254740993, "amount": 1.2300}]},
    {"lines": [{"id": "00009", "amount": "-001.250"}]}
  ]
}
```

可选择根记录映射客户名称，也可选择 `/batches/0/lines` 映射到现有表格。每次 Apply 只针对一个选定目标 scope；要映射独立表头和行集合，可分别审阅 / Apply，第二次保留未映射的表头字段。选择来源数组时行顺序原样保留。

为避免原生 JSON 数字解析损失大整数 ID、负零或小数拼写，**JSON 数字 token 在映射前也保留为文本**：上面的 id 是 `"9007199254740993"`，amount 是 `"1.2300"`。布尔值与 null 保留其 JSON 类型；对象 / 数组不是标量字段，不会被隐式序列化成文本。重复 JSON 名称（含转义后相同的名称）、`__proto__` / `prototype` / `constructor` 键、非 JSON 语法都拒绝。路径使用严格的 JSON Pointer 转义，无法通过原型路径写入对象。

## 明确转换，不推断业务含义

- Keep exact source：保持字符串 / 布尔 / null 原值，数字词法保持文本。
- Explicit text：使用明确的文本转换，界面预览显示结果；不 trim、拼接、改大小写或换 UOM。
- Explicit number：只接受无分组逗号、无外围空格、无前导加号的十进制 / 科学计数法文本，可明确转换带前导零的小数；结果必须有限，且不能成为不安全整数。数字可能丢失小数位拼写或精度，必须审阅结果；原文件文本仍留存。转换后的负零规范为可 JSON 往返的数字零。
- Explicit boolean：仅接受 `true` / `false`（布尔或对应小写文本），不猜测 yes/no、0/1 或空白。

当前 schema 不会被推断、改写或放宽。JSON Schema 的 required / const / enum / 类型等继续生效，现有来源 sourceId / datasetId / version 仍沿原契约保留。字段映射不是源 schema 证明，也不证明文件来自某 ERP。

审批、状态、签名及来源 / provenance 元数据不提供通用映射。包含保护状态 / 来源字段的集合不能整组替换。非空字符串 `profile` 或 `claim.basisProfile` 视为显式来源档案标签，整体拒绝此映射入口，避免修改派生 `/printRows` 后与业务原记录失同步；未知版本也不会冒充已支持，请使用对应源适配器。普通对象型客户 `profile` 不再仅因字段名误判为档案标签，可与一般工单一起保留，但其受保护子路径仍不能被通用映射修改。税额、币种、独立金额、UOM 等允许映射到适用的既有普通字段，但必须明确选取并通过当前校验；不会推断税率、换汇、单位换算、审批、过账、付款、交货或验收。

## 本地来源收据与隐私

Apply 的事务同时保存 `manifest.localImport`：版本、文件名、原始完整文件文本、选定源 / 目标 Pointer 和明确转换映射。只保留当前最近一次导入的收据；它只描述这些映射，并不声称文件生成了所有未映射字段。收据会重解析、重放并与当前映射目标逐行核对；被改成不一致的收据或数据不能作为有效收据重新打开。

**Save form、Export dataset JSON 和 Export HTML 会有意包含该原始文本，即使其中有未选择的列。** 界面在 Apply 前及当前数据来源行明确提示这一点。请仅用虚构数据或有权导入 / 分享的文件；本入口不向远程数据库发送数据，也不自动发送到 AI。正常数据替换、验证样本及手动数据编辑清除旧活动收据，避免把新数据误称为旧文件来源；字节相同的数据保存可保留收据。Undo / Redo 同时恢复当时的数据与收据，便携文件 Save / Open 恢复实际数据、既有 schema 和匹配收据，而不是重放隐藏的数据库选择。

新增 **Share copy…** 可显式下载另一份可编辑 JSON 或独立 HTML，只去掉本地导入 receipt/session，不改默认 Save with source／HTML with source。全部 live data（包括未绑定值）、打印内容、图片和设计元数据仍保留；原文件名若也存入这些位置仍在，不是匿名化。原生下载逐字检查、unsaved/Undo/原receipt及重开证据见[文件隐私验收](acceptance/STUDIO_V3_FILES_PRIVACY_20261017.md)。

## 有界范围

- 输入文件最多2MiB，先检查 native File 字节大小，再以fatal UTF8解码拒绝非法序列，不用替代字符改写原值。项目文件相同入口读前限制10MiB。JSON最深16层、最多50,000节点；CSV也受总节点限制。
- 单次选定来源为 1–500 条对象记录；最多 250 个来源 scope、每 scope 最多 250 个标量字段、最多 250 个目标映射。
- 数组内的子数组按具体父 scope 单独选择；标量数组不自动转换为对象表。
- 映射后数据仍受既有项目限制。预览调用真实 Save form 序列化函数，连同完整 manifest、原 schema、数据和原始文件收据，按现有项目 Open 契约校验 10 MiB、18 层及 50,000 节点限制。收据自身的 JSON 序列化另限 3 MiB；单独来源文件、数据和 schema 即使各自合格，完整项目仍可能超限，不会截断原文或记录来通过。旧数据集包装另保留其既有 2 MiB 限制，不作为一般表单导入的根结构门槛；含新收据的旧数据集会在写入前核对该包装限制。
- 此功能只验证本地数据与绑定，不提供远程源真实性、行业合规、实体打印或生产资格证明。

## 格式依据

- [RFC 4180 §2](https://www.rfc-editor.org/rfc/rfc4180.txt)：表头 / 字段数、字段空格、双引号、嵌入逗号 / 换行 / 双引号的 CSV 规则。本入口明确增加 LF / CR、歧义表头拒绝及有界限制。
- [RFC 8259（含勘误）§4、§6](https://www.rfc-editor.org/rfc/inline-errata/rfc8259.html)：对象名称唯一性对互操作性的意义，以及不同实现数字范围 / 精度的差异。本入口采用保留数字词法并显式转换，而不是静默依赖原生浮点解析。

## 实际验收（2026-10-17）

两个消费者文件24项通过；最终三引擎18/18覆盖严格records、无表格工单、手机375px、真实文件选择/Preview/Apply/Undo/Redo/Save/Open/独立HTML及无效UTF8。原生Chrome额外验证普通对象型profile可审阅，预览仍r0；手机来源/转换框均339px、所在行355px、全局横向溢出0，完整原文分享警告紧邻Apply可见。Firefox后台iframe定位失败与测试助手命名错误保留，最终用真实可见打印预览和现有主世界DOM策略，不放宽原预期或预算。[组合验收](acceptance/STUDIO_V3_GENERAL_IMPORT_MEDIA_20261017.md)。

同日追加：250target/250source fields原生只呈现10个映射选择框、2510options；翻到第25页再返回，先前映射保留。500行坏数据在第500行被拒绝，合法版本实际保存500行及完整原CSV。Keep恢复显式csv/json格式、raw source与mapping，不靠240字符display filename猜扩展名；过期read不能覆盖新编辑或新review。上述机制不扩大大小／节点／格式限制。
