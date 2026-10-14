# 演示页目录

> 这些 HTML 文件都在**仓库根目录**（本文件只是导航索引，未移动任何文件——部分页面可能被外部 ERP 项目直接引用其现有路径）。本地起服务后在浏览器打开即可：`node scripts/serve-site.mjs .` 然后访问 `http://127.0.0.1:4174/<文件名>`。
>
> 每行只写这个页面**用来验证什么特性**；配置项含义见 [docs/CONFIGURATION.md](../docs/CONFIGURATION.md)。

## 基础分页与重复区块（渐进式，config 逐步简化）

| 文件 | 测什么 |
|---|---|
| [index001.html](../index001.html) | 基础结构：header/docinfo/rowheader 全部重复 + 自定义虚拟行（dummy row）模板 |
| [index002.html](../index002.html) | 同 001，但 `custom_dummy_row_item_content` 留空 → 验证默认虚拟行渲染 |
| [index003.html](../index003.html) | 页脚 Logo 不重复（`repeat_footer_logo=n`）+ 关闭"格式化时插入页脚 spacer" |
| [index004.html](../index004.html) | 在 003 基础上，docinfo 也不重复（`repeat_docinfo=n`） |
| [index005.html](../index005.html) | 在 004 基础上，header 也不重复（`repeat_header=n`） |
| [index006.html](../index006.html) | 在 005 基础上，rowheader 也不重复 → 全部重复区块关闭的最小配置 |

## 多 docinfo / 多 footer 变体（`pdocinfo002`–`005`、`pfooter002`–`005`）

| 文件 | 测什么 |
|---|---|
| [index007.html](../index007.html) | 同一页面内 **3 个 `.printform` 容器**（多单据批量打印，自动插入分页符） |
| [index008.html](../index008.html) | 单表单，`docinfo002`–`005` 全部关闭重复（只有主 docinfo 重复） |
| [index009.html](../index009.html) | 单表单，`docinfo002`–`005` 全部开启重复 |
| [index010.html](../index010.html) | 3 个表单 + `footer005` 单独重复（`footer002`–`004` 关闭） |
| [index011.html](../index011.html) | 单表单版本的 010（同一 footer005-only 配置） |
| [index012.html](../index012.html) | 与 011 配置几乎一致（近似重复样本，保留作为回归基线） |

## PTAC / PADDT 长文本段落

| 文件 | 测什么 |
|---|---|
| [index013.html](../index013.html) | 仅 PTAC（按真实纸面预算拆分条款；词数仅为额外可读性上限，见[复杂分页契约](../docs/ERP_COMPLEX_PAGINATION.zh-CN.md)） |
| [index014.html](../index014.html) | PTAC + PADDT 组合：PADDT 段落在所有常规页脚之后另起物理页 |
| [index017.html](../index017.html) | 同 014，开启 `data-debug="y"`（控制台日志 + 页内调试面板）便于观察分页决策 |
| [index019.html](../index019.html) | 仅 PADDT（审计/长文声明段落） |
| [index020.html](../index020.html) | 仅 PTAC，且页脚**正常重复**（对照 013/014 的 footer 关闭配置） |
| [delivery_order_test.html](../delivery_order_test.html) | PTAC+PADDT 压力测试：140 词/段限制、两者虚拟行都关闭，验证极限切分场景 |

## N-Up 与物理页

| 文件 | 测什么 |
|---|---|
| [index015.html](../index015.html) | 2-up：两个 A5 横向逻辑页拼在一张 A4 物理页上，含物理页页码 |
| [index016.html](../index016.html) | 与 015 相同配置的第二份样本（回归对照） |

## 页码与真实文档模板

| 文件 | 测什么 |
|---|---|
| [index021.html](../index021.html) | Delivery Note 模板：页脚页码块 + 逻辑页码同时开启 |
| [demo001.html](../demo001.html) | 完整销售发票（Computer Shop）：45 行商品 + PTAC 条款 + 审计段落，Studio v1 默认样本 |
| [demo002.html](../demo002.html) | 完整采购单（Construction）：34 行材料，Studio v1 第二样本 |

## 专项与边界测试

| 文件 | 测什么 |
|---|---|
| [index018.html](../index018.html) | 配置项参考页：**查看源码**，每个 `data-*` 属性旁的 HTML 注释附一句英文说明（渲染效果本身是一份普通发票，说明不在页面上可见） |
| [index_subtotal_test.html](../index_subtotal_test.html) | 小计+页脚组合行（`prowitem_subtotal` + `prowitem_footer`）整体测宽、放不下时整组推到下一页 |
| [mobile-debug-test.html](../mobile-debug-test.html) | 移动端（iOS/Android WebKit）小数像素高度测量的调试页 |
| [multiple_page_preview.html](../multiple_page_preview.html) | 连续渲染 10 份 index001，用于观察多表单批量场景下的性能与分页符 |

## 其他入口

- [index.html](../index.html)（根目录首页）——不是分页特性演示，是链接到以上全部页面 + Studio v1/v2 的站点导航。
- [studio/index.html](../studio/index.html)、[studio-v2/index.html](../studio-v2/index.html) 是独立的可视化工具，不在本目录范围内，见 [DESIGN.md](../DESIGN.md) 第 3、4 节。
