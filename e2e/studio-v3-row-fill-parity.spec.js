import {clickHeaderAction} from './header-action.js';
import {expectApplied} from './ai-applied.js';
import {test,expect} from './studio-v3-test.js';
import {keepStructureOpen} from './studio-v3-structure.js';
import {limitToSelection,limitToWholeForm} from './studio-v3-scope.js';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {validatePaperReport,inspectProject} from '../studio-v3/validation.js';
import {safeRunDiagnostics} from '../studio-v3/ai-inspection.js';
import {compileProject} from '../studio-v3/model.js';
import {createEmptyProject} from '../studio-v2/core/project-model.js';

globalThis.DOMParser ??= new JSDOM('').window.DOMParser;

test.use({workInSteps:true});
test.setTimeout(120000);
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper = page => page.frameLocator('#preview-frame');
const fill = value => ({summary:'Table row fill',operations:[{type:'set_table_style',target:'items',patch:{rowBackground:value}}]});
const completion = value => [['apply_operations',fill(value)],['inspect_draft'],['finish',{summary:'Table row fill'}]];
const send = async(page,text) => { await page.locator('#ai-prompt').fill(text); await page.locator('[data-ai-send]').click(); };
const normalized = project => {
  const design = structuredClone(project.manifest.studioV3);
  design.page = {paper:design.page?.paper || 'A4',orientation:design.page?.orientation || 'portrait',margins:{top:0,right:0,bottom:0,left:0,...design.page?.margins}};
  const {revision,...content} = project;
  return {...content,manifest:{...project.manifest,studioV3:design}};
};

async function gateway(page,steps) {
  await page.addInitScript(steps=> {
    const original = window.fetch.bind(window), json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    let turn = 0; window.__rowFillWire = []; window.__rowFillReports = [];
    window.addEventListener('message',event=> {
      if (event.source === document.querySelector('#preview-frame')?.contentWindow && event.data?.source === 'printform-studio-v3-preview' && event.data.type === 'rendered') window.__rowFillReports.push(event.data.payload.report);
    });
    window.fetch = async(input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body = JSON.parse(init.body); window.__rowFillWire.push(body);
      const [name,args={}] = steps[turn++], output = [{type:'function_call',call_id:`row_fill_${turn}`,name,arguments:JSON.stringify(args)}];
      const response = {status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },steps);
}
async function save(page,info,name) {
  const revision = await page.locator('#revision').innerText(), pending = page.waitForEvent('download');
  await clickHeaderAction(page,'save'); const download = await pending, path = info.outputPath(name);
  await download.saveAs(path); await expect(page.locator('#revision')).toHaveText(revision.split(' ·')[0]);
  return {path,project:JSON.parse(await fs.readFile(path,'utf8')).project};
}
async function diagnostics(page,project) {
  const rendered = await page.evaluate(()=>window.__rowFillReports.at(-1));
  // Studio saves only manifest/data/revision. Recompile before applying the existing static validators.
  const candidate = compileProject({...createEmptyProject(),...project,schema:{type:'object',additionalProperties:true}},project.manifest.studioV3);
  const report = validatePaperReport(rendered,candidate);
  return {report,diagnostics:safeRunDiagnostics({report,quality:inspectProject(candidate,report)},candidate)};
}
async function retain(page,info,evidence) {
  const wire = await page.evaluate(()=>window.__rowFillWire), path = info.outputPath('row-fill-parity.json');
  await fs.writeFile(path,JSON.stringify({browser:info.project.name,wire,...evidence},null,2));
  await info.attach('row-fill-parity',{path,contentType:'application/json'});
}
test.beforeEach(async({page})=> { page.on('dialog',dialog=>dialog.accept()); await keepStructureOpen(page); });

for (const kind of ['style','block']) test(`real ${kind} inspector and Pi wire agree on row fill, diagnostics, reset and automatic apply`,async({page},info)=> {
  const errors = []; page.on('pageerror',error=>errors.push(error.message));
  await gateway(page,[...completion('#12aBcD'),...completion(null)]);
  await page.goto('/studio-v3/'); await ready(page);
  const before = await save(page,info,'before.printform.json');
  const originalColors = await paper(page).locator('.prowitem_processed tr').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));
  if (kind === 'style') await page.locator('[data-action=go-style]').click(); else await page.locator('#left-panel [data-select=items]').click();
  const input = page.getByLabel('Table row background',{exact:true}), apply = page.getByRole('button',{name:kind === 'style' ? 'Apply style' : 'Apply section',exact:true});
  await input.fill('#gggggg'); expect(await input.evaluate(node=>node.checkValidity())).toBe(false);
  await apply.click(); await expect(page.locator('#revision')).toHaveText('r0');
  await input.fill('#12aBcD'); await apply.click(); await ready(page); await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  await expect(paper(page).locator('.prowitem_processed td').first()).toHaveCSS('background-color','rgb(18, 171, 205)');
  const ui = await save(page,info,'ui.printform.json'), uiObserved = await diagnostics(page,ui.project);
  expect(uiObserved.diagnostics.ready).toBe(true); expect(ui.project.sampleData).toEqual(before.project.sampleData);
  const expected = normalized(before.project); expected.manifest.studioV3.tableStyle = {rowBackground:'#12aBcD'};
  expect(normalized(ui.project).manifest.studioV3).toEqual(expected.manifest.studioV3);
  await page.locator('[data-action=undo]').click(); await ready(page); await expect(page.locator('#revision')).toHaveText(/^r2\b/);
  await page.locator('[data-ai-toggle]').click();
  if (kind === 'block') { await page.locator('#left-panel [data-select=items]').click(); await limitToSelection(page); }
  await send(page,'Set table row background to #12aBcD.');
  await expectApplied(page,3,{timeout:60000}); await expect(page.locator('.ai-diff')).toContainText('tableStyle.rowBackground');
  const piObserved = await diagnostics(page,ui.project);
  expect(piObserved.diagnostics).toEqual(uiObserved.diagnostics);
  const wire = await page.evaluate(()=>window.__rowFillWire);
  expect(wire).toHaveLength(3);
  const observed = JSON.parse(wire[2].input.find(item=>item.type === 'function_call_output' && item.call_id === 'row_fill_2').output);
  const {observation,...numeric} = observed; expect(numeric).toEqual(uiObserved.diagnostics); expect(observation).toMatchObject({baseRevision:2,candidateVersion:1});
  await ready(page); await expect(page.locator('#revision')).toHaveText(/^r3\b/);
  const pi = await save(page,info,'pi.printform.json'); expect(normalized(pi.project)).toEqual(normalized(ui.project));
  await expect(paper(page).locator('th').first()).toHaveCSS('background-color','rgb(233, 239, 248)');
  await expect(paper(page).locator('.brand-mark').first()).toHaveCSS('color','rgb(23, 99, 220)');
  await send(page,'Clear table row background.'); await expectApplied(page,4); await ready(page);
  const cleared = await save(page,info,'cleared.printform.json');
  expect(normalized(cleared.project).manifest.studioV3).toEqual(normalized(before.project).manifest.studioV3);
  expect(cleared.project.sampleData).toEqual(before.project.sampleData);
  expect(await paper(page).locator('.prowitem_processed tr').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor))).toEqual(originalColors);
  await page.locator('[data-ai=undo]').click(); await ready(page); const undone = await save(page,info,'undone.printform.json');
  expect(normalized(undone.project).manifest.studioV3).toEqual(normalized(ui.project).manifest.studioV3);
  expect(errors).toEqual([]); await retain(page,info,{kind,uiObserved,piObserved,ui:ui.project,pi:pi.project,cleared:cleared.project});
});

test('real Pi schema and column scope reject row fill before fresh table-scope recovery',async({page},info)=> {
  await gateway(page,[['apply_operations',fill('#gggggg')],['apply_operations',fill('#12aBcD')],['report_blocked',{reason:'Column selection cannot recolor the table.'}],...completion('#12aBcD')]);
  await page.goto('/studio-v3/'); await ready(page); const before = await save(page,info,'rejection-before.printform.json');
  await page.locator('#left-panel [data-select=items-description]').click(); await page.locator('[data-ai-toggle]').click(); await limitToSelection(page);
  await send(page,'Set table row background to #12aBcD.'); await expect(page.locator('.ai-assistant[data-state=error]')).toBeVisible({timeout:60000});
  await expect(page.locator('[data-ai-proposal]')).toBeHidden(); await expect(page.locator('[data-ai=apply]')).toHaveCount(0); await expect(page.locator('#revision')).toHaveText('r0');
  const rejected = await save(page,info,'rejected.printform.json'); expect(rejected.project).toEqual(before.project);
  const wire = await page.evaluate(()=>window.__rowFillWire);
  expect(wire[1].input.find(item=>item.type === 'function_call_output' && item.call_id === 'row_fill_1').output).toContain('AGENT_ARGUMENTS_INVALID');
  expect(wire[2].input.find(item=>item.type === 'function_call_output' && item.call_id === 'row_fill_2').output).toContain('UNSAFE_SCOPE');
  await limitToWholeForm(page); await page.locator('#left-panel [data-select=items]').click(); await limitToSelection(page);
  await send(page,'Set table row background to #12aBcD.'); await expectApplied(page,1); await ready(page);
  const recovered = await save(page,info,'recovered.printform.json');
  expect(recovered.project.manifest.studioV3.tableStyle).toEqual({rowBackground:'#12aBcD'}); expect(recovered.project.sampleData).toEqual(before.project.sampleData);
  await retain(page,info,{before:before.project,rejected:rejected.project,recovered:recovered.project});
});
