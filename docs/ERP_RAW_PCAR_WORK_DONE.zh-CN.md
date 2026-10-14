# Globe3 raw PCAR / SO work-done 打印契约

状态：**Production Pilot**。本次实现 raw 字段映射、明确基准的 gross movement 和实际 portable print project；不查询生产数据库、不授权租户、不记账、不计算税/保留款/净应付，不声称适配所有 Globe3 客户版本。

## 1. 已实现入口

```js
// 路径相对仓库根目录；在安装依赖的 Node / bundler 运行，不是裸浏览器独立包。
import { adaptGlobe3ProgressClaim } from './studio-v3/globe3-progress-claim-adapter.js';
import { createGlobe3RawProgressClaimProject } from './studio-v3/globe3-progress-claim-project.js';
import { saveProject } from './studio-v3/file-io.js';

const normalized = adaptGlobe3ProgressClaim(rawInput);
const project = createGlobe3RawProgressClaimProject(rawInput);
const portableJson = saveProject(project); // Studio Open .printform.json → save/export
```

真实 ERP 集成每次刷新输入后重新运行 creator。格式化 display 字符串是打印快照，直接改 raw JSON 数字不会重生成字符串。测试 fixture `tests/fixtures/globe3-progress-claim.js` 全部自行编造，不是客户样张。

## 2. 输入结构及已确认字段

`{ header, workDoneRows, salesHeaders, salesLines, previousCertificates?, context }`：

| 输入 | 必需/约束 |
| --- | --- |
| header | `scm_sal_main`：`uniquenum_pri/dnum_auto/date_trans/companyfn/curr_short_forex/curr_decimal`；`cslsegm` 或 `tag_table_usage` 必须为 `entp_pbill`，若两者提供须一致 |
| workDoneRows | 已授权、按源顺序、仅 active AR `trans_tab_data` 的 `wd_detail_soc` 数组；最多 500 行；每行 companyfn、单据 FK、SO header/line link 与选定 numeric slots 必需 |
| salesHeaders | 已授权、active `sal_soc` header；`uniquenum_pri/dnum_auto/companyfn/curr_short_forex/curr_decimal` 和显式 storage type |
| salesLines | `scm_sal_data`：`idcode/uniquenum_pri/uniquenum_uniq/companyfn/tag_table_usage`、`stkcode_code/stkcode_desc/qnty_total/price_unitrate_forex/extnamt_orig_forex`；stock code/description 可明确为空字符串 |
| context entities | `company/customer/project`，各 `{id,name}`；不是身份或授权凭据 |
| context period | `{from,to}`，有效 ISO Gregorian date 且非倒置；不从交易日期猜账期 |
| context profiles | 明确 `basisProfile/linkProfile/workDoneMeasureKind/numericSlotVariant`，不自动猜版本 |

可选 header `dnum_reference/creditterm_desc/wflow_status` 保留提供值；付款条款使用交易快照，不查客户主档、不推导 dueDate。

`party_unique/entprojfn` 若提供且非空，须与 context 相符。每个 consumed raw record 的 companyfn 都须相符。已提供 lifecycle flags 只接受已知码，inactive/void 不作为 active work/certificate；tab 不提供 lifecycle 字段时，**active 过滤仍是上游查询义务**，本适配器不声称证明其查询完整性或权限。

## 3. 精确 SO join：不能只取第一条

| profile | header link | line grouping link |
| --- | --- | --- |
| `ar-soc-line25` | `var_50_001 → scm_sal_main.uniquenum_pri` | `var_25_001 → scm_sal_data.uniquenum_uniq` |
| `view113-line50` | 同上 | `var_50_002 → scm_sal_data.uniquenum_uniq` |

必须同时匹配 SO header 与 line group。**`scm_sal_data.idcode` 才是行 PK；`uniquenum_uniq` 不是全球或单行唯一键。** 同一 header/group 匹配多行会报 `GLOBE3_PCAR_JOIN`，不按数组先后选择，也不猜金额应如何聚合。不同 header 的同名 group 可以正确区分。

Contract/item total 使用 **`extnamt_orig_forex`，不是 `extnamt_dist_forex`**。AR 的 `wd_detail_soc + scm_sal_data` 不得换成 AP 的 `wd_detail + scm_pur_data`。

`linkProfile`、`numericSlotVariant:'d0'|'d'` 必须由集成端对照该 ERP 版本声明。选定 profile 缺槽位不回退到另一版本；同一 numeric slot 的两个版本若同时存在且金额不同，明确拒绝。

## 4. Quantity 与 fraction 两种版本不能混淆

已确认资料存在差异：有的 `num_20_4_d0_001` 是 quantity，有的是 Work Done fraction。不能因为值小于 1 就猜它是比例。

| 槽位（d0；d 版本相应替换） | 映射 |
| --- | --- |
| `num_20_4_d0_002` | 来源累计 Work Done gross amount；4 位精度 |
| `num_20_4_d0_001` | 来源 Work Done measure；明确 quantity 或 fraction；4 位精度 |
| `num_20_2_d0_001` | 来源累计 Work Done display percent |
| `num_20_2_d0_002` | stored Last Claim percent |
| `num_20_2_d0_003` | stored Last Claim amount |
| `num_20_2_d0_004` | stored Last Claim quantity |

- `workDoneMeasureKind:'quantity'`：Previous/Current/Cumulative 打印数量及数量差额。
- `'fraction'`：保留 raw fraction，打印提供的 percent 及 percent 差额；**不将 fraction 当 quantity，不将 Last Claim quantity 当 previous fraction**。
- 不做 `quantity × price`、`fraction × contract total` 的金额重算；stored Work Done amount 是来源值。
- Work Done movement 不是客户 view113 的 `Current Usage` 库存/DO 字段；后者可有累计语义，本 API 不将两者混用。

## 5. Previous / Current 的来源

### `globe3-prior-certified`

必需明确提供 `previousCertificates` 数组，即使是空数组。每项：

```js
{
  header: { /* entp_pcar raw header；同公司/客户/项目/币种/精度 */ },
  workDoneMeasureKind: 'quantity', // 与当前选择一致
  workDoneRows: [ /* 该证书的 wd_detail_soc */ ]
}
```

- eligible 证书须具有显式 `tag_wflow_app_yn:'y'`、非 inactive/void，日期不超过 `context.asOfDate`（未提供则用 claim date）。这是限定 profile 的批准证据，不是通用会计确认规则。
- 从**上游提供且已限定为 prior 的完整 snapshot**中选最新日期；不宣称已查询整个数据库。数组顺序不决定最新。
- 同一天有多个 eligible 证书时，须用 `context.previousCertificateId` 明确选最新集合中的一项；不能选择更早或不合格记录。
- 无 eligible 证书的明确 snapshot：Previous＝0，Current＝本次 cumulative。
- 有 prior 证书却缺匹配行：拒绝，不把未知变成零。真正新增工作可用 `context.newWorkLines:[{salesHeaderId,lineGroupKey}]` 明确声明；与已有 baseline 冲突或未使用的声明会拒绝。
- 数量/比例 mode 或币种/精度改变时不猜转换，明确拒绝。

### `globe3-stored-last-claim`

Previous 使用 current row 的 stored Last Claim，Current＝cumulative Work Done − stored Last Claim。它与 prior-certified 模式可以得到不同数字，不能以“都叫 Previous”为由交换。

所有 gross/measure 差额使用整数单位精确转换；允许负额修订、零值和 on-source 回退。**不再从 Current gross 额外扣一次前期申请、证书或付款。**

## 6. 输出与打印语义

输出：`{document,company,customer,project,claim,valuations,summary,headerAmounts}`。

- `valuations` 保留精确 SO/line PK、SKU、描述、原合同金额、quantity/rate raw 值、Previous/Current/Cumulative gross 与 measure、源 slot 和 input ordinal。
- `sourceRowIndex` 是输入位置，不是 `trans_tab_data` 行 PK。`source.basisKind` 区分 certified record、stored Last Claim、无 eligible baseline、explicit new work。
- Work Done gross 为 4 位；header monetary values 按来源 `curr_decimal`；SO 原金额按其 header 精度，可由明确 `context.linkedAmountPrecision` 指定已发现的列精度。rate/quantity 保留来源十进制精度（支持 0..6）。不静默四舍五入或超过安全整数单位范围。
- 可选 header `subtot_forex/nettot_forex/amount_forex/salestaxamt_forex` 独立标为 **ERP header supplied figure**，不将它们或 gross 和总视为净应付、booked AR、已收款或 outstanding。
- 不映射未知 main-tab retention 参数为金额：不同 profile 的 `num_20_4_d0_001` 可能是百分比，不能按名字硬当 retention amount。
- creator 使用 A4 landscape、`/valuations` 和现有受控模型/分页器；不伪造 `/items` 或商品行。legacy dataset workbench 的 `/items` 限制不因此被认证。

## 7. 限制与研究证据

上游必须保证身份、company/project/customer 授权、active/prior/revision 过滤、snapshot 完整性与来源货币语义。跨币种 SO/claim 或 prior certificate 需要另一个已验证转换契约，当前明确拒绝；不把 header currency 换名当换汇。normalizer 接受三字母来源币种，Studio 主币种仍限 MYR/USD/SGD/EUR/CNY/JPY。

未声称复刻完整客户 view113 的“monthly DO pages + cumulative stock-code rollup”、未验证的 omission line joins、全部 raw PCAR main financial variants、live ERP 或物理打印机。既有 canonical net PCAR creator 仍适用于 ERP 已计算净额的输入，本 raw creator 明确打印 gross。

内部来源（只引用 ID，客户实例不复制）：

- AR/SO join、原金额 vs distributed、AP 区分：KB `3e0af142-1e70-459d-b5e1-0923d3b02f52` / `26e2618c-52f4-49df-af73-cc5c86dc4c82`。
- fraction/financial slot schema：同 base / `f37e5b36-1558-4bbf-9d43-5f067c846524`。
- header/data identity（idcode 与 group key）：同 base / `dbf46c4e-d2ef-4233-b431-5b087d058875`。
- Last Claim、Current Usage、active rows、transaction terms：同 base / `21bb206a-5a94-4f61-8d71-a7079e282696`。
- view113 exact header/line link 与 terms：KB `82ebf7fd-6f91-4d7b-baba-9f006fb34362` / `26ead42b-161d-4217-bfbd-64c1f30eab87`。
- prior-certified 基准：同 base / `8bbb1325-888f-42b4-a18a-31f63c2d1654`。

公开业务边界沿用 [CIDB 官方合同指南](https://www.cidb.gov.my/wp-content/uploads/2024/10/GUIDE-FAQs-ON-THE-CIDB-SFOC-BUILDING-WORKS-2022-Edition-Published-October-2024.pdf)与 [AIA G702 官方说明](https://designshop.aia.org/products/g702-1992-application-and-certificate-for-payment)：previous-certified、previous-payments、申请/认证差异不能全行业混为一个字段。

执行证据见 §8，仅对应列明的独立工作树与自行编造输入；测试文件本身不等于生产验收。

## 8. 选项 1 独立验收

已暂存隔离选项 2/3 的未合并修改，在仅 baseline + raw PCAR 的工作树运行：

- `npm run build:site`：**217 files / 2,072 tests passed**；新增 raw 业务/拒绝回归 50 项；runtime、site 和 agent release gate 成功。
- `npx playwright test e2e/studio-v3-globe3-progress.spec.js --workers=3`：Chromium/Firefox/WebKit **6/6 passed**，quantity/prior-certified 与 fraction/stored-last-claim 分别执行 Open → save/reopen → offline export。
- 实际打印截图已查看；两种 Chromium PDF 各 2 页。PDF.js 确认 `SGD 271.471`、原 SO 金额 `SGD 2005.000`、四位 valuation `SGD 349.7500 / SGD 150.1250` 和 `2026-08-20` 保真。
- 无假 commodity rows、税/净额/FX 计算、booked balance 或生产接口证明。原料仅为自行编造的两个 SO/line-group snapshot。

