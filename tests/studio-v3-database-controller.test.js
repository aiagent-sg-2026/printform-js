import {it,expect,vi} from 'vitest';
import {newProject} from '../studio-v3/model.js';
import {createBus,replaceData} from '../studio-v3/controller.js';
import {DemoDatabase} from '../studio-v3/database-controller.js';
import {databaseView} from '../studio-v3/database-view.js';
function setup(){
  const project=newProject();project.sampleData.items[0].weight=5;project.sampleData.items[1].weight=6;
  const bus=createBus(project),state={sample:'erp',dataDraft:null,mode:'data'},database=new DemoDatabase({project:()=>bus.project,state:()=>state,context:()=>bus,render:()=>{},busy:()=>{},apply:(data,ref,ctx,source,title)=>replaceData(ctx,data,'erp',ref,source,title)});
  database.store={persistent:true,write:vi.fn()};return {bus,state,database};
}
it('custom numeric edits block navigation Apply and Save through the same validation',async()=>{
  const {bus,database}=setup();database.input({dataset:{dbPointer:'/items/1/weight',dbType:'number'},value:''});
  const before=bus.revision;
  await expect(database.action('apply-draft',{})).rejects.toThrow('/items/1/weight');
  await expect(database.save(true)).rejects.toThrow('/items/1/weight');
  expect(bus.revision).toBe(before);expect(bus.project.sampleData.items[1].weight).toBe(6);
  expect(database.store.write).not.toHaveBeenCalled();expect(database.draft.data.items[1].weight).toBe('');
});
it('deleting another row remaps outstanding number errors and retains numeric editors for repair',async()=>{
  const {bus,state,database}=setup();database.input({dataset:{dbPointer:'/items/1/weight',dbType:'number'},value:''});
  await database.action('delete-row',{dataset:{row:'0'}});expect(database.errors).toContain('/items/0/weight');
  await expect(database.save(true)).rejects.toThrow('/items/0/weight');expect(database.store.write).not.toHaveBeenCalled();
  expect(databaseView(database,bus.project,state)).toContain('data-db-type="number" aria-label="/items/0/weight"');
  database.input({dataset:{dbPointer:'/items/0/weight',dbType:'number'},value:'8'});
  expect(()=>database.validateDraft()).not.toThrow();await database.action('apply-draft',{});
  expect(bus.project.sampleData.items[0].weight).toBe(8);expect(database.draft).toBeNull();
});
