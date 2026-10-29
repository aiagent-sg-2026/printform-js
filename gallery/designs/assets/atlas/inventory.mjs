import {heading, row, esc, monetary, grams} from './dom.mjs';
import {weight} from './validate.mjs';
export function inventory(form, r) {
  const widths = [9, 30, 5, 9, 10, 10, 11, 16];
  for (const [index, c] of r.containers.entries()) {
    const id = `inventory-${index}`;
    heading(form, '02', `Container inventory / ${c.id}`, id,
      ['Line ID', 'Description / SKU', 'EA', 'Unit SGD', 'Goods SGD', 'Unit weight', 'Extended weight', 'Source reference'], widths);
    for (const l of c.lines) row(form, [
      {text:l.id, policy:'repeat'}, {html:`${esc(l.description)} · <span class="muted">${esc(l.sku)}</span>`, policy:'split', key:'description'},
      {text:l.quantity, numeric:true}, {html:monetary(l.unitGoodsCents, `unit-${l.id}`), numeric:true},
      {html:monetary(r.goods[l.id], `goods-${l.id}`), numeric:true}, {text:grams(l.unitWeightGrams)}, {text:grams(weight(l))},
      {text:c.reference, policy:'split'}
    ], widths, id, {lineId:l.id});
    row(form, [
      {html:`<b>${esc(c.id)} / SOURCE SUBTOTAL</b><br>${c.quantity} EA · ${esc(grams(c.weightGrams))}`, policy:'split'},
      {html:`Goods SGD ${monetary(c.goodsCents, `subtotal-goods-${c.id}`)}`, numeric:true},
      {html:`Allocated fees SGD ${monetary(c.feesCents, `subtotal-fees-${c.id}`)}`, numeric:true},
      {html:`${r.partial ? 'Partial landed' : 'Landed'} SGD ${monetary(c.landedCents, `subtotal-landed-${c.id}`)}`, numeric:true}
    ], [36, 20, 22, 22], id, {containerSubtotal:c.id});
  }
}
