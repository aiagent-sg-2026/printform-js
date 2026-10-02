import { newProject, sampleData, designOf, compileProject } from './model.js';
export function compactA5Record() {
  const data=sampleData('invoice',45);
  data.document={...data.document,id:'demo:CompactA5Invoice:45',kind:'CompactA5Invoice',number:'INV-DEMO-A5-0045',currency:'MYR'};
  data.summary.currency='MYR';data.demo={fictional:true,scenario:'compact-a5-45',purpose:'Explicit compact A5 layout fixture; 45 supplied rows and financial values are preserved.'};
  return {id:data.document.id,type:'invoice',title:'Compact A5 invoice · 45 fictional rows',origin:'builtin-demo',data};
}
export function newCompactA5Project() {
  const project=newProject('invoice'),record=compactA5Record(),design=designOf(project);
  project.manifest.title='Compact A5 invoice template';project.manifest.sampleDataTitle=record.title;project.sampleData=record.data;
  // This is a separate chosen preset, never an automatic transformation of a user form.
  design.page={paper:'A5',orientation:'landscape',margins:{top:12,right:12,bottom:12,left:12}};
  design.font=9;design.padding=3;design.titleStyle={fontSize:14};design.repeatHeader=false;design.repeatTable=true;
  const firstPageDetails=design.header.filter(field=>!['company','number','date'].includes(field.id));
  design.header=design.header.filter(field=>['company','number','date'].includes(field.id));
  design.customer.push(...firstPageDetails.map(field=>({...field,id:`issuer-${field.id}`})));
  design.blocks.header.layout={columns:2,gap:4};design.blocks.customer.layout={columns:4,gap:6};
  design.blocks.footer.layout={columns:2,gap:6};
  return compileProject(project,design);
}
