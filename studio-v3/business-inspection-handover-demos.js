const sourced = (value, path, meaning) => ({ ...value, provenance: { sourcePath: `fictional/${path}`, meaning } });
const measure = (amount, uom, path, meaning) => sourced({ amount, decimalPlaces: 3, uom }, path, meaning);

export function inspectionDemo(common) {
  return { ...common('InspectionReport', 'DEMO-QC-001'), inspection: {
    reference: sourced({ id: 'QC-001', number: 'INSPECT-001' }, 'inspection/reference', 'Supplied inspection reference'),
    subject: sourced({ id: 'SUBJECT-001', name: 'Fictional bracket · 虚构支架', lot: '000-LOT-A' }, 'inspection/subject', 'Supplied subject identity; no sampling inference'),
    status: sourced({ value: 'Source review pending · 待复核' }, 'inspection/status', 'Source workflow label, not certification'),
    checks: [
      sourced({ id: 'CHECK-DIMENSION', characteristic: 'Recorded dimension · 尺寸', observed: 'Recorded instrument reading', expected: 'Supplier drawing ref DEMO-01', method: 'Source instrument note',
        measure: measure('00012.500', 'mm', 'inspection/dimension/measure', 'Independent supplied dimensional reading') }, 'inspection/dimension', 'Source observation; no computed tolerance result'),
      sourced({ id: 'CHECK-OFFSET', characteristic: 'Recorded offset · 偏差', observed: 'Signed source offset only',
        measure: measure('-0000.125', 'mm', 'inspection/offset/measure', 'Independent signed measurement; not an asset quantity') }, 'inspection/offset', 'Source observation, not an inferred failure'),
      sourced({ id: 'CHECK-SURFACE', characteristic: 'Surface note · 表面', observed: 'Source says light surface mark', result: 'Further review requested by source' }, 'inspection/surface', 'Supplied result text only')
    ]
  }, notes: 'All records are fictional. Observations, limits and result labels are independent supplied facts. No automatic pass/fail, sampling plan, calibration or ISO certification.' };
}

export function handoverDemo(common) {
  return { ...common('AssetHandover', 'DEMO-HANDOVER-001'), handover: {
    record: sourced({ id: 'HANDOVER-001', number: 'MOVE-001', purpose: 'Proposed internal equipment handover · 拟内部交接' }, 'handover/record', 'Supplied instruction only; no transfer completion'),
    from: sourced({ id: 'DEMO-STORE', name: 'Fictional equipment store' }, 'handover/from', 'Supplied source party/location'),
    to: sourced({ id: 'DEMO-WORKSHOP', name: 'Fictional workshop' }, 'handover/to', 'Supplied destination; not proof of receipt'),
    status: sourced({ value: 'Recipient review pending · 接收待复核' }, 'handover/status', 'Supplied source workflow; not a signature'),
    assets: [
      sourced({ id: 'HANDOVER-LINE-A', asset: { id: 'ASSET-0001', name: 'Fictional bench tool · 虚构工具', serialNumber: '000-SERIAL-A' }, condition: 'Source says protective cover marked', accessories: 'Source lists one cable; not counted by Studio',
        quantity: measure('+0001.000', 'set', 'handover/tool/quantity', 'Supplied exact quantity and unit') }, 'handover/tool', 'Supplied asset condition, not recipient acceptance'),
      sourced({ id: 'HANDOVER-LINE-B', asset: { id: 'ASSET-0002', name: 'Fictional measuring fixture' }, condition: 'Condition not inspected; source note only' }, 'handover/fixture', 'No quantity or serial supplied; missing values remain absent')
    ]
  }, notes: 'All identities are fictional. No transfer of legal ownership, signature, customer acceptance, valuation, depreciation or receipt is inferred. Missing quantity is not replaced with one.' };
}
