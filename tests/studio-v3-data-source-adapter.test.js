import { describe,it,expect } from 'vitest';
import { createLocalDatasetSource } from '../studio-v3/data-source-adapter.js';
import { sampleData } from '../studio-v3/model.js';
const fixture = () => ({id:'demo:one',title:'Synthetic invoice',type:'invoice',revision:2,origin:'builtin-demo',data:{...sampleData('invoice',1),document:{kind:'SalesInvoice',currency:'MYR'}}});
describe('bounded read-only dataset source',()=>{
  it('lists only identity metadata and explicitly reads a revision',async()=>{
    const r=fixture(),source=createLocalDatasetSource({persistent:true,list:async()=>[structuredClone(r)]});
    const list=await source.list({documentKind:'SalesInvoice'});
    expect(list).toHaveLength(1); expect(JSON.stringify(list)).not.toContain('ACME');
    expect((await source.read(r.id,{revision:2})).data.items).toHaveLength(1);
    await expect(source.read(r.id,{revision:1})).rejects.toThrow('changed');
    await expect(source.read('missing')).rejects.toThrow('unavailable');
    expect(await source.list({documentKind:'PurchaseInvoice'})).toEqual([]);
  });
  it('does not expose query/write or value-bearing schema',async()=>{
    const r=fixture(),source=createLocalDatasetSource({list:async()=>[r]});
    const schema=await source.schema(r.id);
    expect(schema.collections[0].fields.some(f=>f.pointer==='./amount')).toBe(true);
    expect(JSON.stringify(schema)).not.toContain('ACME');
    expect(source.query).toBeUndefined(); expect(source.write).toBeUndefined();
    await expect(source.list({limit:1000})).rejects.toThrow('limit');
    await expect(source.list({type:'SQL'})).rejects.toThrow('family');
  });
});
