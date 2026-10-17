import { newProject, designOf, compileProject } from '../../studio-v3/model.js';

const text = {type:'string',minLength:1};
const field = (id,label,pointer) => ({id,label,pointer,format:''});
export function generalImportProject(collection=true) {
  const project = newProject('invoice',true), design = designOf(project);
  project.manifest.title = collection ? 'Fictional workshop record form' : 'Fictional work order without table';
  project.sampleData = {workOrder:{number:'WO-FICTION-0001',instruction:'Supplied fictional work instruction',status:'Source draft'},media:{token:'MEDIA-001'}};
  const properties = {
    workOrder:{type:'object',required:['number','instruction','status'],additionalProperties:false,properties:{number:text,instruction:text,status:{type:'string',const:'Source draft'}}},
    media:{type:'object',required:['token'],additionalProperties:false,properties:{token:text}}
  };
  design.blocks.header.enabled = true; design.header = [field('work-order','Work order','/workOrder/number'),field('source-status','Supplied status','/workOrder/status')];
  design.blocks.footer.enabled = true; design.footer = [field('instruction','Work instruction','/workOrder/instruction'),field('token','Source token','/media/token')];
  design.logo = null; design.repeatHeader = false;
  if (collection) {
    project.sampleData.records = [{code:'OLD-0001',quantity:'0002.500',uom:'kg'}];
    properties.records = {type:'array',maxItems:500,items:{type:'object',required:['code','quantity','uom'],additionalProperties:false,properties:{code:text,quantity:{type:'string',pattern:'^-?\\d+(\\.\\d+)?$'},uom:text}}};
    design.blocks.items.enabled = true; design.collection = '/records';
    design.columns = [{...field('code','Workshop code','./code'),width:40},{...field('quantity','Exact supplied quantity','./quantity'),width:35},{...field('uom','Supplied UOM','./uom'),width:25}];
  }
  project.schema = {type:'object',required:Object.keys(properties),additionalProperties:false,properties};
  project.manifest.datasetSchema = {sourceId:'fictional-workshop-schema',datasetId:collection ? 'fictional-records' : 'fictional-work-order',version:'2026-10-17.1'};
  return compileProject(project,design);
}
