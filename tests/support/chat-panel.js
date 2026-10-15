import fs from 'node:fs';
import {AIPanel} from '../../studio-v3/ai-panel.js';
import {createDemoTransport} from '../../studio-v3/ai-demo-transport.js';
import {newProject} from '../../studio-v3/model.js';
import {createBus} from '../../studio-v3/controller.js';
// Shared by the chat panel tests: the real index.html shell plus a ready AIPanel.
export const html=fs.readFileSync('studio-v3/index.html','utf8');
export function setup({facts=()=>[],commit,plan,transport,restore=async()=>{},reply={kind:'proposal',summary:'Navy',edits:[{target:'style',property:'color',value:'#163a65'}]}}={}) {
  let bus=createBus(newProject()),calls=0,selected='items';
  const panel=new AIPanel({bus:()=>bus,selection:()=>selected,facts,guard:work=>work(),preview:async()=>({status:'ready',validation:{errors:[],warnings:[]}}),restore,commit,sync:()=>{},transport:transport || {clear:()=>{},clearSession:()=>{},discover:async()=>['demo-fast'],plan:async(...args)=> {calls++;return plan ? plan(...args) : {text:JSON.stringify(reply)};}}});
  panel.contextChanged();panel.node('#ai-prompt').value='Use navy accents.';panel.share();
  return {panel,calls:()=>calls,changeBus:()=> {bus=createBus(newProject());panel.contextChanged();return bus;},select:id=> {selected=id;panel.contextChanged();}};
}
export function visualPanel(kind='image') {
 const calls=[],state={enabled:true,status:200};
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 const transport=createDemoTransport({fetchImpl:async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/session'))return json({token:'dmo_synthetic123'});
  if(url.endsWith('/models')){if(state.hold)await state.hold;return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:state.enabled}}]},state.status);}
  return json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({kind:'answer',message:'Fictional reference reviewed.'})}]}]});
 }});
 const {panel}=setup({transport});
 panel.referenceFiles.files=[{id:'reference-visual',name:kind==='image'?'fictional.png':'fictional.pdf',kind,mime:kind==='image'?'image/png':'application/pdf',processing:'visual',pageCount:1,text:'',pages:[{number:1,width:10,height:10,text:'',textItems:[],preview:{dataUrl:'data:image/jpeg;base64,/9j/2Q=='}}],warnings:[]}];
 panel.referenceFiles.root.open=true;panel.referenceFiles.changed();
 return {panel,transport,calls,state};
}
