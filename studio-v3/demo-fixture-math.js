// Only fixture construction calculates money; the Studio editor preserves supplied ERP values.
export const amount = minor => minor / 100;
export function roundRatio(numerator,denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) throw new Error('Use safe integer minor units and a positive divisor.');
  return Math.sign(numerator) * Math.floor((Math.abs(numerator) + denominator / 2) / denominator);
}
export function demoLine(id,product,quantity,options = {}) {
  const rateMinor = options.rateMinor ?? product.saleRateMinor;
  const quantityMilli = Math.round(quantity * 1000);
  if (quantityMilli / 1000 !== quantity) throw new Error('Demo quantities support up to three decimal places.');
  const grossMinor = roundRatio(quantityMilli * rateMinor,1000);
  const discountMinor = options.discountMinor ?? roundRatio(grossMinor * (options.discountBps || 0),10000);
  const amountMinor = grossMinor - discountMinor, taxBps = options.taxBps ?? 800;
  const taxMinor = roundRatio(amountMinor * taxBps,10000);
  return {id,no:options.no || 1,productId:product.id,sku:product.sku,description:options.description || product.description,
    unit:product.unit,quantity,quantityMilli,rate:amount(rateMinor),rateMinor,grossMinor,discount:amount(discountMinor),discountMinor,
    amount:amount(amountMinor),amountMinor,taxBps,taxMinor,totalMinor:amountMinor+taxMinor,...options.extra};
}
export function summaryFor(items,extra = {}) {
  const sum = key => items.reduce((total,item) => total+item[key],0);
  const subtotalMinor = sum('amountMinor'),taxMinor = sum('taxMinor'),totalMinor = subtotalMinor+taxMinor;
  return {subtotal:amount(subtotalMinor),tax:amount(taxMinor),total:amount(totalMinor),subtotalMinor,taxMinor,totalMinor,
    discountMinor:sum('discountMinor'),currency:'MYR',roundingMinor:0,rounding:'half-away-from-zero per line',...extra};
}
export function reference(record,relation) {
  return {id:record.id,documentKind:record.documentKind,number:record.data.document.number,relation};
}
export function relatedLines(parent,newId,quantities = null) {
  return parent.data.items.map((line,index) => {
    const quantity = quantities?.[index] ?? line.quantity;
    const quantityMilli = Math.round(quantity*1000);
    const discountMinor = line.quantityMilli ? roundRatio(line.discountMinor*quantityMilli,line.quantityMilli) : 0;
    return demoLine(`${newId}:line:${index+1}`,{id:line.productId,sku:line.sku,description:line.description,unit:line.unit},quantity,
      {no:index+1,rateMinor:line.rateMinor,taxBps:line.taxBps,discountMinor,
        extra:{parentDocumentId:parent.id,parentLineId:line.id,orderedQuantity:line.orderedQuantity ?? line.quantity,
          remainingQuantity:(line.orderedQuantity ?? line.quantity)-quantity}});
  });
}
export function addDays(date,days) {
  const time = new Date(`${date}T00:00:00Z`); time.setUTCDate(time.getUTCDate()+days); return time.toISOString().slice(0,10);
}
