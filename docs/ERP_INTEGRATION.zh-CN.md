# ERP 集成指南：legacy v1 数据绑定导出包

> 本文只描述冻结的 Studio v1 Mustache 导出包，不是当前 v2/v3 的 JSON Pointer 协议。
> 新集成先读 [ERP 单据/格式支持契约](ERP_PRINT_SUPPORT.zh-CN.md)、[审计与改进清单](ERP_PRINT_AUDIT.zh-CN.md) 及 [v2 协议](PRINTFORM_V2_PROTOCOL.zh-CN.md)。
> 面向任何能输出 JSON 的 ERP/后端；v1 背景见 [STUDIO_DESIGN.zh-CN.md](STUDIO_DESIGN.zh-CN.md) Phase 3。

---

## 1. 这是什么

Phase 1、2 导出的 HTML 是"静态快照"——打开就能看,但里面的发票号、客户名、商品行都是写死的。

**数据绑定导出包**不一样:它是一份**可重复使用的模板**。模板里的 `{{company}}`、`{{#items}}...{{/items}}` 这类占位符不会被替换死,而是保留在文件里,连同一个零依赖的小型渲染引擎(`mustache-lite`)一起打包。任何宿主页面拿到这个文件后,只要:

```js
PrintFormTemplate.render(realData);
```

一行代码,就能把真实数据注入模板并触发分页——不需要引入 Studio,不需要任何构建工具。

## 2. 占位符语法(Mustache 风格)

| 语法 | 作用 |
|------|------|
| `{{field}}` | 输出字段值,自动做 HTML 转义(防 XSS) |
| `{{{field}}}` 或 `{{&field}}` | 输出原始 HTML,不转义(谨慎使用,只用于你信任的内容) |
| `{{#items}}...{{/items}}` | 如果 `items` 是数组,对每个元素重复渲染一次区块;如果是真值对象,渲染一次 |
| `{{^items}}...{{/items}}` | 反向区块:`items` 为空数组/假值时才渲染(常用于"无数据"提示) |
| `{{a.b.c}}` | 支持点号路径访问嵌套字段 |

循环内部可以直接访问外层字段(例如 `{{#items}}{{company}}-{{no}}{{/items}}` 里的 `company` 会取自顶层数据,不需要在每个 item 里重复写)。

## 3. 在模板里放置占位符——一条硬规则

**`{{#items}}...{{/items}}` 必须完整包住一整个 `<table class="prowitem">...</table>`,不能只包住 `<tr>` 或表格内部的一部分。**

原因:PrintForm 的行(row)约定是"每行是一个独立的 `<table>`,彼此作为兄弟节点排列"(不是同一个 `<table>` 里的多个 `<tr>`)。数据注入是在字符串层面完成的(见下一节),只要 `{{#items}}` 和 `{{/items}}` 之间是完整、独立的元素,浏览器的 HTML 解析器就不会做任何"意外挪动"。如果你把占位符插进一个 `<table>` 内部、`<tr>` 之间的位置,解析器可能会把这段内容挪到 `<table>` 外面(俗称 "foster parenting"),导致布局错乱。

参考示例:[studio/sample-templates/invoice-databound.html](../studio/sample-templates/invoice-databound.html) 是一份完整的、可以直接在 Studio 里打开的数据绑定发票模板,`{{#items}}` 的用法就是照这条规则写的。

## 4. 在 Studio 里创建/调试数据绑定模板

1. 打开 `studio/index.html`,从模板下拉框选择"🔗 数据绑定发票"看现成示例,或用**导入 HTML**加载你自己的模板。
2. 没有占位符的模板,可以用**结构编辑(Edit Blocks)**模式点开某一行 `.prowitem`,把写死的文字换成 `{{field}}`,用 Apply 应用。
3. 右侧检查器面板会自动展开"数据绑定"区块,显示根据占位符自动生成的示例 JSON——直接编辑这段 JSON,预览会在 500ms 内重新渲染并重新分页。
4. 调好之后,点"导出数据绑定包"(不是普通的"导出 HTML"——普通导出会把当前示例数据写死进去,数据绑定包会保留占位符)。

## 5. 导出包内部结构

导出的是**一个自包含 HTML 文件**,内部依次包含:

```html
<div id="printform-mount"></div>              <!-- 原 .printform 的位置,初始为空 -->
<template id="printform-raw-template">
  <div class="printform" data-...>            <!-- 原始模板,占位符原样保留 -->
    ...{{company}}...{{#items}}...{{/items}}...
  </div>
</template>
<script>/* mustache-lite.js 全文内联 */</script>
<script src="./dist/printform.js"></script>
<script>
  window.PrintFormTemplate = {
    render: function (data) {
      var raw = document.getElementById('printform-raw-template').innerHTML;
      var rendered = MustacheLite.render(raw, data);
      document.getElementById('printform-mount').innerHTML = rendered;
      return PrintForm.formatAll({ force: true });   // 每次 render() 都强制重新分页
    }
  };
  window.PrintFormTemplate.render(/* Studio 里最后编辑的示例数据,直接打开文件也能看到内容 */);
</script>
```

`render(data)` 可以反复调用——每次都会用新数据重新生成 `.printform` 容器并强制重新分页,不受 PrintForm.js "分页只跑一次"的保护逻辑影响。

## 6. 后端对接:以 ColdFusion 为例

假设你的 ERP 用 ColdFusion 从数据库查出发票数据,输出成 JSON:

```cfml
<!--- invoice-data.cfm --->
<cfscript>
  invoiceQuery = queryExecute("
    SELECT invoice_no, invoice_date, company_name, company_address
    FROM invoices WHERE id = :id
  ", { id: url.id });

  itemsQuery = queryExecute("
    SELECT row_no, product_name, qty, unit_price, subtotal
    FROM invoice_items WHERE invoice_id = :id ORDER BY row_no
  ", { id: url.id });

  data = {
    "company": invoiceQuery.company_name,
    "address": invoiceQuery.company_address,
    "invoiceNo": invoiceQuery.invoice_no,
    "date": dateFormat(invoiceQuery.invoice_date, "yyyy-mm-dd"),
    "items": []
  };

  for (row in itemsQuery) {
    arrayAppend(data.items, {
      "no": row.row_no,
      "name": row.product_name,
      "qty": row.qty,
      "price": numberFormat(row.unit_price, "0.00"),
      "subtotal": numberFormat(row.subtotal, "0.00")
    });
  }

  writeOutput(serializeJSON(data));
</cfscript>
```

前端页面(可以是任何页面,不需要是 Studio 导出的那个文件本身——把导出包当成一个组件嵌进你现有页面即可):

```html
<!-- 把 Studio 导出的 invoice-package.html 内容整个复制进你的页面,
     或者用 iframe/fetch 加载它,拿到 window.PrintFormTemplate 之后: -->
<script>
  fetch('/cfm/invoice-data.cfm?id=' + invoiceId)
    .then(function (r) { return r.json(); })
    .then(function (data) { return PrintFormTemplate.render(data); })
    .then(function () { console.log('分页完成,可以打印了'); });
</script>
```

这就是端到端的完整链路:数据库 → ColdFusion 查询/组装 JSON → 前端 fetch → `PrintFormTemplate.render(data)` → PrintForm.js 分页 → 打印。

## 7. 其它后端栈的等价写法

数据绑定包只关心"拿到一个 JSON 对象",跟后端用什么技术完全无关:

- **Node/Express**:`res.json(data)`,前端 `fetch(url).then(r => r.json()).then(PrintFormTemplate.render)`
- **PHP**:`echo json_encode($data);`,前端写法相同
- **直接内联,无需 fetch**:如果数据在页面渲染时就已经在服务端准备好,可以省掉一次网络请求,直接把 JSON 内联进页面:
  ```html
  <script>
    PrintFormTemplate.render(<cfoutput>#serializeJSON(data)#</cfoutput>);
  </script>
  ```
  (把 `<cfoutput>#serializeJSON(data)#</cfoutput>` 换成你后端模板引擎对应的"输出转义过的 JSON 字符串"语法即可)

## 8. 常见问题

**Q: 一个页面要打印多张不同的单据(比如批量发票),能一次性 render 多份吗?**
目前 `PrintFormTemplate.render(data)` 一次只处理页面里已有的一个 `.printform` 容器。批量场景建议:每张单据单独导出一份数据绑定包(或者手写一个循环,把 `printform-mount`/`printform-raw-template` 的 id 加后缀区分多份,分别克隆调用)——这个用法超出 Phase 3 范围,如有需要请反馈,我们再评估是否值得做成 Phase 4 的"批量渲染"功能。

**Q: `data.items` 传空数组会怎样?**
`{{#items}}` 区块直接不渲染(循环 0 次),行头(`.prowheader`)仍然会显示。如果想显示"无数据"提示,用 `{{^items}}暂无商品{{/items}}` 反向区块。

**Q: 字段值里包含用户输入的 HTML 特殊字符(`<`、`&`)怎么办?**
`{{field}}`(双花括号)会自动转义,安全。只有显式用 `{{{field}}}` 三花括号才会原样输出——除非你确定这个字段内容可信(比如你自己拼的格式化 HTML),否则不要用三花括号包裹用户输入。
