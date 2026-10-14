# PrintForm.js 使用指南

本指南总结了 PrintForm.js 的正确用法与关键注意事项。

---

## 1) 必要的 HTML 结构

脚本只会处理 `.printform` 容器内的内容。

```html
<div class="printform"
     data-papersize-width="750"
     data-papersize-height="1050">

  <div class="pheader">...</div>
  <div class="pdocinfo">...</div>
  <div class="prowheader">...</div>

  <div class="prowitem">行 1</div>
  <div class="prowitem">行 2</div>

  <div class="pfooter">...</div>
  <div class="pfooter_pagenum">
    第 <span data-page-number></span> 页，共 <span data-page-total></span> 页
  </div>
</div>
<script src="./dist/printform.js"></script>
```

关键类名（默认行为）：
- `.pheader`: 每页重复
- `.pdocinfo`, `.pdocinfo002..005`: 每页重复
- `.prowheader`: 每页重复
- `.prowitem`: 最小分页单位（内部不会被拆分）
- `.pfooter`, `.pfooter002..005`: 仅最后一页（可配置为每页重复）
- `.pfooter_logo`, `.pfooter_pagenum`: 页脚附加块（可配置重复）

注意：格式化后类名会被替换为 `_processed` 后缀
（例如 `.pheader` -> `.pheader_processed`）。若使用类名做样式，
请同时覆盖原始与 `_processed` 版本。

---

## 2) 配置优先级与纸张尺寸

配置来源优先级（低 -> 高）：
1. 默认值
2. Legacy 全局变量（如 `window.papersize_width`）
3. `.printform` 的 `data-*` 属性
4. `PrintForm.format*()` 的 JS 传参

尺寸规则：
- 如果设置了 `data-papersize-width/height`，直接使用像素尺寸。
- 否则使用 `data-paper-size` + `data-dpi` + `data-orientation`
  自动换算像素尺寸。

常用选项（完整列表见 `docs/CONFIGURATION.md`）：
- `data-papersize-width`, `data-papersize-height`
- `data-paper-size` (A4, A5, LETTER, LEGAL)
- `data-dpi` (默认 96)
- `data-repeat-header`, `data-repeat-rowheader`, `data-repeat-footer...`
- `data-n-up`, `data-show-logical-page-number`, `data-show-physical-page-number`
- `data-debug` (详细日志)

---

## 3) 自动格式化与 JS API

脚本会在页面加载完成后自动执行（移动端会有短暂延迟）。
如果内容是动态渲染的，需手动触发：

```javascript
// 格式化所有 .printform（异步）
await PrintForm.formatAll({ force: true });

// 格式化单个节点
const formEl = document.querySelector(".printform");
PrintForm.format(formEl);
```

注意：
- `formatAll` 处理当前源单据（含后来追加），并发调用等待同一批 Promise，无需靠 `force` 解除全局标记。
- 成功返回 `{formattedCount,failedCount:0}`；任一失败抛 `AggregateError.errors` 与 `error.report` 成功/失败数。
- 成功将源节点替换为 `.printform_formatter_processed`；失败保留源单据。参见 [ERP 支持契约与限制](ERP_PRINT_SUPPORT.zh-CN.md)。
- 公共 API 也提供 `PrintForm.DEFAULT_CONFIG` 与
  `PrintForm.DEFAULT_PADDT_CONFIG` 便于查看默认值。

---

## 4) 页码与 N-up

逻辑页码：
- 使用 `data-page-number` / `data-page-total` 占位符。
- `data-show-logical-page-number` 控制显示。

物理页码（N-up 时）：
- 使用 `data-physical-page-number` / `data-physical-page-total`。
- `data-show-physical-page-number` 控制显示。

N-up：
- `data-n-up="2"` 在未缩放逻辑内容通过几何检查后，以统一比例拼入真实物理 sheet grid。
- `nUp > 1` 使用输出专属命名 `@page` 规则；宿主 padding/border 从可用纸面扣除。`nUp=1` 保留宿主的纸张样式。
- 参见[测量分页、单元格策略与明确限制](ERP_COMPLEX_PAGINATION.zh-CN.md)；浏览器 PDF 验证不等于打印机认证。

---

## 5) PTAC 与 PADDT

PTAC（`.ptac`）：
- 适合条款/长文本。
- 按真实纸面预算测量 DOM Range，独立拆分并行单元格，保留 inline 标记与 Unicode grapheme。
- PTAC 的 200 词上限只能缩短续片，不能放宽宽高检查；不可拆内容明确失败，不裁切。
- `data-repeat-ptac-rowheader="n"` 可关闭 PTAC 页的 `.prowheader`。
- `data-insert-ptac-dummy-row-items="n"` 可关闭 PTAC 页的空白行。

PADDT（`.paddt`）：
- 与 PTAC 类似，但在所有主页面和页脚之后单独分页输出。
- PADDT 页面只保留 `.pfooter_logo` 与 `.pfooter_pagenum`。
- 主要控制项：`data-repeat-paddt-rowheader`、`data-insert-paddt-dummy-row-items`
  以及 PADDT 独立的 docinfo 开关（`data-repeat-paddt-docinfo*`）。
- `paddtMaxWordsPerSegment` 保留为额外可读性上限；物理适配仍以实测几何为准。
- `data-repeat-paddt` 当前为保留项。

---

## 6) 强制分页与行头控制

- 在行上加 `tb_page_break_before` 强制在其前分页。
- 在行上加 `without_prowheader` 或 `tb_without_rowheader`
  可让该页不重复 `.prowheader`。

---

## 7) 空白行与页脚占位

- `data-height-of-dummy-row-item` 设置空白行高度。
- `data-insert-dummy-row-item-while-format-table` 插入空白行填充。
- `data-insert-footer-spacer-while-format-table` 在页脚前加 spacer。
- 可用以下方式自定义空白行结构：
  - `data-custom-dummy-row-item-content`
  - `<template class="custom-dummy-row-item-content">...</template>`
- 可用以下方式自定义页面填充 spacer（必须单一根元素，高度自动填充）：
  - `data-custom-dummy-spacer-content`
  - `<template class="custom-dummy-spacer-content">...</template>`

---

## 8) 多个 .printform 同页

同一页面有多个 `.printform` 时，会自动插入
`div.div_page_break_before` 作为分隔。可用
`data-div-page-break-before-class-append` 添加额外 class。

---

## 9) 移动端与字体加载建议

- 保持 `text-size-adjust: 100%`，避免移动端字体自动缩放。
- 若字体/图片会改变布局，请等待资源加载后再格式化。
- 动态更新后记得 `PrintForm.formatAll({ force: true })`。

---

## 10) 排错清单

- 单个 `.prowitem` 不应超过页面高度。
- 不要只写原始类名样式，`_processed` 也要覆盖。
- 移动端分页异常时检查 viewport 与 text-size-adjust。
- 使用 `data-paper-size` 时请确认 `data-dpi` 是否正确。
