const pad = (i, n = 2) => String(i).padStart(n, '0');
export const defaults = {containers:3, count:24, basis:'value', mode:'actual', scenario:'complete', notes:'standard'};
export function fixture(sample, state = defaults) {
  const {containers:C, count:N, basis, scenario} = {...defaults, ...state};
  if (![1, 3, 8].includes(C) || ![10, 24, 50, 120].includes(N) || !['complete', 'missing', 'zero'].includes(scenario)) throw new TypeError('Unsupported fixture');
  const data = structuredClone(sample);
  if (C !== 3 || N !== 24) {
    data.containers = Array.from({length:C}, (_, index) => {
      const id = pad(index + 1);
      return {id:`CONT-${id}`, label:`Fictional container ${id}`, reference:`DEMO-CONTAINER-${id}`, sealReference:`DEMO-SEAL-${id}`};
    });
    const names = sample.lines.slice(0, 12).map(l => l.description.split(' / specimen')[0]);
    data.lines = Array.from({length:N}, (_, index) => {
      const i = index + 1;
      return {id:`LIN-${pad(i, 3)}`, containerId:`CONT-${pad(Math.floor(index * C / N) + 1)}`, sku:`DEMO-SKU-${pad(i, 3)}`,
        description:`${names[index % 12]} / specimen ${pad(i)}`, quantity:5 + (i % 6) * 3, unitGoodsCents:1250 + 175 * i, unitWeightGrams:250 + (i % 5) * 125};
    });
    const charge = (id, description, scopeContainerIds, estimatedCents, actualCents) => ({id, description, scopeContainerIds,
      eligibleLineIds:data.lines.filter(l => scopeContainerIds.includes(l.containerId)).map(l => l.id), estimatedCents, actualCents, sourceRef:`DEMO-SRC-${id}`});
    const all = data.containers.map(c => c.id);
    data.charges = [charge('CHG-TRANSPORT', 'Synthetic ocean transport', all, 160000, 180000),
      ...data.containers.map((c, index) => charge(`CHG-HANDLING-${pad(index + 1)}`, c.label + ' handling', [c.id], 20000 + 2000 * ((index + 1) % 3), 21000 + 3000 * ((index + 1) % 3))),
      charge('CHG-TERMINAL', 'Terminal service example', all, 40000, 45000), charge('CHG-COVER', 'Illustrative cargo cover service', all, 16000, 18000),
      charge('CHG-CREDIT', 'Synthetic service credit', all, -10000, -12000), charge('CHG-INSPECTION', 'Inspection example', all.slice(-Math.min(2, C)), 30000, 36000)];
  }
  if (scenario === 'missing') data.lines.find(l => l.id === 'LIN-010').unitWeightGrams = null;
  if (scenario === 'zero') {
    const field = {value:'unitGoodsCents', quantity:'quantity', weight:'unitWeightGrams'}[basis];
    if (!field) throw new TypeError('Unknown zero basis');
    data.lines.forEach(l => l[field] = 0);
  }
  return data;
}
export const chinese = '这是虚构的物流成本分摊说明，仅用于检查长文本的自然分页。请按照明确的容器编号和货品行编号核对费用范围，不得根据相似名称建立关联。缺失重量不等于零重量；当所选依据不完整时，整笔相关费用应保留为未分摊，并清楚显示原因。分摊金额按整数分计算，剩余分数依确定的行编号顺序分配。续页只延续原文，不产生新的费用、货品或付款记录。所有数字和来源均为演示资料。';
export const english = 'This fictional logistics narrative demonstrates traceable allocation rather than a posting decision. Retain explicit eligible line references, preserve unknown measurements as unknown, and show unresolved charges separately from allocated landed costs. Continue in source order across pages without copying monetary fields. The illustrated service credit uses the same deterministic largest-remainder policy as positive charges. No statement here represents a real tariff, shipment, payment or professional accounting conclusion.';
export const longNarrative = () => Array(12).fill(`中文：${chinese}\n\nEnglish: ${english}`).concat(Array(5).fill(english)).join('\n\n');
