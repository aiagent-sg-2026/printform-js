import {it,expect,afterEach} from 'vitest';
import {newDemoProject} from '../studio-v3/demo-templates.js';
import {A4_PRESETS} from '../studio-v3/a4-presets.js';
import {parseChatReply} from '../studio-v3/ai-chat-protocol.js';
import {readProject,saveProject} from '../studio-v3/file-io.js';
import {tableBodyCss} from '../studio-v3/table-style.js';
const reply=JSON.stringify({kind:'proposal',summary:'Yellow table body and one-column company fields',operations:[
  {type:'set_table_style',target:'items',patch:{rowBackground:'#ffff00'}},
  {type:'set_section',target:'header',patch:{layout:{columns:1,gap:10}}}
]});
afterEach(()=>{document.body.innerHTML='';document.head.innerHTML='';});
it.each(A4_PRESETS)('$documentKind preserves preset, editable grid and explicit row fill through save/reopen',preset=>{
 const project=newDemoProject(preset.documentKind),before=structuredClone(project);
 const result=parseChatReply(reply,project,{request:'Make every data row yellow and use a one-column company grid'});
 const opened=readProject(saveProject(result.candidate));
 expect(opened.manifest.studioV3.layoutPreset).toBe(preset.id);
 expect(opened.manifest.studioV3.tableStyle).toEqual({rowBackground:'#ffff00'});
 expect(opened.sampleData).toEqual(before.sampleData);expect(project).toEqual(before);
 const css=opened.themeCss,grid='#pf-mount .v3-header .company-fields {display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:10px;}';
 expect(css.indexOf('--v3-accent:')).toBeLessThan(css.indexOf(grid));expect(css.indexOf(grid)).toBeLessThan(css.indexOf(tableBodyCss(result.design)));
 document.head.innerHTML=`<style>${css}</style>`;document.body.innerHTML=`<div id="pf-mount">${opened.templateHtml}</div>`;
 const body=document.querySelector('[data-v3-id=items]');
 for(const node of [body,...body.querySelectorAll('tr,td')])expect(getComputedStyle(node).backgroundColor).toBe('rgb(255, 255, 0)');
 expect(getComputedStyle(document.querySelector('.company-fields')).gridTemplateColumns).toBe('repeat(1,minmax(0,1fr))');
});
