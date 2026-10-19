// Synthetic source fixtures through the existing Studio compiler/export path.
import {newProject, designOf, compileProject} from '../studio-v3/model.js';

export const insets = {top:7,right:11,bottom:19,left:23}; // CSS px, not millimeters.
export const headers = ['Source identity','Continuation text','Supplied amount'];
const field = (id,label,pointer,width) => ({id,label,pointer,format:'',width});
function base(size,orientation) {
  const project = newProject('invoice',true), design = designOf(project);
  project.manifest.title = 'Fictional digital pagination investigation';
  design.title = 'DIGITAL'; design.pageNumbers = false;
  design.logo = null;
  design.page = {paper:'CUSTOM',customSizeMm:size,orientation,margins:insets};
  design.padding = 3;
  return {project,design};
}
function table(orientation,atomic=false) {
  const {project,design} = base({width:140,height:180},orientation);
  design.blocks.items.enabled = true;
  design.columns = [field('identity',headers[0],'./identity',24),field('description',headers[1],'./description',48),field('amount',headers[2],'./amount',28)];
  const rows = [
    {identity:'SOURCE-00007',description:Array.from({length:180},(_,i)=>`LINE-${String(i).padStart(4,'0')}`).join(' '),amount:'MYR 00002.500'},
    {identity:'SOURCE-00008',description:'AFTER-LONG-ROW exact supplied text',amount:'MYR 00000.010'},
    {identity:'SOURCE-00009',description:'FINAL-ROW source order sentinel',amount:'MYR 90000.001'}
  ];
  project.sampleData = {items:rows};
  const compiled = compileProject(project,design);
  // Existing imported-template cell policies, not a different renderer.
  const doc = new DOMParser().parseFromString(compiled.templateHtml,'text/html');
  const row = doc.querySelector('.prowitem');
  for (const index of [0,2]) row.querySelectorAll('td')[index].dataset.pfCellPolicy = 'first';
  if (atomic) row.dataset.pfKeepTogether = 'true';
  compiled.templateHtml = doc.body.innerHTML;
  return {id:atomic?'atomic-row-blocked':`long-table-${orientation}`,project:compiled,rows,orientation,
    sizeMm:orientation==='portrait'?{width:140,height:180}:{width:180,height:140},blocked:atomic};
}
function label(format,oversize=false) {
  const landscape = format==='EAN13', orientation = landscape?'landscape':'portrait';
  const size = landscape?{width:45,height:80}:{width:45,height:62};
  const {project,design} = base(size,orientation);
  const value = landscape?'0001234567895':'00001234', moduleWidth = oversize?4:landscape?2:1;
  design.blocks.header.enabled = true;
  design.header = [{id:'barcode',label:'Supplied symbol',kind:'barcode',pointer:'/code',showLabel:false,
    barcode:{format,moduleWidth,height:24,displayValue:true}}];
  project.sampleData = {code:value};
  return {id:oversize?'atomic-label-blocked':`label-${format}`,project:compileProject(project,design),
    code:{format,value,moduleWidth},orientation,sizeMm:landscape?{width:80,height:45}:size,blocked:oversize};
}
export function printInvestigationFixtures() {
  return [table('portrait'),table('landscape'),label('CODE128'),label('EAN13'),table('portrait',true),label('EAN13',true)];
}
