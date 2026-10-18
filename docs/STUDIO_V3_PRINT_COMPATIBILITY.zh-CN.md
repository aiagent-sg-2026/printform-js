# Studio v3：自定义纸型、非对称留白与 PDF 默认纸张调查

## 结论与范围

本轮选择的是浏览器优先、通用表单的真实可达路径：`newProject` → `compileProject` → `createStandaloneHtml` → 本地 `file://` 独立运行 → screen／print media → Chromium PDF。没有另建打印资格协议，也没有重复 Letter／Legal 的同尺寸正例矩阵。

**新证据：`scale:1` 并不保证导出 PDF 使用作者纸张或保留作者位置。** 同一独立 HTML 在 `preferCSSPageSize:false` 时采用 Letter 纸张；较小的自定义页面被留在较大纸面内，较大的页面会实际缩小，即使 DOM／print-media 几何与文字完全正确。它是已记录的调用选项边界，不是发现了 Printform 产品缺陷，因此没有修改产品代码、创建永久测试或改动现有打印门禁。

独立原始报告与 4 份 HTML、8 份真实 PDF 位于：

```text
/tmp/printform-next-20261019-8ae4f0bc-eab6-426d-b62c-d4d7c5ed007f/printing-investigation-final/
```

仓库内的[精简实测记录](acceptance/STUDIO_V3_PRINT_COMPATIBILITY_20261019.json)保留原报告 SHA-256、runtime SHA-256、每份 PDF hash／MediaBox 和只读硬件盘点。它是本轮观察摘要，不是可自行批准的收据。原始产物在临时目录，迁移归档时应连同 hash 保管，不只复制结论。

## 实际执行的数字路径

2026-10-19 本地调查；原始 UTC 时间为 `2026-10-18T17:42:51.439Z` 至 `17:42:57.115Z`，不把时区日期差写成两次运行。

- 本机已有 `site-dist/dist` 的两份 runtime，**没有重新 build**；源代码侧复用现有 model／exporter。此调查不宣称旧 runtime 等于本轮源码新构建，父代理最终快照可用显式 `runtimeDir` 复验。
- Chromium **151.0.7922.34**、Firefox **153.0**、WebKit **26.5**，原有安装版本，headless 默认启动；初次调查没有显式设置 `chromiumSandbox:true`，也没有读取实际启动命令行，**不能宣称其 sandbox 已验证**。没有安装或升级浏览器。
- 2 个自定义基准尺寸（180×240mm、240×360mm）× portrait／landscape × 3 引擎，共 **12 个数字消费者场景**。每个场景独立量测 screen 与 print media。
- 四侧作者 inset 分别为上12／右24／下36／左48 **CSS px**；横向只交换物理宽高，四侧 inset 不交换。这些值不是设备不可打印区或驱动留白。
- 每份独立 HTML 都实际 ready、恰好1个物理 wrapper；物理尺寸按 `96px/in`、逻辑内容尺寸按扣除 inset 量测，偏差 <0.1px。内容原样 `COMPAT-00007`、`SOURCE-0002.500`，元素边界在逻辑页内，screen／print 都保留，wrapper／逻辑页无缩放。
- HTTP(S) 路由全阻断，实际外部 HTTP 请求 **0**、pageerror **0**；本地导航没有设置 transport offline。原项目在 export 前后按 JSON 快照相等。
- Chromium 每场景生成两份 PDF，共 **8 份**。直接读取 PDF 的 `/MediaBox` 数组，并用独立 PDF.js 读取页树／viewport／文本坐标，交叉核对；各1页、两个来源 token 各一次。这个有限字典读取仅针对本次 Chromium 输出，不宣称是任意压缩 PDF 的通用解析器。
- Firefox／WebKit 只有真实 DOM／print-media 证据，**没有 PDF 产物，更没有系统打印驱动认证**。

### 实测 PDF 对照

全部使用 `scale:1, printBackground:true, displayHeaderFooter:false`；唯一切换的是 `preferCSSPageSize`。以下单位 pt；CSS尺寸换算误差均 <1pt。

| 作者物理纸型 | CSS优先 PDF MediaBox 宽×高 | 默认纸张 PDF 宽×高 | 默认纸张来源文字高度 |
| --- | --- | --- | --- |
| 180×240mm portrait | 510×679.91998 | 612×792 | 8.999999625pt |
| 240×180mm landscape | 679.91998×510 | 792×612 | 8.999999625pt |
| 240×360mm portrait | 679.91998×1020 | 612×792 | 6.985024700957292pt |
| 360×240mm landscape | 1020×679.91998 | 792×612 | 6.985024700957292pt |

CSS优先的四份来源文字均约9pt（原12px），左右文字坐标和 baseline 均在作者 inset 内。默认大纸路径将同样约9pt文字缩到约6.985pt，即约 **77.61%**。默认小纸路径没有放大字体，但位置改变：portrait 来源 reference 的 x 从约63pt移到114pt；landscape 从约63pt移到118.5pt。**不能只验字体、页数或“看起来一页”就推断纸型／坐标忠实。**

这里的默认方向行为是本次 Chromium 观察，不外推其它版本、其它 PDF 引擎或原生打印面板。`preferCSSPageSize:true` 也只约束这个数字 PDF 调用，不能设置用户的实际纸盘、介质、DPI或裁切。

## 官方一手依据与边界

本轮实际读取正文，非仅搜索摘要：

1. [Playwright `page.pdf`](https://playwright.dev/docs/api/class-page#page-pdf)：PDF 使用 print CSS；`format` 默认 Letter；`preferCSSPageSize` 默认 false，true 才给 CSS `@page` 纸型优先级，false 允许缩放适配所选纸张；`scale` 默认1。这是本次真实PDF选项对照的直接依据。
2. [CSSWG `size`](https://drafts.csswg.org/css-page-3/#page-size)：两个 length 分别表示页框宽、高；[page-sheet 映射](https://drafts.csswg.org/css-page-3/#renderingpages)允许不适配时用较大纸张、旋转、缩放或其它处理。页面声明不是物理硬件能力声明。当前读取的是 **Editor’s Draft**，状态是进行中的标准工作，不写成已保证的各引擎实现。
3. [Apple：自定义纸型](https://support.apple.com/guide/mac-help/print-unusual-sized-paper-creating-a-custom-mchlp15541/mac)：在原生 Print 面板选择 Paper Size／Manage Custom Sizes；明确指出选项可能不适用于当前 printer 或 app。因此不能从 CSS custom size 推断本机已有相同系统纸型。本轮没有打开或更改这些设置，也不把“不可打印留白填0”的帮助建议当作真实设备可无边距打印的证明。
4. [WHATWG Printing](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#printing)：UA可忽略调用；sandboxed modals 可阻止打印并不发 beforeprint／afterprint；用户可接受或拒绝，之后仍有 afterprint 步骤。**事件或 `print()` 返回不构成作业成功／实体出纸／取消与否的证明。** 本轮没有调用 window.print 或模拟 afterprint；只记录标准边界，不伪造取消实测。
5. [Playwright WebKit](https://playwright.dev/docs/browsers#webkit)：bundled WebKit 不等同 branded Safari。这里的 WebKit print-media 证据不等同 Safari／macOS Print 面板或 AirPrint 验收。

## 原 WebKit 离线失败保持原条件

原[冷上下文 transport-offline `file://` 失败](STUDIO_V3_PHYSICAL_OFFLINE_ACCEPTANCE.zh-CN.md#webkit已观察失败仍保留不能冒充-safari-结论)继续保留。本轮没有为确认旧失败而重跑，未改其 spec、offline 初始化、flags、sandbox或版本，也没有用 data URL、HTTP或先 online 后 offline 替代。

本轮 `file://`＋HTTP路由阻断只证明内嵌文件无需外部HTTP请求即可执行，**不是 `browser.newContext({offline:true})` 下 file 导航通过**。这两项验收前提必须分开。

## 新鲜只读硬件前提

本轮重新调用现有 `inventoryPhysicalDevices()`，固定命令、每条15秒／1MiB：

- `/usr/bin/lpstat -p -d`：exit **1**；库存解析确认 **0** configured printer，非“工具不可用”。
- `/usr/sbin/system_profiler SPUSBDataType -json`：exit **0**；USB候选 **0**，非“工具不可用”。
- UTC观察时间 **2026-10-18T17:39:56.799Z**；errors `[]`；前提为 `NO_CONFIGURED_PRINTER`、`NO_USB_SCANNER_CANDIDATE`。
- 只输出／记录数量、状态、固定命令与stdout／stderr digest；没有保留设备名、序列号、队列名或网络地址，没有网络扫描、配对读取、打印／扫描作业或设备变更。USB枚举本身也不能证明scanner身份。

所以 **physicalGate=missing，certified=false**。本机之外或未通过当前枚举暴露的设备不在结论范围。精确恢复条件是：存在可明确访问且支持所选介质的实际打印机／队列及真实硬件扫码器，之后取得同一实际导出、原纸张／相机原照、独立量具读数和原始硬件扫描捕获，按已有[实体证据契约](STUDIO_V3_PHYSICAL_OFFLINE_ACCEPTANCE.zh-CN.md)进入独立审查。不能用本轮8份PDF、数字几何、人工JSON或事件成功补齐这些前提。

## 执行与复用入口

```sh
node scripts/studio-v3-print-compatibility-probe.mjs /absolute/evidence-directory /absolute/built-runtime-directory
```

第三参数目录必须有 `printform-document.js` 与 `printform.js`；不提供时明确读取本仓库已有 `site-dist/dist`。父代理也可 import `runPrintCompatibilityStudy({outputDir,runtimeDir})` 用自己的隔离构建。函数无服务／端口依赖；串行关闭每个browser／context；失败保存已经取得的有界报告，不生成任何批准状态。

最终探针仅对Chromium显式设置`chromiumSandbox:true`及诊断需要的`--enable-automation`；browser CDP真实观察50个参数，`--no-sandbox`及赋值形式均不存在。只记录数量与开关状态，不保管完整命令行；Firefox／WebKit启动不变。这不是独立OS级sandbox渗透验证。第一次父集成因未显式enable-automation而在0场景失败，报告保留，未改打印oracle或禁用sandbox。

第一版探针曾因PDF将 `SOURCE-0002.500` 在连字符处换行，而使用空格拼接提取文本导致断言 `0!==1`。它是探针拼接错误，不是来源或产品丢字；随后按PDF提取顺序去除本素材不含的布局空白，保留原token／字体／产品代码。改正后小纸矩阵 **6格／4 PDF** 完成，再扩展大纸反例，最终 **12格／8 PDF** 完成；没有把初次失败抹去或算成无失败历史。

父集成随后针对隔离`build:site`产生的两份runtime实际执行：三引擎**12场景／8份Chromium PDF全部完成**，所有网络请求／pageerror为0；MediaBox、原始token、非对称inset、默认纸张缩小反例均继续验证。新报告SHA-256为`e807e1a953fbd8c5435822602e8c85dd11932f402cf819eddbf7a750b3b38f0c`，目录为上述证据根的`printing-built-runtime-verified`；完整runtime与启动观察见精简记录的`integratedRuntimeProbe`，不覆盖初期默认启动调查。

同一行业快照原始全量构建3412项／9 opt-in跳过，最终夹具51项、127契约／39评审及三引擎表单39/39另证；这些不是实体打印证据。没有物理打印面板／作业／扫码或原WebKit冷offline重测，硬件缺失及生产资格false不变。
