# Odoo 17 维修请求：受限只读快照 → 可编辑打印项目

本入口是**仓库内 Node SDK**，不是 Odoo 连接器、浏览器公开 SDK、Data picker 的原生 RPC 导入器或 ERP 专用产品方向。
通用浏览器产品继续使用现有 `MaintenanceWorkOrder`；不新增 canonical kind。
无需安装 Odoo、Python、数据库客户端或在线服务。只有调用者已经获授权取得的本地快照参与转换；适配器没有网络、登录、设备或打印提交操作。

## 官方依据与不可变版本

仅支持官方 `odoo/odoo` 的 `17.0` 源码契约，固定提交
`355ff1d2eda010766b87d4bf403794382ceaec7a`。引用均绑定该提交，不把可移动分支当版本证明：

- [maintenance.py：stage、equipment、request](https://github.com/odoo/odoo/blob/355ff1d2eda010766b87d4bf403794382ceaec7a/addons/maintenance/models/maintenance.py)：
  `MaintenanceStage` 的 `name`、`fold`、`done`；`MaintenanceMixin.company_id`；
  `MaintenanceEquipment` 的 `name`、`serial_no`、`location` 与计算型 `display_name`；
  `MaintenanceRequest` 的 `name`、`company_id`、`equipment_id`、`stage_id`、`request_date`、`description`、`schedule_date`、`instruction_text`。
- [res_company.py：Company.name](https://github.com/odoo/odoo/blob/355ff1d2eda010766b87d4bf403794382ceaec7a/odoo/addons/base/models/res_company.py)：
  `res.company.name` 是必填、存储的关联名称，不从请求的显示标签猜公司名。
- [fields.py：Many2one.convert_to_read](https://github.com/odoo/odoo/blob/355ff1d2eda010766b87d4bf403794382ceaec7a/odoo/fields.py#L3120-L3133)：
  带显示名的 native read 关系输出 `(id, display_name)`，JSON 表示为 `[id, display_name]`；
  未设置关系为 `false`。本 profile 不接受 `load=None` 的裸数字关系、CSV、任意 RPC 响应或其他 Odoo 版本。

注意：`17.0` 是分支系列版本字符串；此入口还要求精确提交 SHA。
这些元数据仅声明调用者选择的源码契约，**不认证真实服务器版本、数据库、用户权限或快照来源**。
适配器不会证明部署中没有自定义模块，也不会提升项目为生产合格。

## 精确入口契约

导出：

- `adaptOdooMaintenanceRequest(input)` → 规范化的通用业务数据，附 `odooEvidence`。
- `createOdooMaintenanceRequestProject(input)` → 可由 Studio Open 打开的真实项目，`sampleData.odooEvidence` 保留输入。
- 常量：`ODOO_MAINTENANCE_REQUEST_PROFILE`、`ODOO_MAINTENANCE_REQUEST_VERSION`、`ODOO_MAINTENANCE_REQUEST_REVISION`。

输入仅允许以下 envelope 属性；profile、版本、revision 不一致立即拒绝：

```js
{
  profile: 'odoo-maintenance-request-17.0-read-v1',
  context: {
    odooVersion: '17.0',
    sourceRevision: '355ff1d2eda010766b87d4bf403794382ceaec7a',
    database: 'authorized-db-name',
    requestId: 417
  },
  snapshotJson: '...原样保留的、合法 UTF-8 JSON 文本...'
}
```

`snapshotJson` 是调用者的**授权导出 envelope**，不是伪称 Odoo 原生返回了下述包装。
授权导出程序须将同一数据库中已选请求和关联 read 记录放入这些 model/record 包装；不访问真实服务器的 SDK 无法自行保证其来源真实性。
外层 `database` 与 `context.database` 必须完全相等；请求 `record.id` 必须与 `context.requestId` 相等。

```json
{
  "database": "authorized-db-name",
  "document": {"model": "maintenance.request", "record": {
    "id": 417, "name": "Inspect pump vibration",
    "company_id": [9, "Workshop display label"],
    "equipment_id": [63, "Pump/serial display label"],
    "stage_id": [4, "Review display label"], "request_date": "2026-10-23"
  }},
  "equipment": {"model": "maintenance.equipment", "record": {
    "id": 63, "name": "Circulation pump", "company_id": [9, "Workshop display label"]
  }},
  "company": {"model": "res.company", "record": {"id": 9, "name": "Workshop"}},
  "stage": {"model": "maintenance.stage", "record": {"id": 4, "name": "Technician review"}}
}
```

严格边界：

1. ID 必须为正的 JS safe integer；不接受字符串 ID、零、负数、不安全整数或伪造缺省 ID。
2. 请求、设备、公司必须存在，model 精确匹配。关系必须是两项 `[id, 非空显示标签]`，关联 ID 与所供记录一致。
3. 请求公司必须匹配所供公司。设备公司必须匹配该公司，或显式 `false` 表示共享设备；遗漏设备 `company_id` 不视为共享。
4. 请求 `stage_id` 缺失或 `false` 时不得夹带 stage 记录，也不生成状态。
   若 `stage_id` 已设置，则 stage 必须存在且 model、ID、name 有效；不从标签构造缺失 stage。
5. model/record 包装和导出 envelope 拒绝未知字段；native `record` 内的其他 JSON 字段完整保留、默认不打印。
6. `request_date` 必须是实际存在的 `YYYY-MM-DD` 日历日期；原生虽允许 unset，此 profile 在缺失/`false` 时拒绝，绝不以今天、创建日、`schedule_date` 或浏览器时区补齐。
7. 可打印的设备 `serial_no`、`location` 缺失、`false` 或空字符串时省略；其他非文本类型拒绝。
8. 复用现有 `safe/object/text/date` 与 bounded JSON：数据上限 2 MiB、深度 16、节点 50,000；原文和外层序列化均受约束。
   先用现有 `parseLosslessRecords` 检查原文 token，再做保留 native 类型的解析；不是解析后才比较身份。
   所有层级的重复键（包括解码后相同的 Unicode 转义键）、危险键、非法 JSON、非 JSON 值等均拒绝，且不修改原输入或此前成功项目。
   因此 `database`、native `id`、model 或关系不能借 JSON 的 last-key-wins 隐藏冲突；即使重复值相同或字段不打印，也拒绝歧义快照。

## 映射含义：请求不是执行

| 通用字段 | 唯一依据与边界 |
| --- | --- |
| `source.id` / `maintenance.order.id` | 请求 native `id` 的无损十进制字符串；原数字和数据库身份仍留在 evidence |
| `document.number` / `source.number` / `maintenance.order.number` | 原生 `name` **主题**；Odoo 此模型没有独立工单流水号，不伪造编号 |
| `document.date` | 原生 `request_date`；源码含义是希望维修发生的日期，不是创建或执行证明 |
| `company.id/name` | 经过关联验证的 `res.company.id/name` |
| `maintenance.asset` | 经过关联验证的设备 ID/name；可选原生序列号、位置，不猜资产编码 |
| `maintenance.tasks[0]` | 原生请求 ID、`name` 主题与明确 provenance；仅一个“请求任务主题”，不是拆分操作步骤或执行记录 |
| `maintenance.status` | 仅存在 linked stage 时采用其原生 `name`，不是关系显示标签、完成结论或审批状态 |

任务不合成 `quantity=1`，不生成任务状态、UOM、金额、工时、指令或执行人。
canonical 要求至少一项 task；原生 subject 是有来源的请求内容，因此足以形成这一项；空 subject 则拒绝。

`schedule_date` 是 Datetime，完整保留但不截日期、不猜时区，也不映射为 canonical `scheduledDate`。
`description` 与 `instruction_text` 是 Html：完整保留在 evidence，不去标签猜纯文本，不直接插入模板。
即使原生 subject 本身含 `<img>` 等文本，也原样作为文本绑定；不是 HTML 执行入口。
`fold` 仅表示看板折叠，`done` 是不同的原生标志；二者、`kanban_state=done`、`archive`、`close_date`、`duration` 均不生成完成、审批或执行证明。
任何关系的 `display_name` 不必等于原生 `name`（设备可能带 serial 后缀、名称可能翻译）；只验证非空标签与正确 ID，绝不把标签冒充原生名称。

## 仓库 Node 用法与浏览器流程

从仓库根运行本地脚本，不从浏览器动态 import 未发布模块：

```js
import { readFile, writeFile } from 'node:fs/promises';
import {
  ODOO_MAINTENANCE_REQUEST_PROFILE as profile,
  ODOO_MAINTENANCE_REQUEST_REVISION as sourceRevision,
  createOdooMaintenanceRequestProject
} from './studio-v3/odoo-maintenance-request-adapter.js';
import { saveProject } from './studio-v3/file-io.js';
const snapshotJson = await readFile('./authorized-maintenance-snapshot.json', 'utf8');
const input = { profile, context: { odooVersion: '17.0', sourceRevision,
  database: 'authorized-db-name', requestId: 417 }, snapshotJson };
await writeFile('./maintenance-request.printform.json', saveProject(createOdooMaintenanceRequestProject(input)));
```

Studio：**Open** 生成的 `.printform.json` → 查看预览、编辑布局 → **Save** → 再次 **Open** → **Export** → 离线打开下载的真实 HTML。
不是把原生快照交给 Data picker 自动识别；通用编辑器只消费已经生成的项目。

`tests/fixtures/odoo-maintenance-request.json` 的业务身份和数值均虚构，并故意包含未打印私密标记、HTML 与不同的关系显示名。
行为回归覆盖错误关系、缺少设备、缺失可选数据、恶意文本、原文保留、拒绝不变更和布局编译后保留。
专用 `e2e/studio-v3-odoo-maintenance-request.spec.js` 先真实调用 Node SDK，再走 Open/Save/reopen/export；
读取下载文件并从 `file://` 在阻断 HTTP(S) 的页面检查打印内容、注入不执行和嵌入的原文。
主集成实际隔离全量`build:site`通过272文件／3412测试，9项opt-in跳过；39个三引擎消费者全部通过、2 workers／零重试，包含11类通用New及Odoo完整／可选缺失两种场景。最终夹具采用两个仓库测试运行器共同的cwd文件读法；其后51项SDK回归、127契约／39审查及精确站点重新生成通过。最终合并源码的全量结果以其CI为准。

失败保留：初轮51项均在fixture URL加载入口失败，业务断言未执行；第一次FileURL修正后51项通过。随后Playwright因CommonJS不支持import.meta在0场景时失败，统一改用仓库cwd读取后才得到上述39项。未修改产品parser／模型／预算或放宽断言；真实重复身份键问题另以修复前接受、修复后`BUSINESS_FACTS_SOURCE_JSON`拒绝的Node消费者记录证明。

## 隐私与证据限制

`odooEvidence` 保存**整个输入 envelope 与精确 `snapshotJson` 字符串**，包括未映射的 native 字段、数据库名称及联系人等。
模板不绑定这些字段只表示“不打印”，**不表示“没有携带”**。
普通 Save、分享保存和导出 HTML 都保留 live sample data；去除本地来源 receipt 的共享选项不是 native evidence 脱敏。
共享前应在授权导出边界最小化字段、删除不允许分享的信息，再重新生成项目；不要只隐藏打印列。

测试可证明这份已知 UTF-8 文件解码后的文本，在项目 IO/HTML 往返后再次 UTF-8 编码与原 fixture 字节相同，包含空白和换行。
这不证明任意输入原始编码、非法 UTF-8 字节、服务器响应字节、网络传输、签名或用户授权；SDK 不接收原始 byte buffer，不替调用者做来源认证。
原文不会被 JSON 重排重建，但导出的项目和 HTML 是不同文件，其外层转义与字节本来就不同。
