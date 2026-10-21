import {describe,expect,it} from 'vitest';
import {describeChange} from '../studio-v3/ai-activity.js';
import {OPERATION_SCHEMAS} from '../studio-v3/agent-operation-schemas.js';
import {renderChangeCard} from '../studio-v3/ai-change-card.js';

// Representative diff entries for each operation, including every patch property.
const entries = {
  set_element_style:['header-title',['fontSize','bold','color','align']],
  set_style:['style',['color','font','padding','striped','borders','repeatHeader','repeatTable','pageNumbers','breakBefore']],
  set_table_style:['items',['rowBackground']],
  set_field:['customer-name',['label','kind','pointer','text','format','showLabel','labelStyle','valueStyle','width','assetId','height','fit','barcode']],
  add_field:['footer-note',['add_field','id','text']],
  remove_field:['customer-name',['remove_field']],
  reorder_fields:['customer',['order']],
  set_section:['header',['enabled','label','layout','breakBefore','keepTogether']],
  reorder_sections:['document',['sectionOrder']],
  set_page:['document',['page.paper','page.orientation','page.customSizeMm','page.printerProfile','page.margins']],
  set_logo:['header-title',['logo']],
  set_collection:['items',['collection']],
  set_heading:['header-title',['title']]
};
const styleProperties = new Set(['fontSize','bold','color','align','font','padding','striped','borders','rowBackground','labelStyle','valueStyle','width','height','fit','layout']);
describe('activity descriptions distinguish content from styling',()=> {
  for (const type of Object.keys(OPERATION_SCHEMAS)) it(`${type} never describes non-style changes as styling`,()=> {
    expect(entries).toHaveProperty(type);
    const [target,properties] = entries[type];
    for (const property of properties) {
      const line = describeChange({target,property,after:'{"fontSize":18,"bold":true}'});
      if (!styleProperties.has(property)) expect(line).not.toMatch(/\bstyle\b/i);
    }
  });
  it('identifies content changes rather than title or section styling',()=> {
    for (const [target,property,meaning] of [['header-title','title',/heading.*text/i],['items','collection',/table.*data source/i],['header-title','logo',/logo/i],['document','page.paper',/page setup/i],['customer-name','label',/field text/i],['footer-note','text',/field text/i]]) {
      const line = describeChange({target,property}); expect(line).toMatch(meaning); expect(line).not.toMatch(/style/i);
    }
  });
});

describe('change card state and disclosure',()=> {
  const bus = {}, panel = {getBus:()=>bus,canUndo:message=>message.id === 'current'};
  const message = {id:'current',status:'applied',appliedBus:bus,appliedRevision:1,diff:[{target:'header-title',property:'title',before:'Invoice',after:'Receipt'}]};
  it('distinguishes ready, expired and historical cards from the current applied card',()=> {
    const current = renderChangeCard(panel,message); expect(current.classList.contains('ai-change-applied')).toBe(true); expect(current.classList.contains('ai-change-history')).toBe(false);
    for (const status of ['ready','expired']) expect(renderChangeCard(panel,{...message,status}).classList.contains('ai-change-applied')).toBe(false);
    for (const history of [{...message,id:'earlier'},{...message,appliedBus:{}}]) expect(renderChangeCard(panel,history).classList.contains('ai-change-history')).toBe(true);
  });
  it('keeps technical evidence in the single native disclosure',()=> {
    const card = renderChangeCard(panel,message), details = card.querySelector('details.ai-change-details');
    expect(details.open).toBe(false); expect(details.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(JSON.parse(details.querySelector('pre').textContent)).toEqual(message.diff);
  });
});
