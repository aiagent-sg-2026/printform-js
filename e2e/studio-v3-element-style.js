import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {validatePaperReport,inspectProject} from '../studio-v3/validation.js';
import {safeRunDiagnostics} from '../studio-v3/ai-inspection.js';
import {compileProject} from '../studio-v3/model.js';
import {createEmptyProject} from '../studio-v2/core/project-model.js';

globalThis.DOMParser ??= new JSDOM('').window.DOMParser;
export const keyFor = target => target === 'header-title' ? 'titleStyle' : 'pageNumberStyle';
export const typography = (target,patch) => ({summary:'Element typography',operations:[{type:'set_element_style',target,patch}]});
export const completion = (target,patch) => [['apply_operations',typography(target,patch)],['inspect_draft'],['finish',{summary:'Element typography'}]];
export const normalized = project => {
  const design = structuredClone(project.manifest.studioV3);
  design.page = {paper:design.page?.paper || 'A4',orientation:design.page?.orientation || 'portrait',margins:{top:0,right:0,bottom:0,left:0,...design.page?.margins}};
  design.blocks.header.keepTogether ??= false;
  const {revision,...content} = project;
  return {...content,manifest:{...project.manifest,studioV3:design}};
};
export async function gateway(page,steps) {
  await page.addInitScript(steps=> {
    const original = window.fetch.bind(window), json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    let turn = 0; window.__elementStyleWire = []; window.__elementStyleReports = [];
    window.addEventListener('message',event=> {
      if (event.source === document.querySelector('#preview-frame')?.contentWindow && event.data?.source === 'printform-studio-v3-preview' && event.data.type === 'rendered') window.__elementStyleReports.push(event.data.payload.report);
    });
    window.fetch = async(input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body = JSON.parse(init.body); window.__elementStyleWire.push(body);
      const [name,args={}] = steps[turn++], output = [{type:'function_call',call_id:`element_style_${turn}`,name,arguments:JSON.stringify(args)}];
      const response = {status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },steps);
}
export async function save(page,info,name) {
  const revision = await page.locator('#revision').innerText(), pending = page.waitForEvent('download');
  await page.locator('[data-action=save]').click(); const download = await pending, path = info.outputPath(name);
  await download.saveAs(path);
  if ((await page.locator('#revision').innerText()).split(' ·')[0] !== revision.split(' ·')[0]) throw new Error('Save changed the revision.');
  return {path,project:JSON.parse(await fs.readFile(path,'utf8')).project};
}
export async function diagnostics(page,project) {
  const rendered = await page.evaluate(()=>window.__elementStyleReports.at(-1));
  // The save format excludes the compiled template/theme and schema.
  const candidate = compileProject({...createEmptyProject(),...project,schema:{type:'object',additionalProperties:true}},project.manifest.studioV3);
  const report = validatePaperReport(rendered,candidate);
  return {report,diagnostics:safeRunDiagnostics({report,quality:inspectProject(candidate,report)},candidate)};
}
export async function retain(page,info,evidence) {
  const wire = await page.evaluate(()=>window.__elementStyleWire), path = info.outputPath('element-style-parity.json');
  await fs.writeFile(path,JSON.stringify({browser:info.project.name,wire,...evidence},null,2));
  await info.attach('element-style-parity',{path,contentType:'application/json'});
}
