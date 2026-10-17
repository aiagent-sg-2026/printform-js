const provenance = (sourcePath, meaning) => ({ sourcePath, meaning });
const sourced = (value, path, meaning) => ({ ...value, provenance: provenance(path, meaning) });
const quantity = (amount, uom, path, meaning) => sourced({ amount, uom, decimalPlaces: 3 }, path, meaning);

export function serviceDemo(common) {
  return { ...common('ServiceReport', 'DEMO-SVC-101'), service: {
    job: sourced({ id: 'JOB-101', number: 'WO-101', request: 'Inspect noise · 检查异响' }, 'demo/job', 'Supplied request · 来源请求'),
    customer: sourced({ id: 'CUST-01', name: 'Fictional Willow · 虚构柳客户', address: 'Demo lane · 虚构演示巷' }, 'demo/customer', 'Source customer · 来源客户'),
    asset: sourced({ id: 'ASSET-01', name: 'Fictional bench fan · 虚构台扇', serialNumber: '000-FAN-A' }, 'demo/asset', 'Source asset · 来源设备'),
    status: sourced({ value: 'Inspection notes only · 仅检查记录' }, 'demo/job/status', 'Source state, not acceptance · 非验收'),
    observations: [
      sourced({ id: 'SVC-OBS-1', category: 'observation', description: 'Noise reported at low speed · 低速异响记录' }, 'demo/work/1', 'Supplied observation · 来源观察'),
      sourced({ id: 'SVC-WORK-2', category: 'work', description: 'Bearing inspection recorded · 轴承检查记录',
        quantity: quantity('0001.250', 'hour', 'demo/work/2/hours', 'Source hours, no fee · 工时非费用') }, 'demo/work/2', 'Source work note · 来源作业记录'),
      sourced({ id: 'SVC-NEXT-3', category: 'recommendation', description: 'Request further review · 建议进一步检查' }, 'demo/work/3', 'Recommendation, no completion · 建议非完工')
    ]
  }, notes: 'Fictional service fixture · 全部虚构。No completion, acceptance, payment or safety certification inferred.' };
}

export function packingDemo(common) {
  return { ...common('PackingList', 'DEMO-PACK-101'), packing: {
    shipment: sourced({ id: 'SHIP-101', number: 'SHIP-DEMO-101' }, 'demo/shipment', 'Supplied shipment · 来源货运'),
    from: sourced({ id: 'WH-A', name: 'Fictional store · 虚构仓库', bin: 'A-01' }, 'demo/from', 'Source location · 发货位置'),
    to: sourced({ id: 'WH-B', name: 'Fictional receiving · 虚构收货点', bin: 'B-02' }, 'demo/to', 'Destination · 目的位置'),
    status: sourced({ value: 'Packing snapshot · 装箱快照' }, 'demo/pack/status', 'Source state, no delivery proof · 非签收'),
    packages: [
      { ...sourced({ id: 'PKG-01', type: 'Carton · 纸箱', marks: 'DEMO-A / 演示甲' }, 'demo/pkg/1', 'Source package · 来源包装'),
        grossWeight: quantity('0005.250', 'kg', 'demo/pkg/1/gross', 'Supplied gross · 来源毛重'),
        netWeight: quantity('+0004.000', 'kg', 'demo/pkg/1/net', 'Independent net · 独立净重'),
        items: [sourced({ id: 'PACK-ITEM-1', item: { id: 'ITEM-A', code: 'DEMO-A', name: 'Fictional bracket · 虚构支架' }, description: 'Bracket set · 支架组',
          quantity: quantity('0012.500', 'set', 'demo/pkg/1/qty', 'Supplied quantity · 来源数量') }, 'demo/pkg/1/item', 'Source item · 来源货项')] },
      { ...sourced({ id: 'PKG-02', type: 'Crate · 木箱', marks: 'DEMO-B / 演示乙' }, 'demo/pkg/2', 'Source package · 来源包装'),
        grossWeight: quantity('002.750', 'lb', 'demo/pkg/2/gross', 'Source unit, no conversion · 不换算'),
        items: [sourced({ id: 'PACK-ITEM-2', item: { id: 'ITEM-B', name: 'Fictional cable · 虚构线材' }, description: 'Cable length · 线材长度',
          quantity: quantity('0007.125', 'm', 'demo/pkg/2/qty', 'Supplied length · 来源长度') }, 'demo/pkg/2/item', 'Source item · 来源货项')] }
    ]
  }, notes: 'Fictional packing fixture · 全部虚构。No package counts, weight totals, conversions, prices, customs or delivery assertions inferred.' };
}
