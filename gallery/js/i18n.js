export const translations = {
  en: {
    eyebrow: "DOCUMENT DESIGN LIBRARY", heading: "Forms made for print.",
    subheading: "Explore live, paginated business documents built with PrintForm.js.",
    searchLabel: "Search designs", searchPlaceholder: "Search by name or tag", typeLabel: "Document type",
    paperLabel: "Paper", all: "All", empty: "No designs match these filters.", openDesign: "Open design",
    pageOne: "page", pageMany: "pages", resultOne: "design", resultMany: "designs", typeInvoice: "Invoice", typePurchaseOrder: "Purchase Order",
    typeDeliveryNote: "Delivery Note", typeQuotation: "Quotation", typePackingList: "Packing List",
    typeCreditNote: "Credit Note", typeExpenseReport: "Expense Report", typeStatement: "Statement",
    typeWorkOrder: "Work Order", typeTimesheet: "Timesheet", typeOrderForm: "Order Form"
  },
  zh: {
    eyebrow: "打印文档设计库", heading: "为打印而设计的表单。",
    subheading: "探索由 PrintForm.js 实时分页的商务文档。", searchLabel: "搜索设计",
    searchPlaceholder: "按名称或标签搜索", typeLabel: "文档类型", paperLabel: "纸张",
    all: "全部", empty: "没有符合筛选条件的设计。", openDesign: "打开设计",
    pageOne: "页", pageMany: "页", resultOne: "个设计", resultMany: "个设计", typeInvoice: "销售发票", typePurchaseOrder: "采购订单",
    typeDeliveryNote: "送货单", typeQuotation: "报价单", typePackingList: "装箱单",
    typeCreditNote: "退款单", typeExpenseReport: "费用报销单", typeStatement: "账户对账单",
    typeWorkOrder: "工作单", typeTimesheet: "工时表", typeOrderForm: "定制订单"
  }
};

let language = "en";
export function currentLanguage() { return language; }
export function setLanguage(next) {
  language = next === "zh" ? "zh" : "en";
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = translations[language][element.dataset.i18n];
    if (value) element.textContent = value;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const value = translations[language][element.dataset.i18nPlaceholder];
    if (value) element.placeholder = value;
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });
  document.querySelector("[data-close]")?.setAttribute("aria-label", text("close"));
  localStorage.setItem("printform_lang", language);
  document.dispatchEvent(new CustomEvent("gallery-language-change", { detail: language }));
}
export function text(key) { return translations[language][key]; }
export function typeName(type) {
  const key = `type${type.replace(/\s+/g, "")}`;
  return translations[language][key] || type;
}
export function pageCount(pages) {
  return `${pages} ${text(pages === 1 ? "pageOne" : "pageMany")}`;
}
