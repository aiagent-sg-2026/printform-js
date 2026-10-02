import { beforeEach, expect, it, vi } from 'vitest';
import { AIElementTags, elementMetadata, validateElementReferences, MAX_ELEMENT_TAGS } from '../studio-v3/ai-element-tags.js';
import { newProject, designOf } from '../studio-v3/model.js';
import { createBus, designOperations, editProject } from '../studio-v3/controller.js';

beforeEach(()=> { document.body.innerHTML = '<button data-ai-add>Add to chat</button><div data-ai-element-tags hidden></div>'; });
function setup() {
  let bus = createBus(newProject()), selected = 'items-description';
  const changed = vi.fn(), highlight = vi.fn(), select = vi.fn(), open = vi.fn(), report = vi.fn();
  const tags = new AIElementTags({bus:()=>bus,selection:()=>selected,onChange:changed,highlight,select,open,report});
  return {tags,changed,highlight,select,open,report,get bus(){return bus;},choose:id=>selected=id,replace:value=>bus=value};
}
it('adds multiple stable semantic references and comments without business or binding content',()=> {
  const {tags,bus,changed} = setup();
  tags.add('header-company'); tags.add('label-items-description'); tags.add('header-title');
  const input = document.querySelector('[data-ai-tag-comment="header-company"]'); input.value = 'Make this value 16pt and navy'; input.dispatchEvent(new Event('input',{bubbles:true}));
  const payload = tags.payload();
  expect(payload[0]).toEqual({documentId:bus.project.manifest.documentId,revision:0,id:'header-company',kind:'field',block:'header',role:'value',comment:'Make this value 16pt and navy'});
  expect(payload[1]).toMatchObject({id:'label-items-description',kind:'label',role:'label'});
  expect(payload[2]).toMatchObject({id:'header-title',kind:'heading'});
  for (const text of ['ACME','Industrial','Company','/company/name','125','Sterling']) expect(JSON.stringify(payload)).not.toContain(text);
  expect(changed).toHaveBeenCalledTimes(4);
  expect(document.querySelector('[data-ai-element-tags]').hidden).toBe(false);
});
it('deduplicates by stable ID, bounds references and rejects arbitrary/cross-document metadata',()=> {
  const {tags,bus} = setup(); tags.add('items-description'); tags.add('items-description'); expect(tags.payload()).toHaveLength(1);
  for (const id of ['header-company','header-date','header','customer','items','footer','totals']) tags.add(id);
  expect(tags.payload()).toHaveLength(MAX_ELEMENT_TAGS); expect(()=>tags.add('items-sku')).toThrow('at most'); expect(()=>tags.add('items-0')).toThrow('existing');
  const reference = tags.payload()[0];
  expect(()=>validateElementReferences(bus.project,[{...reference,data:bus.project.sampleData}])).toThrow('Invalid');
  expect(()=>validateElementReferences(bus.project,[{...reference,role:'company-name'}])).toThrow('Invalid');
  expect(()=>validateElementReferences(bus.project,[{...reference,documentId:'v3-other'}])).toThrow('another document');
});
it('reordering never retargets a positional neighbor and revisions require explicit remove/re-add',async()=> {
  const {tags,bus} = setup(); tags.add('items-description');
  const design = designOf(bus.project); design.columns.reverse();
  await editProject(bus,designOperations(bus.project,design),'reorder'); tags.contextChanged();
  expect(()=>tags.payload()).toThrow('Older revision');
  expect(document.querySelector('[data-ai-tag-id="items-description"]').hasAttribute('data-invalid')).toBe(true);
  expect(document.querySelector('[data-ai-tag-action="locate"]').disabled).toBe(true);
  expect(()=>tags.add('items-description')).toThrow('Remove');
  tags.remove('items-description'); tags.add('items-description');
  expect(tags.payload()[0]).toMatchObject({id:'items-description',revision:1});
  expect(tags.payload()[0]).not.toHaveProperty('index');
});
it('deleted references remain visibly blocked, even when another field takes the old position',async()=> {
  const {tags,bus} = setup(); tags.add('items-sku');
  const design = designOf(bus.project); design.columns.splice(1,1);
  await editProject(bus,designOperations(bus.project,design),'remove'); tags.contextChanged();
  expect(()=>tags.payload()).toThrow('Deleted element'); expect(tags.snapshot()[0].id).toBe('items-sku');
  expect(document.querySelector('[data-ai-element-tags]').textContent).toContain('Send is blocked');
  tags.clear(); expect(tags.payload()).toEqual([]);
});
it('switching away and back never revives a reference; restored references always need fresh targeting',()=> {
  const state = setup(), old = state.bus; state.tags.add('customer-bill'); const saved = state.tags.snapshot();
  state.replace(createBus(newProject())); state.tags.contextChanged(); state.replace(old); state.tags.contextChanged();
  expect(()=>state.tags.payload()).toThrow('Another document');
  state.tags.restoreSnapshot(saved); expect(()=>state.tags.payload()).toThrow('Recovered reference');
  state.tags.clear(); state.tags.add('customer-bill'); expect(state.tags.payload()[0].revision).toBe(0);
  expect(()=>AIElementTags.validateSnapshot([{...saved[0],comment:'x'.repeat(501)}])).toThrow('Invalid');
});
it('hover/focus highlights the exact ID, click locates it and removing a chip never sends',async()=> {
  const {tags,highlight,select,changed} = setup(); tags.add('header-company');
  const locate = document.querySelector('[data-ai-tag-action="locate"]');
  locate.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})); expect(highlight).toHaveBeenLastCalledWith('header-company');
  locate.click(); await Promise.resolve(); expect(select).toHaveBeenLastCalledWith('header-company');
  document.querySelector('[data-ai-tag-action="remove"]').click(); expect(tags.payload()).toEqual([]); expect(changed).toHaveBeenCalledTimes(2);
  expect(highlight).toHaveBeenLastCalledWith(null);
});
it('Add to chat opens the composer after draft protection and busy controls cannot alter references',async()=> {
  const {tags,open} = setup(); document.querySelector('[data-ai-add]').click(); await Promise.resolve();
  expect(open).toHaveBeenCalledOnce(); expect(tags.payload()[0].id).toBe('items-description');
  tags.setBusy(true); expect(document.querySelector('[data-ai-add]').disabled).toBe(true); expect(document.querySelector('[data-ai-tag-comment]').disabled).toBe(true);
  expect(()=>tags.add('header')).toThrow('Wait'); tags.remove('items-description'); expect(tags.payload()).toHaveLength(1);
  tags.consume(); expect(tags.payload()).toEqual([]); tags.setBusy(false);
});
it('only actual stable field IDs resolve, including label/value roles and special semantic elements',()=> {
  const project = newProject();
  expect(elementMetadata(project,'items-2')).toBeNull();
  expect(elementMetadata(project,'label-header-company')).toMatchObject({kind:'label',block:'header',role:'label'});
  expect(elementMetadata(project,'header-logo')).toMatchObject({kind:'image',role:'logo'});
  expect(elementMetadata(project,'page-number')).toMatchObject({kind:'page-number'});
});
