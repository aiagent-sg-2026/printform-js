// Stable business groups are independent of the generated design manifest.
export const categories = [
  { id: "sales", en: "Sales", zh: "销售", numbers: [1, 4, 7, 12, 18, 19, 20, 21, 22, 53, 54, 55] },
  { id: "purchasing", en: "Purchasing", zh: "采购", numbers: [2, 13, 14, 15, 16, 17] },
  { id: "inventory-logistics", en: "Inventory & logistics", zh: "库存与物流", numbers: [3, 5, 23, 24, 25, 26, 27, 28, 29, 41] },
  { id: "finance", en: "Finance", zh: "财务", numbers: [6, 9, 30, 31, 32, 33, 46, 50, 51, 52, 56] },
  { id: "retail-ecommerce", en: "Retail & e-commerce", zh: "零售与电商", numbers: [34, 35, 36, 37, 38, 39, 40, 42] },
  { id: "crm", en: "Customer management", zh: "客户管理", numbers: [43, 44, 45, 47, 48] },
  { id: "hr-administration", en: "HR & administration", zh: "人事与行政", numbers: [8, 10, 11, 49] }
];
export function categoryOf(design) {
  const number = Number(design.no?.replace(/^PF-?/, ""));
  return categories.find((category) => category.numbers.includes(number))?.id;
}
