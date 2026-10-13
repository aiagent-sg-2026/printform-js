import {it,expect} from 'vitest';
import {bindTemplate} from '../../studio-v2/core/binding.js';
import {inspectRenderedDocument} from '../../studio-v2/core/acceptance.js';
import {measureBoundRows} from '../../studio-v2/core/row-limits.js';

function bind(html,data) {
  document.documentElement.lang='en-MY'; document.title='Repeat integrity';
  const template=document.createElement('template');template.innerHTML=`<section class="printform">${html}</section>`;
  const bound=bindTemplate(template,data);
  document.body.replaceChildren(bound.fragment);
  document.querySelector('.printform')?.classList.replace('printform','printform_page');
  document.querySelectorAll('.prowitem').forEach(node=>node.classList.replace('prowitem','prowitem_processed'));
  return {template,bound};
}
function rowErrors(bound) {
  return inspectRenderedDocument(document,{}, {expectedRowCount:bound.report.tableRows,expectedRowsByRepeat:bound.report.expectedRowsByRepeat}).errors.filter(e=>e.code.startsWith('ROW_'));
}
const row=(pointer,id='')=>`<div class="prowitem" data-pf-table-id="${id}" data-pf-each="${pointer}"><span data-pf-text="./name"></span></div>`;

it('accepts two independently indexed tables and detects balanced cross-table row loss/duplication',()=>{
  const {bound}=bind(row('/a','a')+row('/b','b'),{a:[{name:'A1'},{name:'A2'}],b:[{name:'B1'},{name:'B2'}]});
  expect(rowErrors(bound)).toEqual([]);
  const nodes=document.querySelectorAll('.prowitem_processed');nodes[0].after(nodes[0].cloneNode(true));nodes[2].remove();
  const codes=rowErrors(bound).map(e=>e.code);
  expect(codes).toContain('ROW_COUNT_MISMATCH');expect(codes).toContain('ROW_DUPLICATE_INDEX');
});
it('distinguishes repeated templates with the same default table ID',()=>{
  const {bound}=bind(row('/a')+row('/b'),{a:[{name:'A'}],b:[{name:'B'}]});
  expect(Object.keys(bound.report.expectedRowsByRepeat)).toHaveLength(2);
  expect(rowErrors(bound)).toEqual([]);
});
it('preserves nested scope identity and rejects reordered rows within one nested repeat',()=>{
  const {bound}=bind(`<div data-pf-each="/groups">${row('./children','nested')}</div>`,{groups:[{children:[{name:'A1'},{name:'A2'}]},{children:[{name:'B1'},{name:'B2'}]}]});
  expect(Object.values(bound.report.expectedRowsByRepeat)).toEqual([2,2]);expect(rowErrors(bound)).toEqual([]);
  const nodes=document.querySelectorAll('.prowitem_processed');nodes[0].before(nodes[1]);
  expect(rowErrors(bound).map(e=>e.code)).toContain('ROW_ORDER_MISMATCH');
});
it('fails when a renderer strips identity even if the global row count remains correct',()=>{
  const {bound}=bind(row('/a','a'),{a:[{name:'A'}]});document.querySelector('.prowitem_processed').removeAttribute('data-pf-row-repeat');
  expect(rowErrors(bound).map(e=>e.code)).toContain('ROW_IDENTITY_MISMATCH');
});
it('preflights nested relative table budgets for both DOM templates and Node-style source strings',()=>{
  const template=document.createElement('template');template.innerHTML=`<section class="printform"><div data-pf-each="/groups">${row('./children','nested')}</div></section>`;
  const data={groups:[{children:Array.from({length:300},()=>({name:'A'}))},{children:Array.from({length:300},()=>({name:'B'}))}]};
  expect(measureBoundRows(data,template)).toMatchObject({total:600,byTable:{nested:600}});
  expect(measureBoundRows(data,template.innerHTML)).toMatchObject({total:600,byTable:{nested:600}});
  const bound=bindTemplate(template,data);
  expect(bound.report.errors.map(e=>e.code)).toEqual(['ROW_LIMIT','ROW_LIMIT']);
  expect(bound.report.rows).toBe(0);expect(bound.fragment.children).toHaveLength(0);
});
it('allows the exact nested aggregate boundary before cloning',()=>{
  const template=document.createElement('template');template.innerHTML=`<div data-pf-each="/groups">${row('./children','nested')}</div>`;
  const data={groups:[{children:Array.from({length:250},()=>({name:'A'}))},{children:Array.from({length:250},()=>({name:'B'}))}]};
  const bound=bindTemplate(template,data);
  expect(bound.report.errors).toEqual([]);expect(bound.report.tableRows).toBe(500);
});
