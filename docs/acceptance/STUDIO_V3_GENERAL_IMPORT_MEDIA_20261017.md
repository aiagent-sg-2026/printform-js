# 通用Studio：本地导入、行业表单与纸张实际验收

日期：2026-10-17。用户任务2/3的限定功能交付，不是全ERP格式或AI生产资格认证。纸张任务已独立通过PR90合并main48e90d453a8599a689b4bb960daef0af748e7b27；CI39004472029构建与部署成功。用户私有未跟踪审计文件未读取、复制、暂存或入库。

## 实际结果

| 检查 | 观察到的结果 |
| --- | --- |
| Node24完整隔离构建 | 249文件通过、1文件跳过；2873测试通过、9 opt-in跳过；站点构建成功 |
| 最终三引擎组合 | 75通过、0失败、0跳过、0重试；保留Chromium sandbox |
| 本地导入 | 18场景，含CSV、嵌套JSON、UTF8拒绝、严格自定义records、无表格工单、375px实际选择与Apply |
| 业务表单 | 21场景，七类New/Open/Save/重开/离线HTML；7份实际Chromium PDF |
| 特殊纸张 | 36场景，10有限预设及小数CUSTOM；11份实际Chromium PDF |
| Typed agent边界 | 22工具、13操作、3指南；114契约示例与38条digest-bound review通过，a99c932基线不移动 |
| 原生Chrome155视觉复查 | 1440桌面及375手机；手机选择框339px/行355px，全局溢出0；预览后仍r0，Apply前完整原文件分享提示可见 |

全量构建之后的纯导入表格class/CSS修复另经24项真实导入消费者与重建站点，再执行最终75项；不把旧构建冒充新CSS截图。机器报告列出原始报告SHA256及18份真实PDF字节摘要，不含完整模型wire或私钥。

## 源头修复

- 导入不再套用旧发票/items及数字quantity规则；复用原source schema与启用绑定。严格records中的字符串`-001.250`不被改成数字，不加虚假items、不放宽schema。
- 无表格工单默认Form fields，打开时选择启用区域；不再选择隐藏items而误报Missing value。普通对象型客户profile不再被误当非空字符串来源档案；原字符串标签、审批、状态和provenance保护保留。
- Preview全量验证；Apply复验同源映射及真实Save/Open预算，之后才提交并进入Undo/Redo。旧本地数据库仍保留其既有契约，不建第二套仓库；不兼容表单明确禁用旧dataset Save/Copy/export，仍能Save form/Open/Export HTML。
- 手机移除误继承的field-table列宽，未用!important掩盖。预览列路径与转换类型分行显示。完整原文件、文件名及未选列会进入Save/HTML，提示紧邻Apply；它们不自动进入AI默认上下文。
- InspectionReport与AssetHandover沿既有supplied-business-v1规范化、来源绑定、New和便携生命周期，不从量测推合格、不从交接单推签收/产权/折旧。
- 屏幕分页24px间隔移到物理纸面包装外；原生A4逻辑高度1099→1123px，原字体、边距、source token及独立名义尺寸/PDF容差不变。

## 不覆盖失败

首次组合66项为30通过/36失败：30个实际内页高度问题，6个测试在Node调用不存在的DOMParser；改真实浏览器Open后Save，不注入解析器。后续72项一次71通过/1 Firefox超时；trace停在覆盖状态iframe辅助定位世界，未得到字面值不符结论。最终沿既有业务测试读取当前真实主世界DOM，并通过实际Print preview/Back to data操作检查可见纸面；不重放桥接HTML。另一次75项72通过/3失败来自测试助手与局部变量同名，修复助手名后完整75/75通过。原始报告、trace、截图和制品均保留；没有调大90s任务/12s断言预算、字体缩放、关闭sandbox或增加case重试。

## 边界与未获资格

- CSV/JSON仅映射既有schema字段及当前已有集合，一次Apply一个scope；不创建新source字段，不猜ERP别名。输入2MiB、500记录，便携项目10MiB/18层/50000节点。不是任意Excel、分号CSV、任意HTML逆向或无限层级导入。
- CUSTOM20..1000mm是有限页面，不是无限卷纸；能力表只反映人提供的声明。只读lpstat没有配置目的地/默认打印机，零打印任务；真实走纸、裁切、切刀、驱动、条码和跨OS字体仍Blocked。
- 180槽G8预检只重验六份既有签名，不执行或伪造180次模型。旧冻结12拒绝任务最高144/180，低于162；data0/18、bindings/refs/files各12/18低于16。不同profile不混算，旧Fail不覆盖，新发布不继承8c单题通过。
- 固定upstream、DPA、G6/G9与完整独立同profile证据未关闭。AI仍Production Pilot；不要将真实客户/员工/付款资料上传Demo服务。新本地数据入口不等于新增AI数据修改权限。

## 依据

- [RFC4180 §2](https://www.rfc-editor.org/rfc/rfc4180.txt)：CSV空格、双引号、逗号与换行；本入口额外明确LF/CR与歧义头拒绝。
- [RFC8259](https://www.rfc-editor.org/rfc/inline-errata/rfc8259.html)：重复名称与数字精度互操作；采用保留词法、显式转换。
- [CSS Paged Media page-size](https://drafts.csswg.org/css-page-3/#page-size)：页面尺寸与方向，不代表驱动完成实体打印。
- [Window.print](https://developer.mozilla.org/en-US/docs/Web/API/Window/print)：浏览器打印入口没有设备能力、DPI或切刀设置参数。
- [导入说明](../STUDIO_V3_LOCAL_IMPORT.zh-CN.md) · [检查/交接单](../GENERAL_INSPECTION_HANDOVER.zh-CN.md) · [纸张说明](../STUDIO_V3_SPECIAL_MEDIA.zh-CN.md) · [机器摘要](STUDIO_V3_GENERAL_IMPORT_MEDIA_20261017.json) · [G8预检](../STUDIO_V3_G8_PREFLIGHT.zh-CN.md)。
