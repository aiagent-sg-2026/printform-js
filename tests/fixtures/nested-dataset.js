import { compileProject, defaultDesign, newProject } from '../../studio-v3/model.js';

export function nestedDatasetFixture(empty=false) {
  const row = { 'line/id':'00007', 'amount~raw':'-001.250', currency:'USD', extra:{retained:'未知字段'} };
  const allocation = {type:'object',required:['line/id','amount~raw','currency'],additionalProperties:true,properties:{
    'line/id':{type:'string',minLength:1},'amount~raw':{type:'string'},currency:{type:'string',const:'USD'}
  }};
  const collection = {type:'array',maxItems:500,items:allocation};
  const data = {document:{id:'DOC-0001',currency:'USD'},items:[],
    parentDocuments:[{id:'P-0001',allocations:empty ? [] : [structuredClone(row)]},{id:'P-0002',allocations:[{...row,'line/id':'OTHER-PARENT','amount~raw':'999.000'}]}],
    allocations:empty ? [] : [structuredClone(row)],'a/b~c':[],custom:{toString:'保留',amount:'000.0100'}};
  const schema = {type:'object',required:['document','items','parentDocuments','allocations','a/b~c'],additionalProperties:true,properties:{
    document:{type:'object',required:['id','currency'],properties:{id:{type:'string',const:'DOC-0001'},currency:{type:'string',const:'USD'}}},
    items:{type:'array',maxItems:500,items:{type:'object'}},allocations:collection,'a/b~c':collection,
    parentDocuments:{type:'array',items:{type:'object',required:['id','allocations'],properties:{id:{type:'string'},allocations:collection}}}
  }};
  const sourceSchema = {sourceId:'fictional-erp',datasetId:'nested-dataset',version:'2026-10-15.1',schema};
  const design = defaultDesign(); design.collection = '/allocations';
  design.columns = [{id:'identity',label:'Line identity',pointer:'./line~1id',format:'',width:35},{id:'exact',label:'Exact amount',pointer:'./amount~0raw',format:'',width:45},{id:'currency',label:'Currency',pointer:'./currency',format:'',width:20}];
  for (const block of ['header','customer','totals','footer']) design.blocks[block].enabled = false;
  const project = newProject(); project.sampleData = data; project.schema = schema;
  project.manifest.datasetSchema = {sourceId:sourceSchema.sourceId,datasetId:sourceSchema.datasetId,version:sourceSchema.version};
  project.manifest.title = 'Nested dataset contract'; project.manifest.currency = 'USD';
  return {data,schema,sourceSchema,project:compileProject(project,design),record:{id:sourceSchema.datasetId,type:'invoice',title:'Nested allocations',revision:1,data,sourceSchema,origin:'imported-data'}};
}
