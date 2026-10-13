const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const differs = (left, right) => Math.abs(money(left) - money(right)) > 0.009;

function issue(code, message, path) {
  return { code, message, path, severity: "error" };
}

export function calculateFinancialTotals(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const subtotal = money(items.reduce((sum, item) => sum + (Number(item?.lineTotal) || 0), 0));
  const tax = money(Number(data?.totals?.tax) || 0);
  const shipping = money(Number(data?.totals?.shipping) || 0);
  const discount = money(Number(data?.totals?.discount) || 0);
  return { subtotal, grandTotal: money(subtotal + tax + shipping - discount) };
}

export function validateBusinessRules(data, manifest = {}) {
  const errors = [];
  if (manifest.businessRules === false || manifest.studioV3) return {valid:true, errors};
  const items = Array.isArray(data?.items) ? data.items : [];
  items.forEach((item, index) => {
    if ([item?.quantity, item?.unitPrice, item?.lineTotal].every((value) => typeof value === "number")) {
      const expected = money(item.quantity * item.unitPrice);
      if (differs(item.lineTotal, expected)) errors.push(issue("LINE_TOTAL_MISMATCH", `Line total must equal quantity × unit price (${expected})`, `/sampleData/items/${index}/lineTotal`));
    }
  });
  if (data?.totals && typeof data.totals === "object") {
    const calculated = calculateFinancialTotals(data);
    if (typeof data.totals.subtotal === "number" && differs(data.totals.subtotal, calculated.subtotal)) {
      errors.push(issue("SUBTOTAL_MISMATCH", `Subtotal must equal the sum of line totals (${calculated.subtotal})`, "/sampleData/totals/subtotal"));
    }
    if (typeof data.totals.grandTotal === "number" && differs(data.totals.grandTotal, calculated.grandTotal)) {
      errors.push(issue("GRAND_TOTAL_MISMATCH", `Grand total must equal subtotal + tax + shipping − discount (${calculated.grandTotal})`, "/sampleData/totals/grandTotal"));
    }
  }
  return { valid: errors.length === 0, errors };
}
