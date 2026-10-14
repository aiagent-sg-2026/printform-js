# ERP 多行表格与跨行单元格延续

## 适用范围

本变更处理 Printform 已绑定的真实 DOM；不修改 ERP 数据源、来源证明、金额或会计计算。支持单个业务 `.prowitem` / PTAC / PADDT 表格内多个 `tr`、`rowspan`（包括合法 `rowspan="0"`）、`colspan` 与跨页文本流。一个重复业务对象仍计作一个语义行，不按内部 `tr` 或物理片段重算业务行数。

这是分页能力说明，不是所有 ERP、真实银行或打印硬件认证。真实 PDF 自动化仅在 Chromium 提供的 PDF 接口执行；Firefox、WebKit 验证真实 DOM 与 print media 边界。

## 真实 before 入口与根因

先将 `e2e/erp-business-scenarios.spec.js` 的长 claim 回归收紧为必须完整 ready，然后修改实现。输入仍是 `createProgressClaimProject()` 配合 `createProjectScenario(project, 'long-text')`，没有改变文字、行数、金额、字体或纸高。

父代理在隔离的 `8e38ff9` 基线 runtime 实际捕获 `1051.90625px > 1050px`。连接 DOM 的溢出页依次是：

| 内容 | 实测高度 px |
| --- | ---: |
| Header | 108.5 |
| Valuation title | 47.78125 |
| Long row 1 | 416.3125 |
| Long row 2 | 416.3125 |
| Dummy row | 22 |
| Final page-number footer | 41 |

真实内容与 footer 合计 `1029.90625px`，只余 `20.09375px`；插入 `22px` 的 dummy 才触发溢出。旧流程在最终页码与真实 footer 排版之前使用 source reservation 插入装饰填充，不能证明最后输出还剩下这段预算。源码中的 measured dummy 检查不能代替最终 footer 布局后的预算检查。

修复把 remainder dummy/spacer 延迟到真实 footer 已追加、页码总数已更新之后。在实际 page、实际插入位置（footer 前）逐次测量 dummy 增量。测量值不再向整像素上取整并回灌预算。纸高、最终严格越界异常、文字和金额保持不变；不通过删业务内容、缩字或增加容差放行。

多行 before：将新的 complex fixture/spec 放到同一基线但保留旧 runtime，执行 `--grep 'multirow claim'`。旧 `fragment-row.js` 对超高表格明确要求 single table row without rowspan；新增用例要求成功跨页，不能以 blocked 代替实现。

严格金额守恒还定位到独立 P1 调用方缺陷：legacy claim 的 `/valuationTotal/*` 原表曾放在业务 rows 与 `pfooter` 之间、没有协议 section class，`collectSections()` 因而不会渲染它。经父代理授权，仅把该原表原样移动进已有最终 `pfooter` 开头；不改数字、字体或会计事实，不新建重复 footer。default 和 long-text 回归都比较全部源 monetary pointer/string 序列，不能通过缩小检查范围隐藏合计遗漏。默认 ready 以完整金额、业务行和纸张边界证明，不把历史缺合计输出的页数当正确性标准。

父代理随后用基线公开 runtime、真实 `project.themeCss`、`#pf-mount` 宿主并等待字体/图片就绪实际确认：default `formatAll` 为 `formattedCount:1, failedCount:0`、2 页，但源 `/valuationTotal/{contractAmount,previous,thisClaim,cumulative}` 分别为 `10,000,000.00`、`4,450,000.00`、`1,166,500.00`、`5,616,500.00`，打印输出这四个节点为 `[]`。因此这是实际静默漏金额，不仅是静态推断。缺失 `#pf-mount` 的早期自建 harness 不符合样本 CSS 宿主契约，其 atomic 失败不计为引擎缺陷。独立 `default legacy claim` 与 `clean legacy long claim` 用例分别回归静默遗漏与真实溢出，均比较全部 monetary pointer/string；不得只检查上述四项而忽略其他金额。

## 表格 / cell 契约

- 浏览器中的源表格建立原始 row/column 占用网格，测量列宽后固定延续表格列预算。
- 每个输出片段是一段源 row 窗口，保留 `table`、row group、`tr`、`td/th`、`colspan`、`scope` 和 cell 属性；不把 table 转成段落或文字截图。
- 跨行 cell 在每个窗口的第一个相交 row 锚定，`rowspan` 等于该窗口与原 cell 所覆盖 row 的交集。跨页重建的是 cell 容器，不是重复其文本；同页仍可保留实际大于 1 的 rowspan。
- 每个 split cell 独立持有 DOM Range 游标。CJK、RTL、跨 inline 的组合字符、emoji ZWJ、链接与注释使用既有 grapheme / `Range.cloneContents()` 路径；不新增第二套分页引擎。
- 默认 split 文字逐字守恒；短身份完成后不重复。`data-pf-format="currency"`、`data-pf-monetary="currency"` 和 keep-together cell 默认完整放一次。嵌套 monetary token 也是不可拆资产，字符串不被解析或格式化。
- 显式 `data-pf-cell-policy="first"`：cell 第一个参与片段放一次；`last`：cell 最后参与的片段放一次；`repeat`：每个相交片段重复。单 `tr` 时保持既有 first/last/repeat 语义。
- `data-pf-source-row`、`data-pf-fragment-index`、`data-pf-fragment-count` 仍为引擎保留属性。工作克隆先移除作者伪造值，再给完整业务对象的各片段发放连续身份；不得用这些属性掩盖重复业务行。
- 嵌套 `table`、SVG/image、无法容纳的 grapheme 或固定 chrome 保持原子；超出真实预算时失败。总计/subtotal 的原子业务约束不变。
- 所有工作在原有 formatter 回滚边界内进行。失败删除临时片段/部分输出，保留原 DOM 对象及其监听器；不留下已格式化的残缺凭证。

现有 `studio-v2/core/row-integrity.js` 已按完整、连续且一致的 source fragment 集合折叠业务身份；多行表格仍使用同一根业务对象，故无需新增消费者计数规则。永久 e2e 同时消费 `analyzeRowIntegrity` 与真实 `inspectRenderedDocument` 的业务行/物理片段指标。

## 永久验证入口

串行集成使用以下命令；测试文件的存在不等于通过，实际结果分开记录：

```sh
npm run test -- --run tests/text-segmentation.test.js tests/measured-pagination.test.js tests/pagination-dummy.test.js tests/studio-v2/row-continuation.test.js tests/studio-v2/progress-claim.test.js --maxWorkers=1 --no-file-parallelism
npm run build:site
npx playwright test e2e/erp-business-scenarios.spec.js e2e/complex-pagination.spec.js --workers=1 --project=chromium --project=firefox --project=webkit
```

验收包括：默认 claim 保持 ready；旧 long-text claim 必须完整 ready 且所有源 monetary display strings 原样守恒；多行、rowspan=3、rowspan=0、长跨行 cell、同页多 row 的跨页矩阵逐 cell 守恒；一次金额、显式策略、业务计数、print media 几何，以及原子失败的 DOM/监听器回滚。packed-row Chromium 用例附真实 PDF，核对物理页数、纸张大小、text item 坐标及每个金额/短身份出现一次。

## 实际集成证据（2026-10-15）

- 初次完整Node24构建227文件/2367项通过，runtime/site/agent gate完成；后加耗尽cell有限word预算回归4/4通过，jsdom伪元素getComputedStyle warning保留。
- 首轮三引擎暴露两类真实问题：已耗尽cell又向终点外推进；已结束的last-policy金额随另一跨行cell未完成而被清空。修复端点及cell结束窗口判断，不删除失败case或放宽逐金额断言。
- 使用真实公开runtime、原主题与#pf-mount（无测试init script）运行：default 2页、long-text 5页，均formattedCount=1/failedCount=0；valuationTotal四个源pointer/原金额字符串与输出逐项相等。两份实际完整PNG已查看。
- 首次浏览器矩阵因已定位失败中止；后续一次运行仍读取旧site-dist，未作为修复成功。更新实际站点产物后重新执行；最终三引擎及PDF结果另列实际报告。
- 修复后的完整Node24构建 **227文件/2368项通过**，runtime/site/agent gate完成；实际Chromium复杂分页 **14/14通过**，包含packed-row真实PDF页树、尺寸、坐标及金额/身份各一次检查。三引擎综合矩阵独立执行，不从Chromium外推。
- 两轮综合矩阵各186通过/2个既有Chromium-only PDF跳过/1个WebKit导航45s超时；一次file:尚在about:blank，另一次尚在加载旧index001，均未给出目标纸型排版失败证据，根因未确认。归档两轮trace；纸型助手改用既有claim的干净同源公开runtime宿主，去除无关legacy invoice/CSS/自动排版，保持原目标fixture、离线file:、所有金额/几何/PDF断言和45s上限。后续通过不倒推此前超时的唯一原因。
- 干净宿主后综合矩阵仍出现WebKit file:导航未提交的45s超时，故不把宿主隔离称为根因修复。独立真实WebKit进程打开同一保留HTML（禁HTTP(S)，15s上限）实际load、ready、6页；产物可消费已证实，长期浏览器进程挂起原因仍未确认。最终按完整文件启动新进程覆盖原全部组合，不缩减case、增加重试或放宽等待/财务/几何断言。
- 最终完整文件三引擎：complex42、业务27、n-up19、renderer39、additional paper36、special paper24，合计 **187通过/2个既有Chromium-only PDF跳过/0失败/0重试**，原189组合全部保留。n-up另两个引擎不支持page.pdf故原有跳过不伪称通过；packed-row实际PDF与三引擎逐cell/金额/几何守恒均通过。

## 官方依据

- [WHATWG HTML table processing model](https://html.spec.whatwg.org/multipage/tables.html#processing-model)：table 是二维 cell 网格，rowspan/colspan 按网格占用处理，不能用平面字符串代替 cell 语义。
- [WHATWG DOM Range cloneContents](https://dom.spec.whatwg.org/#dom-range-clonecontents)：按原 DOM 范围克隆内容，保持部分选择的 inline 结构。

上述标准指导实现边界，不构成未执行引擎、PDF 或打印硬件的结果证明。
