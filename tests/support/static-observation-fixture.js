import {newProject,compileProject,BLOCKS} from '../../studio-v3/model.js';
export function staticProject() {
  const project=newProject('invoice',true), design=project.manifest.studioV3;
  for (const id of BLOCKS) design.blocks[id].enabled=id==='header' || id==='footer';
  design.title='FICTIONAL PIXEL CANARY'; design.color='#1167bb';
  design.header=[{id:'note',kind:'static',label:'Fictional',text:'STATIC PIXEL OBSERVATION',pointer:'',format:''}];
  design.footer=[{id:'note',kind:'static',label:'Fixture',text:'END OF FICTIONAL FORM',pointer:'',format:''}];
  project.sampleData={items:[]}; return compileProject(project,design);
}
