const pad = n => String(n).padStart(3, '0');
export function fixture(sample, count = 24, matched = false) {
  if (![0, 1, 24, 60, 150].includes(count)) throw new Error('Choose a supported PO line count');
  if (count === 24 && !matched) return structuredClone(sample);
  const data = structuredClone(sample);
  data.purchaseOrder.lines = [];
  data.receipts.forEach(r => r.lines = []);
  data.invoices.forEach(i => i.lines = []);
  data.ingestionEvents = [];
  for (let i = 1; i <= count; i++) {
    const id = pad(i), rg = Math.floor((i - 1) / Math.ceil(count / 3)), ig = Math.floor((i - 1) / Math.ceil(count / 2));
    const original = sample.purchaseOrder.lines[(i - 1) % 24];
    const po = {...original, id:`POL-${id}`, sku:`AST-${id}`, unitPriceCents:1000 + 125 * i,
      description:original.description + (i > 24 ? ` · batch ${Math.ceil(i / 24)}` : '')};
    data.purchaseOrder.lines.push(po);
    if (matched || i !== 5) data.receipts[rg].lines.push({id:`R${rg + 1}L-${id}`, poLineId:po.id,
      receivedQty:!matched && i === 3 ? 6 : 10, returnedQty:!matched && i === 18 ? 2 : 0,
      returnReference:!matched && i === 18 ? 'RET-DEMO-018' : null});
    const line = {id:`IL-${id}`, poLineId:!matched && i === 7 ? null : po.id, sku:po.sku, description:po.description,
      billedQty:!matched && i === 3 ? 8 : !matched && i === 5 ? 2 : 10, uom:'EA',
      unitPriceCents:po.unitPriceCents + (!matched && i === 2 ? 100 : 0)};
    data.invoices[ig].lines.push(line);
    data.ingestionEvents.push({id:`EVT-${id}`, invoiceId:data.invoices[ig].id, invoiceLineId:line.id, sourceRecordKey:`SRC-${line.id}`});
  }
  if (!matched && count >= 10) data.ingestionEvents.push({...data.ingestionEvents[9], id:`EVT-${pad(count + 1)}`});
  return data;
}
export const stressChinese = '这是虚构的采购复核叙述，仅用于检查中文长文本的自然分页。请按明确的来源编号核对订购、收货、退回与开票数量，不得根据相似货号推断关联。当前材料只记录可见事实，缺少的收货记录需要人工询问，不能将说明文字理解为任何处理结论。阅读下一页时应保持原文顺序，金额与数量只在首个片段展示，续页不产生新的业务记录。';
export const stressEnglish = 'This fictional review narrative tests readable continuation across physical sheets. Compare explicit source references and retain the distinction between an import event and a canonical invoice line. Ask whether another receipt record is missing; this narrative supplies no decision. Continue reading in source order without creating another monetary record.';
export const longNarrative = () => `${stressChinese.repeat(13)}\n\n${Array(5).fill(stressEnglish).join(' ')}\n\nEnd of bilingual fictional narrative. 双语虚构说明结束。`;
