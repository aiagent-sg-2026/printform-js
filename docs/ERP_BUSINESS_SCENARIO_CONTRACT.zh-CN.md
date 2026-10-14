# ERP 业务场景与金额检查契约（E02 / E03 / E04）

## v3：精确单据类型，而不是通用 family 替代

`scenarioCandidate` 是样本选择器、Validate 矩阵和 Pi `validate_scenarios` 的共同数据入口。它读取当前数据的 `document.kind`；若当前数据未声明 kind，则读取保留的 ERP 数据 kind。已声明 kind 时，使用该 kind 的内置、虚构、独立克隆数据；没有 kind 时才使用 invoice / purchase / delivery 的通用样本。未注册 kind 不降级成 invoice，也不声称已经覆盖该单据。

BankPayment / BankReceipt 保留 `bank`、`cashMovement`、`allocations`、付款/收款方向及对应 summary。ProgressClaim / CertifiedClaim / PCAR / CCAR 保留项目、来源单据、上期证书、申请/认证关系、金额及余额含义。`parentDocuments`、行级来源字段、claim basis、certification 不改成通用 invoice 字段。候选 manifest 币种与内置 fixture 的 `document.currency` 一致；不转换金额、不执行汇率计算。

0 / 1 / 45 / 100 / 500 / long 只调整内置 fixture 的 `/items` 行数、已存在的 `no` 和长文本描述。复制的行保留原有金额与来源字段；summary 不按复制行数重算。因此这些是**排版合成数据，不是新增 ERP 交易、分配或重新计量后的财务真值**。行级来源 ID 可以重复，不能将合成行用于过账或清算。

合成数据不复制用户私有 ERP 值。自定义绑定如果不在内置 fixture 中，继续报缺失；不会为了通过检查编造字段。ERP 样本恢复仍使用会话保留的数据，不用合成样本覆盖来源。

## v2：显式 collection 与原始金额

- `createScenario(data, scenario, collection)` 默认只识别约定的 `/items`，不再扫描首个数组。
- `createProjectScenario(project, scenario, data)` 优先读取 `manifest.sampleScenarios.collection`；否则使用模板唯一的顶层 table repeat。存在多个不同 collection 而未声明时，报 `SCENARIO_COLLECTION_REQUIRED`，不任意选择第一个。
- 自定义绝对 JSON Pointer（例如 `/nested/rows`）仍可声明；其他数组、地址行、variations 等不受影响。
- ProgressClaim 明确声明 `/valuationRows`。string `no` 仍是 string，number `no` 仍是 number；不为没有该字段的行新增 `no`。空 seed 没有权威行形状，不捏造行字段。
- 生成行循环复制原始行；除行号、长文本描述外不改其内容。`totals`、税额、claimed、remaining、contractSummary、valuationTotal、variationTotal、settlement 等完全保留。
- 不从原税额反推税率，不重算税、合计、应付、未付或余额。依赖行合计的已有业务检查可能如实报不一致，不抑制它们。
- ProgressClaim schema 要求至少一条 valuation row；empty 会真实触发 schema 不满足。one / 45 / 100 / 500 / long-text 不能因为行号类型变化产生 `TYPE_MISMATCH`。

`set_sample_scenario` 和 `capture_layout_evidence` 都经过上述项目入口。前者从不可变默认样本生成，后者对待检查项目生成候选；不会改变其现有 revision/evidence 安全边界。

## E04：原样字符串的货币语义标记

ProgressClaim 是 SGD 来源展示字符串，例如 `6,023,176.50` 和会计括号扣款 `(645,650.00)`；这些不是供 `Intl.NumberFormat` 再格式化的数字。模板在实际货币绑定上声明 `data-pf-monetary="currency"`，而不是 `data-pf-format="currency"`。前者只声明金额检查语义，不解析、不舍入、不补币种、不把逗号/括号字符串变成 NaN。币种仍由原始 `currency` 与 manifest 声明。

`inspectMonetaryTokens` 同时检查旧的格式化 currency 和新的来源字符串标记，使用真实 Range / cell / clipping geometry 检查折行、超出、裁剪和标签重叠。无需解析正数、负数或会计括号才能判断几何溢出。百分比、进度、行号和普通文本不标为 currency。金额标记不附加 nowrap、缩小字体、隐藏溢出等掩盖样式。

长文本仍使用原有八次重复的多语描述，纸张、字号、硬高度预算和overflow策略保持不变。新增金额标记实际暴露TOTAL CLAIM的22pt行框小于33px Range字形高度：下边界越过owner约1.67px。该标题保持22pt，只将line-height从1改为1.2，不用缩字、nowrap或提高容差掩盖。仍不能据此宣称所有claim长文本都Printable。

## 可执行回归入口

实际Node24/Vitest4专项 **10 files / 90 tests passed**；删除模板源码/文案断言并强化数据边界后，最终完整`build:site` **224 files / 2,279 tests passed**，runtime/site/publication gate成功。三引擎真实业务consumer最终 **24/24 passed**；普通claim正向控制、长输入失败回滚、货币裁剪与恢复、四类UI seed/ERP恢复均覆盖，未提高timeout或放宽几何约束。

```sh
npx vitest run tests/studio-v3-business-scenarios.test.js tests/studio-v3-scenario-matrix.test.js tests/studio-v2/sample-scenarios.test.js tests/studio-v2/progress-claim.test.js tests/studio-v2/purchase-order.test.js tests/studio-v2/command-bus.test.js tests/studio-v2/monetary-inspection.test.js
npx playwright test e2e/erp-business-scenarios.spec.js --project=chromium --workers=1
```

第一条覆盖选定 exact kinds、所有行数、真实 binding consumer、声明/自定义/多 collection、schema、原始字符串和 command bus；既有 generic matrix 的 UI/Pi adapter parity 保持在原有测试中，不能将其模拟 render 当成实际版面证据。

第二条走真实浏览器：Payment/Receipt/PCAR/CCAR 样本选择与 ERP 恢复；SGD 逗号、负号及会计括号字符串经真实 binder 后保持原样，用实际 Range/cell/clipping geometry 拒绝裁剪并验证解除裁剪恢复；长文本独立经过真实 renderer/inspection 保留失败诊断。金额专项的 DOM 外壳不代表分页成功或 claim Printable。可将 `--project` 分别替换为 firefox / webkit 进行浏览器覆盖。

实际before/after Node smoke读取已提交旧实现并调用真实消费者：ProgressClaim45行原`no`为number，schema返回45个`TYPE_MISMATCH`；修复后`no`为string、45行schema valid且settlement原样保留。PCAR单行原generic candidate丢失document.kind（null）；修复后保留PCAR。临时模块仅在内存运行，未保留脚手架或伪造ERP真值。

首次完整集成实际为224 files：2,270 pass／9 fail，其中8项默认5s timeout，另1项发布gate正确阻断27个过期的传递依赖review。现场`vm.loadavg`为119.90、activecpu10；该事实不被当作所有timeout的因果证明。没有提高timeout、缩减断言或跳过旧测试。核对JSON安全／scenario／monetary的真实依赖后，更新对应owner disposition并保留baseline与授权：实际`check:studio-v3-agent`为13 tools／13 operations／2 skills／76 examples、28 changes全部reviewed，runtime/site重建成功。完整测试成功与浏览器成功不能由此推断，另记录真实结果。

## 首次浏览器失败与边界修复

父任务第一次执行三个浏览器，共 **18 failed / 6 passed**；PCAR/CCAR 六项通过。该失败记录不能写成浏览器验收已完成。原始日志 `artifact://412` 显示：

- 三种金额字符串用例在所有引擎都错误要求整个 claim 的 `formatAll` 成功。真实 RangeError 报 configured 1050px，而 actual Chromium 1051.484375px、Firefox 1051.7333984375px、WebKit 1051.265625px。没有调整纸张高度、容差或字体来使其通过。
- 静态排查确认`index001`残留全局CSS和legacy renderer参数；实际顺序defaults→window legacy→template dataset→overrides。改用全新同源宿主加载原公开`/dist/printform.js`，设置真实manifest title/locale并等待空批次完成；不删engine stylesheet或伪造ready。干净默认claim实际产生2页、未报原1051px错误，但新增金额检查准确检出TOTAL CLAIM的行框越界；两类问题分开修复，不能把全部错误归因于宿主。
- E04 的独立需求是原样货币字符串的真实几何检查，不是整份 claim 可打印认证。金额用例在明确不代表分页结果的 DOM 外壳中调用真实 binder 和 monetary inspector，验证完整来源字符串、实际宽高、故意裁剪拒绝及恢复；没有 mock Range、没有伪造成功报告。完整长文本用例仍独立调用真实 `formatAll` 和 `inspectRenderedDocument`。
- 长文本的永久回归检查消费者不变量而非错误句子/历史失败实现：同模板default真实分页作为正向控制；长输入实际源高度超过1050px且双语/全部6行原文保留。若formatter失败，要求真实batch report为0成功/1失败、completed=false、0逻辑页、RangeError及完整源行回滚；若未来能正确分页，必须全量valid、全部页面尺寸正确且源文本精确守恒。没有解析错误文案中的px数字来固定实现，也不允许吞错后标成功或部分输出。
- BankPayment/BankReceipt 启动数据与默认公开 fixture 不同：前者启动 allocatedAmount 为 214912.02，公开 seed 为 9544.18；后者 allocatedAmount 分别为 162880.90 与 4480.23，total 分别为 163130.90 与 4480.23。`database.starting` 按已选/排序后的兼容记录启动，合成场景按 kind 取默认公开 fixture，两者不是同一来源。现在对生成数据使用显式 `demoDataForKind(kind)` 的完整 seed 对照（含所有 summary/source 字段与单行内容），不放松为仅检查 kind；ERP restore 则仍逐字段严格等于实际启动 original，与合成 seed 分开验证。

实际Chrome普通claim修复后：公开standalone状态ready、2页、inspection valid、无error/issue，金额原文6,023,176.50与22pt字号保留，line-height35.2px；完整两页截图已查看。实际clean long输入仍blocked：源高3626.53125px，真实RangeError记录1051.90625px>1050px，0页，不能假装已打印。最终三引擎结果及全构建另以实际执行记录为准。

中间第二次三引擎为12failed／12passed：四类UI public-seed与ERP恢复均通过，另12项因控制用例错误引入v3/model的未发布`/src/printform/helpers.js`依赖而未运行consumer。换用同一claim模板作为正向控制，不以可打印bare-core样本假定另一种v2模板已自带printform根。该静态SDK依赖缺口另由C任务补齐实际公开入口验收；不把模块加载失败标成打印失败或通过。

中间bare-core invoice控制又有21passed／3failed：该v2模板本来由DocumentRuntime补齐printform根，不能作为裸PrintForm调用的同形控制。最终使用同一个claim模板作为default/long对照，三引擎**24/24 passed**。不是换成较容易的业务样本绕开失败：真实default修复且ready，真实long仍blocked，安全原子回滚不被固定错误文案或永久pin旧失败实现代替。



## 风险与非目标

没有现场 ERP、真实银行分配、跨币种结算、会计过账、税务正确性、FX、打印机硬件或纸张实测认证。复制合成行的来源关系仅用于排版字段覆盖，不证明扩展后的交易链一致。没有为自定义业务类型猜 schema 或自动重算金额。真实业务 fixture / schema 不完整时，缺失与不一致仍是验收输出，而不是绕过条件。
