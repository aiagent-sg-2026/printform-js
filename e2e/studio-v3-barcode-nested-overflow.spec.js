import {test,expect} from './studio-v3-test.js';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {standaloneHtml} from './studio-v3-rendered-probes.js';

const CODE='BARCODE_CONTENT_OVERFLOW';
const render=(page,media)=>page.emulateMedia({media}).then(()=>page.evaluate(()=>window.PrintFormDocument.render()));
async function specimen(page,context,info,kind) {
  const project=newProject('invoice',kind==='field'), design=designOf(project);
  const barcode={format:'CODE128',moduleWidth:2,height:48,displayValue:true};
  let target;
  if (kind==='cell') {
    project.sampleData.items=project.sampleData.items.slice(0,1);
    Object.assign(design.columns.find(column=>column.id==='sku'),{kind:'barcode',format:'',text:'',barcode});
    target='items-sku';
  } else {
    project.sampleData={code:'ASM-0001'}; design.blocks.footer.enabled=true;
    design.footer=[{id:'code',kind:'barcode',label:'',showLabel:false,pointer:'/code',format:'',text:'',barcode}];
    target='footer-code';
  }
  const compiled=compileProject(project,design);
  const template=new DOMParser().parseFromString('<template id="nested-fixture"></template>','text/html').getElementById('nested-fixture');
  template.innerHTML=compiled.templateHtml;
  const value=template.content.querySelector(`[data-v3-id="${target}"]`);
  if (kind==='field') value.closest('.field').classList.add('outer-allocation');
  const inner=template.ownerDocument.createElement('div'); inner.className='field nested-allocation';
  value.replaceWith(inner); inner.append(value); compiled.templateHtml=template.innerHTML;
  compiled.themeCss+='\n#pf-mount .nested-allocation {width:600px;margin:0;padding:0;border:0;}\n#pf-mount .outer-allocation {width:120px;}';
  const html=await standaloneHtml(page,compiled);
  const file=info.outputPath(`nested-${kind}.html`); await writeFile(file,html);
  const offline=await context.newPage(); await offline.route(/^https?:/,route=>route.abort());
  await offline.goto(pathToFileURL(file).href);
  await expect(offline.locator('html')).toHaveAttribute('data-printform-status',/ready|blocked/);
  return offline;
}
async function bounds(page,target) {
  return page.locator(`[data-v3-id="${target}"] [data-pf-barcode-svg]`).evaluate(svg=> {
    const rect=node=>{const r=node.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right};};
    const containers=[];
    for(let node=svg.parentElement;node&&!node.classList.contains('printform_page');node=node.parentElement) {
      if(node.matches('td,th,.field')) containers.push({tag:node.tagName,classes:node.className,...rect(node)});
    }
    return {markup:svg.outerHTML,svg:rect(svg),containers,page:rect(svg.closest('.printform_page'))};
  });
}
for (const kind of ['cell','field']) test(`expanded inner field cannot bypass outer ${kind} barcode allocation`,async({page,context},info)=> {
  await page.goto('/studio-v3/');
  await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
  const offline=await specimen(page,context,info,kind), target=kind==='cell'?'items-sku':'footer-code';
  const original=await bounds(offline,target);
  expect(original.containers[0].width).toBe(600);
  expect(original.svg.width).toBeLessThan(original.containers[0].width);
  expect(original.svg.right).toBeLessThan(original.page.right);
  for (const media of ['screen','print']) {
    const report=await render(offline,media), issues=report.issues.filter(issue=>issue.code===CODE);
    expect(report.status).toBe('blocked'); expect(report.metrics.barcodeContentOverflows).toBe(1);
    expect(issues).toHaveLength(1); expect(issues[0].component_id).toBe(target);
    expect(issues[0].available_size.width).toBeLessThan(issues[0].measured_size.width);
    expect(issues[0].container_selector).toContain(kind==='cell'?'td:nth-of-type(2)':'div:nth-of-type(1)');
    expect(report.validation.errors.some(issue=>issue.code==='HORIZONTAL_OVERFLOW')).toBe(false);
    expect((await bounds(offline,target)).markup).toBe(original.markup);
    await info.attach(`nested-${kind}-${media}.json`,{body:JSON.stringify(report),contentType:'application/json'});
  }
  // Real CSS allocation changes only; no monkeypatched DOM geometry, scaling or source edits.
  await offline.locator('#pf-theme').evaluate((node,kind)=> {
    node.textContent+=kind==='cell'
      ? '\n#pf-mount .v3-grid th:nth-of-type(2),#pf-mount .v3-grid td:nth-of-type(2){width:45%!important;}\n#pf-mount .v3-grid th:nth-of-type(3),#pf-mount .v3-grid td:nth-of-type(3){width:7%!important;}'
      : '\n#pf-mount .outer-allocation {width:400px;}';
  },kind);
  const fit=await render(offline,'print'); expect(fit.status).toBe('ready');
  expect(fit.metrics.barcodeContentOverflows).toBe(0);
  expect((await bounds(offline,target)).markup).toBe(original.markup);
  if (kind==='field') {
    // Multiple failing ancestors still count this symbol once, not once per box.
    await offline.locator('#pf-theme').evaluate(node=> {node.textContent+='\n#pf-mount .nested-allocation {width:100px;}\n#pf-mount .outer-allocation {width:80px;}';});
    const multiple=await render(offline,'screen'); expect(multiple.status).toBe('blocked');
    expect(multiple.metrics.barcodeContentOverflows).toBe(1);
    expect(multiple.issues.filter(issue=>issue.code===CODE)).toHaveLength(1);
    expect((await bounds(offline,target)).markup).toBe(original.markup);
  }
  await offline.close();
});
