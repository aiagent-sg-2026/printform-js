# ERPNext Quality Inspection 可选离线来源适配

## 范围与固定官方来源

这是仓库／Node 集成 SDK：有权导出的 ERPNext 原始快照 → 现有 `supplied-business-v1` 的 `InspectionReport` → Studio 工程。复用既有 canonical **11 类**契约、编辑器、绑定、分页、Open／Save 与单 HTML 离线导出；没有新增 ERP 专用 UI、原始 JSON 导入按钮、ERP connector、登录或源服务器认证功能。普通使用者仍从浏览器 Studio 操作，集成方才调用 SDK。

实际核对官方 `frappe/erpnext` **v15.0.0**，固定不可变提交 **`0925cb28c7ab93b7900dd8f37527482d30b21785`**。不是跟随可移动分支，也不声明兼容其它 v15、小版本、自定义字段逻辑或所有 ERP。

- [官方 tag → commit](https://api.github.com/repos/frappe/erpnext/git/ref/tags/v15.0.0)。
- [Quality Inspection schema](https://github.com/frappe/erpnext/blob/0925cb28c7ab93b7900dd8f37527482d30b21785/erpnext/stock/doctype/quality_inspection/quality_inspection.json)：`report_date`、`reference_type/reference_name` 动态关联、`item_code/item_name`、`batch_no/item_serial_no`、`sample_size` **Float**、`status` Accepted／Rejected、`readings` 子表。QI 本身没有 Company 字段，公司来自明确关联的参考单据。
- [Quality Inspection Reading schema](https://github.com/frappe/erpnext/blob/0925cb28c7ab93b7900dd8f37527482d30b21785/erpnext/stock/doctype/quality_inspection_reading/quality_inspection_reading.json)：`numeric`、`formula_based_criteria`、`manual_inspection` 是 Check；`reading_value`、`reading_1` 至 `reading_10` 和 `value` 都是 **Data**；只有 `min_value/max_value` 是 Float。这些 reading 字段没有原生 measurement UOM／独立精度声明。
- [Quality Inspection controller](https://github.com/frappe/erpnext/blob/0925cb28c7ab93b7900dd8f37527482d30b21785/erpnext/stock/doctype/quality_inspection/quality_inspection.py)：`inspect_and_set_status`、`set_status_based_on_acceptance_values`、`min_max_criteria_passed`、`set_status_based_on_acceptance_formula`、`calculate_mean` 是 **ERP 端逻辑，不在本适配器执行**。`parse_float` 明确说明 reading Data 可以使用用户的数值格式。`before_submit` 要求每个 reading 有 status；`update_qc_reference` 使用参考单据与 item，Job Card 使用 production_item，Stock Entry 使用 Stock Entry Detail。

输入中的版本、提交和 site 是调用方声明的选定来源边界；本地一致性检查不是网络真实性、导出权限、生产质量或审计认证证明。测试数据全为 fictional。

## Node API 与真实浏览器消费者

```js
import { createErpNextQualityInspectionProject,
  adaptErpNextQualityInspection } from './studio-v3/erpnext-quality-inspection-adapter.js';
import { saveProject } from './studio-v3/file-io.js';

const facts = adaptErpNextQualityInspection(authorizedInput);
const project = createErpNextQualityInspectionProject(authorizedInput);
const serialized = saveProject(project);
// 集成方将 serialized 保存为 .printform.json；普通用户在 Studio Open 打开。
```

`adapt…` 返回经过原有 canonical normalizer 的事实与 `erpnextEvidence`；`create…Project` 返回可编辑／可保存的现有工程。二者原子拒绝：不修改输入、已有工程或外部 ERP。带派生 `printRows`／原始证据的返回值不是另一个 canonical 输入 profile，不应再次直接当作 canonical 原始输入。

## 输入契约

| 字段 | 要求 |
| --- | --- |
| `profile` | `erpnext-quality-inspection-v15.0.0-read-v1` |
| `context.erpnextVersion` | `15.0.0` |
| `context.sourceRevision` | 上述完整不可变提交 SHA |
| `context.site` | 非空、明确选定的来源身份字符串；不访问此地址，不接收认证信息 |
| `context.inspectionName` | 与原始 QI `name` 严格相同 |
| `context.referenceRowName` | 非 Job Card 时必需，明确选择参考单据的一个原始子行；Job Card 禁止虚构该子行 |
| `snapshotJson` | 保留原始 JSON 文本，顶层为 `{site, document, reference, company, item}`；不先由调用方丢失重复键再重建 |
| `exact` | 可选授权精确 measurement 事实，见下一节；未消费 key 拒绝 |

`snapshotJson` 保留原始字段、空白与换行。先复用 token-first parser 检查解码后的键，再做 typed JSON 解析；重复键（含 Unicode 转义别名）、任意层的 `__proto__`／`prototype`／`constructor` 都拒绝。复用 2 MiB 数据限制、16 层、50,000 节点；完整输入／canonical 数据还须满足现有保存边界。reading／参考子行各不超过 500，映射后 canonical observation 总数不超过 500；超限拒绝，绝不截断原始证据。

### 身份与关联

- `document.doctype = Quality Inspection`，name 对应选定 inspectionName；真实 `report_date`，docstatus 只能是 0／1／2；`inspection_type` 只能为 Incoming／Outgoing／In Process。
- `reference.doctype/name` 严格对应 `document.reference_type/reference_name`。支持 schema 列出的 Purchase Receipt、Purchase Invoice、Subcontracting Receipt、Delivery Note、Sales Invoice、Stock Entry、Job Card，不从名称猜交易类型。
- `reference.company` 必须对应原生 Company `doctype/name/company_name`。原生 Item `doctype/name/item_name` 必须对应 QI `item_code/item_name`，不以显示标签代替 identity。
- 非 Job Card：显式 referenceRowName 唯一命中参考 items；子行 doctype、parent、parenttype、parentfield、idx 全部一致，item_code 一致，QI 有 batch_no 时也必须一致。重复参考子行身份拒绝。若原始参考记录存在非空 quality_inspection link，必须等于本 QI。
- Job Card 使用明确 production_item，不虚构 items。QI 子行必须是 Quality Inspection Reading，父单／子表／行序一致，name 不重复。
- inspected_by／manual_inspection 按原始字段验证；不映射为审批或签名。支持原始 draft／submitted／cancelled docstatus，不把 lifecycle 翻译成 Accepted／Rejected。submitted reading 缺 status 依固定 controller 拒绝；可选文档／draft reading status 缺失时不补 Accepted 默认值。

## 观察、Float 与精确事实

每个 reading 必须至少有一个当前分支的非空观察；不能用 criteria 或 status 伪造观察。

| 原生来源 | canonical／打印行为 |
| --- | --- |
| `numeric=0` | 原始 `reading_value` → 一个 `checks[].observed`；保留定性文字和特殊字符，按文本绑定 |
| `numeric=1` | 每个非空 `reading_1..reading_10` → 独立 check，按原字段序排列；包括符号、前导零、小数位、区域格式、大数和空白原文 |
| `specification` | 原始 parameter link 文本 → `characteristic`，不编造 parameter 的显示标签 |
| `value` | 非 numeric 且非 formula 时 → `expected` 原文 |
| `acceptance_formula` | 有供应值时 → 明确标示 `Source formula (not evaluated)` 的 expected 文本，不执行 Python／JS |
| `min_value/max_value` | 原生 Float 默认只保留在原始证据；只有匹配的授权精确事实才打印显式 min_value／max_value 标签，不比较、相减、求容差或判定 |
| `status` | 仅供应时保留为 source result／status；即使与观察／criteria 看似矛盾也不重算 |
| `sample_size` | 原生 Float 仅保留原始证据；不把它变为 item count、sample quantity 或单位 |

canonical `inspection.reference` 是**参考单据** id／number；QI 自身身份保存在 `source.id` 与 `document.number`。subject 来自明确 Item，lot／serial 仅来自 QI 原字段。每个 check 保留精确原始 reading 字段路径和说明；没有原生 method 就不发明方法、仪器、校准或测量精度。

数字 reading 的规范字段是 **Data**，故可直接无损打印原字符串，例如 `-0000.1250`、`+0000.0000`、`1.234,50`，无需把它们转换成 Number。其原文并不自动证明 UOM、独立 measurement precision 或可参与运算。

可选 `exact` 用精确路径作 key，例如：

```js
{
  'snapshot.document.readings[1].reading_1': {
    amount: '-0000.1250', decimalPlaces: 4, uom: 'mm',
    provenance: { sourcePath: 'authorized-export/instrument/row2',
      meaning: 'Authorized exact reading, precision and measurement UOM' }
  },
  'snapshot.document.readings[1].min_value': {
    amount: '-0000.2000', decimalPlaces: 4, uom: 'mm',
    provenance: { sourcePath: 'authorized-export/spec/row2/min',
      meaning: 'Authorized exact lower criterion and its declared precision/UOM' }
  }
}
```

必须独立供应 amount／0–6 decimalPlaces／UOM／非空 provenance，复用现有安全十进制校验；不能从 Item.stock_uom、sample_size、Float 的 `String(number)`、小数显示长度或 schema 默认精度猜出它们。

- Data reading 的 exact amount 必须与原 Data 原文完全相同；不能用数值相等掩盖丢失前导零、符号、小数位或空白。
- Float min/max 的 exact amount 是另行授权的十进制事实；typed 原生 Float 只检查一致性，**不作为恢复原精度的依据**。没有精确事实时不打印 limits。
- inactive criteria、sample_size、未使用字段的 exact overlay 都拒绝，避免调用方误以为它们已映射。没有 overlay 时所有观察仍照原文保留，不虚构 measurement。

绝不计算 acceptance／tolerance／mean／average／compliance、范围比较、单位换算、样本统计、合格数量、审批或签署，也不执行原始 formula／remarks。

## 原始证据与分享隐私

`sampleData.erpnextEvidence` 深拷贝**整个输入**，包括原始 snapshotJson、来源身份、版本、exact 与 provenance。未映射原始字段不进入 printRows／打印模板，但仍是工程的 live data，**不是隐藏即删除／脱敏**。

普通 Save、`projectForSharing`、`saveProject(..., {omitSource:true})` 与单 HTML 导出仍保留这份原始证据。分享选项只沿用原有本地导入 receipt／session 清理，不声称删除 ERP 原文。下载前必须人工审查 remarks、inspected_by、verified_by 及其它私密字段；本适配器不提供匿名化、原始字段自动删减或权限认证。

HTML 中数据按既有 exporter 安全嵌入，`</script>` 等源文字不可执行。冷重导入导出的 HTML 后再保存，仍须保持 source 文本 UTF-8 字节与 canonical 事实；不能依靠旧页面保留的状态伪造。

## 交付文件与集成验收入口

- `studio-v3/erpnext-quality-inspection-source.js`：固定官方版本、token-first 解析、身份／父子关系与 exact 事实边界。
- `studio-v3/erpnext-quality-inspection-adapter.js`：canonical InspectionReport 投影和真实 creator API。
- `tests/fixtures/erpnext-quality-inspection.json`：保留原始换行的虚构 raw fixture，含定性、多个数字读数、manual result、formula 与未打印恶意样式文字。
- `tests/fixtures/erpnext-quality-inspection.js`：Node 从仓库 test cwd 读取 JSON；无 `import.meta`，兼容 Playwright CJS transform。
- `tests/studio-v3-erpnext-quality-inspection.test.js`：真实 API、canonical binder、save/read、share copy、字节保真、source status 不重算、七种 reference、重复／转义／危险键、关联矛盾与原子拒绝。
- `e2e/studio-v3-erpnext-quality-inspection.spec.js`：真正 **Node SDK** 创建项目 → 实际 UI Open／Save／reopen／Export → 禁 HTTP(S) 的 file: 离线 runtime → 新页面先打开不同文档 → 冷 HTML reimport／再次 Save；比较完整 sampleData、原始 source UTF-8 字节、观察词法与行序。

初始实现阶段未执行检查；主集成随后实际通过57项Node／canonical／IO消费者，以及Chromium／Firefox／WebKit三项真实UI Open／Save／reopen／Export／禁HTTP file执行／不同文档冷HTML重导入，零重试。完整事实与原始UTF8字节均相同，实际纸面截图已审阅；这些结果不是实体打印或ERP授权认证。[脱敏验收记录](acceptance/STUDIO_V3_QUALITY_SOURCE_20261019.json)。复现入口：

```sh
npx vitest run tests/studio-v3-erpnext-quality-inspection.test.js --maxWorkers=1 --no-file-parallelism
npm run build:site
npx playwright test e2e/studio-v3-erpnext-quality-inspection.spec.js --workers=1
```

这些浏览器与文件消费测试不进行实体打印、扫描、原生打印对话框或网络发现，也不证明真实 ERP 授权、设备、ISO／合规或生产质量资格。
