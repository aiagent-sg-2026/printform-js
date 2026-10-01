import { describe, expect, it } from 'vitest';
import { sampleData, defaultDesign } from '../studio-v3/model.js';
import { dataValue, setDataValue, validateDataset, importDataset, exportDataset, datasetRecord, newItem, itemColumns } from '../studio-v3/database-model.js';

describe('Studio v3 local demo dataset contract', () => {
  it('retains independent ERP numbers and unknown fields through dataset export/import', () => {
    const data = sampleData('invoice',1); data.items[0].quantity = 77; data.items[0].rate = 999;
    data.summary.total = 12001; data.customer.phone = '+60 3 5550 0199'; data.external = {reference:'ERP-100'};
    const imported = importDataset(exportDataset(datasetRecord('invoice',data,'Client demo')),'invoice');
    expect(imported.data.items[0].amount).toBe(250);
    expect(imported.data.summary).toEqual({subtotal:250,tax:20,total:12001,packages:'1'});
    expect(imported.data.customer.phone).toBe('+60 3 5550 0199');
    expect(imported.data.external.reference).toBe('ERP-100');
  });
  it('uses new identity for imports and rejects template mismatch before writes', () => {
    const record = datasetRecord('purchase',sampleData('purchase',0),'Supplier demo');
    expect(importDataset(exportDataset(record),'purchase').id).not.toBe(record.id);
    expect(() => importDataset(exportDataset(record),'invoice')).toThrow('matching document template');
    expect(() => importDataset('{"format":"printform-studio-v3-dataset","version":99,"dataset":{}}','invoice')).toThrow('version');
  });
  it('rejects unsafe data keys and pointers without changing prototype state', () => {
    const unsafe = JSON.parse('{"items":[],"customer":{"__proto__":{"polluted":true}}}');
    expect(() => validateDataset(unsafe)).toThrow('Prototype');
    expect(() => setDataValue({},'/constructor/prototype/polluted',true)).toThrow('Unsafe');
    expect({}.polluted).toBeUndefined();
    const data = {custom:{'a/b':{'x~y':'before'}}};
    setDataValue(data,'/custom/a~1b/x~0y','after');
    expect(dataValue(data,'/custom/a~1b/x~0y')).toBe('after');
  });
  it('enforces finite supplied numbers and bounded row/data sizes', () => {
    expect(() => validateDataset(sampleData('invoice',500))).not.toThrow();
    expect(() => validateDataset(sampleData('invoice',501))).toThrow('500');
    const data = sampleData('invoice',1); data.items[0].amount = '';
    expect(() => validateDataset(data)).toThrow('finite number');
    data.items[0].amount = Infinity; expect(() => validateDataset(data)).toThrow('finite');
    expect(() => validateDataset({items:[],notes:'x'.repeat(2*1024*1024)})).toThrow('2 MB');
    expect(() => validateDataset({items:[null]})).toThrow('object');
  });
  it('creates editable blank supplied item values without deriving monetary amounts', () => {
    const data = sampleData('invoice',1), row = newItem(data,defaultDesign());
    expect(row).toEqual({no:2,sku:'',description:'',quantity:0,rate:0,amount:0});
    expect(data.items).toHaveLength(1);
    expect(data.summary.total).toBe(270);
  });
});


it('invalid current-form collections remain inspectable without crashing the table schema',()=>{
  const design=defaultDesign('invoice');
  expect(itemColumns({items:{}},design)).toHaveLength(design.columns.length);
  expect(itemColumns({},design)).toHaveLength(design.columns.length);
  expect(()=>validateDataset({items:{}})).toThrow('array');
});
