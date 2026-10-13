import {test,expect} from './studio-v3-test.js';
import {keepStructureOpen} from './studio-v3-structure.js';
import {limitToSelection,limitToWholeForm} from './studio-v3-scope.js';
import {keyFor,typography,completion,normalized,gateway,save,diagnostics,retain} from './studio-v3-element-style.js';

test.use({workInSteps:true});
test.setTimeout(120000);
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper = page => page.frameLocator('#preview-frame');
const send = async(page,text) => { await page.locator('#ai-prompt').fill(text); await page.locator('[data-ai-send]').click(); };
const select = async(page,target) => { await paper(page).locator(`[data-v3-id="${target}"]`).first().click(); };
const styles = async(page,target) => paper(page).locator(`[data-v3-id="${target}"]`).evaluateAll(nodes=>nodes.map(node=> {
  const style = getComputedStyle(node); return {fontSize:style.fontSize,fontWeight:style.fontWeight,color:style.color,textAlign:style.textAlign};
}));
const fill = async(page,target,patch) => {
  const form = page.locator(`form[data-form="${target === 'header-title' ? 'block' : 'style'}"]`), prefix = keyFor(target);
  await form.locator(`details:has([name="${prefix}.fontSize"])`).evaluate(node=>node.open = true);
  for (const property of ['fontSize','bold','color','align']) {
    const input = form.locator(`[name="${prefix}.${property}"]`), value = patch[property] === undefined ? '' : String(patch[property]);
    if (['bold','align'].includes(property)) await input.selectOption(value); else await input.fill(value);
  }
  return form.getByRole('button',{name:target === 'header-title' ? 'Apply section' : 'Apply style',exact:true});
};
test.beforeEach(async({page})=> { page.on('dialog',dialog=>dialog.accept()); await keepStructureOpen(page); });

for (const target of ['header-title','page-number']) test(`real ${target} inspector and Pi wire agree on typography, diagnostics, reset and approval`,async({page},info)=> {
  const errors = []; page.on('pageerror',error=>errors.push(error.message));
  const patch = {fontSize:target === 'header-title' ? 20.25 : 9.25,bold:false,color:'#163a5D',align:'center'};
  const reordered = {align:patch.align,color:patch.color,bold:patch.bold,fontSize:patch.fontSize}, increased = {...reordered,fontSize:patch.fontSize+.25};
  await gateway(page,[...completion(target,patch),...completion(target,{}),['apply_operations',typography(target,reordered)],...completion(target,increased)]);
  await page.goto('/studio-v3/'); await ready(page); const before = await save(page,info,'before.printform.json'), inherited = await styles(page,target);
  await select(page,target); const apply = await fill(page,target,{...patch,fontSize:5.99});
  expect(await page.locator(`[name="${keyFor(target)}.fontSize"]`).evaluate(node=>node.checkValidity())).toBe(false);
  await apply.click(); await expect(page.locator('#revision')).toHaveText('r0');
  await fill(page,target,patch); expect(await page.locator(`[name="${keyFor(target)}.fontSize"]`).evaluate(node=>node.checkValidity())).toBe(true);
  await apply.click(); await ready(page); await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  const ui = await save(page,info,'ui.printform.json'), uiObserved = await diagnostics(page,ui.project), uiStyles = await styles(page,target);
  expect(uiObserved.diagnostics.ready).toBe(true); expect(ui.project.sampleData).toEqual(before.project.sampleData);
  const expected = normalized(before.project); expected.manifest.studioV3[keyFor(target)] = patch; expect(normalized(ui.project)).toEqual(expected);
  for (const style of uiStyles) { expect(style).toMatchObject({fontWeight:'400',color:'rgb(22, 58, 93)',textAlign:'center'}); expect(parseFloat(style.fontSize)).toBeCloseTo(patch.fontSize*4/3,2); }
  expect(uiStyles).not.toEqual(inherited);
  await page.locator('[data-action=undo]').click(); await ready(page); await expect(page.locator('#revision')).toHaveText(/^r2\b/);
  await select(page,target); await page.locator('[data-ai-toggle]').click(); await limitToSelection(page);
  await send(page,`Set the selected typography to ${patch.fontSize}pt normal, #163a5D, centered.`);
  await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:60000}); await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('#revision')).toHaveText(/^r2\b/); await expect(page.locator('.ai-diff')).toContainText('typography');
  const piObserved = await diagnostics(page,ui.project); expect(piObserved.diagnostics).toEqual(uiObserved.diagnostics);
  const wire = await page.evaluate(()=>window.__elementStyleWire); expect(wire).toHaveLength(3);
  const {observation,...numeric} = JSON.parse(wire[2].input.find(item=>item.type === 'function_call_output' && item.call_id === 'element_style_2').output);
  expect(numeric).toEqual(uiObserved.diagnostics); expect(observation).toMatchObject({baseRevision:2,candidateVersion:1});
  await page.locator('[data-ai=apply]').click(); await ready(page); await expect(page.locator('#revision')).toHaveText(/^r3\b/);
  const pi = await save(page,info,'pi.printform.json'); expect(normalized(pi.project)).toEqual(normalized(ui.project)); expect(await styles(page,target)).toEqual(uiStyles);
  await send(page,'Clear the selected typography override.'); await expect(page.locator('[data-ai-proposal]')).toBeVisible(); await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('#revision')).toHaveText('r3'); await page.locator('[data-ai=apply]').click(); await ready(page);
  const cleared = await save(page,info,'cleared.printform.json'); expect(normalized(cleared.project)).toEqual(normalized(before.project)); expect(await styles(page,target)).toEqual(inherited);
  await page.locator('[data-ai=undo]').click(); await ready(page); const undone = await save(page,info,'undone.printform.json'); expect(normalized(undone.project)).toEqual(normalized(ui.project));
  await send(page,'Increase selected typography by 0.25pt.'); await expect(page.locator('[data-ai-proposal]')).toBeVisible(); await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('#revision')).toHaveText(/^r5\b/);
  const noOpWire = await page.evaluate(()=>window.__elementStyleWire); expect(noOpWire).toHaveLength(10);
  expect(noOpWire[7].input.find(item=>item.type === 'function_call_output' && item.call_id === 'element_style_7').output).toContain('NO_CHANGES');
  const fresh = JSON.parse(noOpWire[9].input.find(item=>item.type === 'function_call_output' && item.call_id === 'element_style_9').output);
  expect(fresh.observation).toMatchObject({baseRevision:5,candidateVersion:1}); expect(fresh.observation.id).not.toBe(observation.id);
  await page.locator('[data-ai=apply]').click(); await ready(page); const noOpRecovery = await save(page,info,'no-op-recovery.printform.json');
  const expectedRecovery = normalized(ui.project); expectedRecovery.manifest.studioV3[keyFor(target)] = increased;
  expect(normalized(noOpRecovery.project)).toEqual(expectedRecovery);
  for (const style of await styles(page,target)) expect(parseFloat(style.fontSize)).toBeCloseTo(increased.fontSize*4/3,2);
  // The inspector clear also reaches the same inherited candidate through its own commit boundary.
  await page.locator('[data-ai=close]').click();
  await select(page,target); const reset = await fill(page,target,{}); await reset.click(); await ready(page);
  const uiCleared = await save(page,info,'ui-cleared.printform.json'); expect(normalized(uiCleared.project)).toEqual(normalized(cleared.project)); expect(await styles(page,target)).toEqual(inherited);
  expect(errors).toEqual([]); await retain(page,info,{target,uiObserved,piObserved,ui:ui.project,pi:pi.project,cleared:cleared.project,uiCleared:uiCleared.project,noOpRecovery:noOpRecovery.project});
});

test('real Pi schema and cross-target scope reject typography before fresh heading recovery',async({page},info)=> {
  const patch = {fontSize:20,bold:false};
  await gateway(page,[['apply_operations',typography('header-title',{fontSize:5.99})],['apply_operations',typography('header-title',patch)],['report_blocked',{reason:'The selected column cannot change heading typography.'}],...completion('header-title',patch)]);
  await page.goto('/studio-v3/'); await ready(page); const before = await save(page,info,'rejection-before.printform.json');
  await page.locator('#left-panel [data-select=items-description]').click(); await page.locator('[data-ai-toggle]').click(); await limitToSelection(page);
  await send(page,'Set heading typography to 20pt normal.'); await expect(page.locator('.ai-message').filter({hasText:'The assistant could not meet this request'})).toBeVisible({timeout:60000});
  await expect(page.locator('[data-ai-proposal]')).toBeHidden(); await expect(page.locator('#revision')).toHaveText('r0');
  const rejected = await save(page,info,'rejected.printform.json'); expect(rejected.project).toEqual(before.project);
  const wire = await page.evaluate(()=>window.__elementStyleWire);
  expect(wire[1].input.find(item=>item.type === 'function_call_output' && item.call_id === 'element_style_1').output).toContain('AGENT_ARGUMENTS_INVALID');
  expect(wire[2].input.find(item=>item.type === 'function_call_output' && item.call_id === 'element_style_2').output).toContain('UNSAFE_SCOPE');
  await limitToWholeForm(page); await select(page,'header-title'); await limitToSelection(page);
  await send(page,'Set heading typography to 20pt normal.'); await expect(page.locator('[data-ai-proposal]')).toBeVisible(); await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('#revision')).toHaveText('r0'); await page.locator('[data-ai=apply]').click(); await ready(page);
  const recovered = await save(page,info,'recovered.printform.json'); expect(recovered.project.manifest.studioV3.titleStyle).toEqual(patch); expect(recovered.project.sampleData).toEqual(before.project.sampleData);
  await retain(page,info,{before:before.project,rejected:rejected.project,recovered:recovered.project});
});

test('real inspector and Pi inspection both block low-contrast typography and recover with fresh evidence',async({page},info)=> {
  const target = 'header-title', bad = {fontSize:20,bold:false,color:'#12aBcD',align:'center'}, good = {...bad,color:'#163a5D'};
  await gateway(page,[['apply_operations',typography(target,bad)],['inspect_draft'],['finish',{summary:'Blocked typography'}],['undo_step'],...completion(target,good)]);
  await page.goto('/studio-v3/'); await ready(page); const before = await save(page,info,'contrast-before.printform.json');
  await select(page,target); const apply = await fill(page,target,bad); await apply.click(); await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  await expect.poll(()=>page.evaluate(()=>window.__elementStyleReports.at(-1)?.status)).toBe('blocked');
  const ui = await save(page,info,'contrast-ui.printform.json'), rejectedDiagnostics = await diagnostics(page,ui.project);
  expect(rejectedDiagnostics.diagnostics.ready).toBe(false); expect(rejectedDiagnostics.diagnostics.errors).toContain('CONTRAST_FAILURE');
  await expect(page.locator('[data-action=export]')).toBeDisabled();
  await page.locator('[data-action=undo]').click(); await ready(page); await expect(page.locator('#revision')).toHaveText(/^r2\b/);
  await select(page,target); const recover = await fill(page,target,good); await recover.click(); await ready(page);
  const uiRecovery = await save(page,info,'contrast-ui-recovery.printform.json'), recoveryDiagnostics = await diagnostics(page,uiRecovery.project);
  expect(recoveryDiagnostics.diagnostics.ready).toBe(true);
  await page.locator('[data-action=undo]').click(); await ready(page); await expect(page.locator('#revision')).toHaveText(/^r4\b/);
  await select(page,target); await page.locator('[data-ai-toggle]').click(); await limitToSelection(page);
  await send(page,'Set the selected heading to centered 20pt normal with a readable dark color.');
  await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:60000}); await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('#revision')).toHaveText(/^r4\b/);
  const wire = await page.evaluate(()=>window.__elementStyleWire); expect(wire).toHaveLength(7);
  const rawOutput = id => wire.flatMap(body=>body.input).find(item=>item.type === 'function_call_output' && item.call_id === id).output;
  const output = id => JSON.parse(rawOutput(id));
  const {observation:badReceipt,...badNumeric} = output('element_style_2'); expect(badNumeric).toEqual(rejectedDiagnostics.diagnostics);
  expect(rawOutput('element_style_3')).toContain('AGENT_INSPECTION_BLOCKED');
  const {observation:goodReceipt,...goodNumeric} = output('element_style_6'); expect(goodNumeric).toEqual(recoveryDiagnostics.diagnostics);
  expect(badReceipt).toMatchObject({baseRevision:4,candidateVersion:1}); expect(goodReceipt).toMatchObject({baseRevision:4,candidateVersion:3}); expect(goodReceipt.id).not.toBe(badReceipt.id);
  await page.locator('[data-ai=apply]').click(); await ready(page); const recovered = await save(page,info,'contrast-pi-recovered.printform.json');
  expect(normalized(recovered.project)).toEqual(normalized(uiRecovery.project)); expect(recovered.project.sampleData).toEqual(before.project.sampleData);
  await retain(page,info,{target,before:before.project,ui:ui.project,uiRecovery:uiRecovery.project,recovered:recovered.project,rejectedDiagnostics,recoveryDiagnostics,badReceipt,goodReceipt});
});
