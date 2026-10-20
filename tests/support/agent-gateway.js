import {createDemoTransport} from '../../studio-v3/ai-demo-transport.js';
// A scripted Demo gateway. Requests that carry tools take the next "agent" answer, the others the next "single" one.
export const json = (body,status = 200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
export const stream = events => new Response(events.map(event=>`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),{status:200,headers:{'content-type':'text/event-stream'}});
export const reasoning = n => ({id:`rs_${n}`,type:'reasoning',content:[],encrypted_content:`enc-${n}`,summary:[]});
export const fn = (n,name,args) => ({id:`fc_${n}`,type:'function_call',status:'completed',call_id:`call_${n}`,name,arguments:JSON.stringify(args)});
export const turn = (output,tokens = 10) => stream([{type:'response.created',response:{status:'in_progress',output:[]}},{type:'response.completed',response:{status:'completed',output,usage:{input_tokens:tokens,output_tokens:2,total_tokens:tokens + 2}}}]);
export const plain = text => json({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:3,output_tokens:4,total_tokens:7}});
export const message = text => ({id:'msg_1',type:'message',status:'completed',content:[{type:'output_text',text}],phase:'final_answer',role:'assistant'});
export const colour = value => ({type:'set_style',patch:{color:value}});
// Outside the auto-apply allowlist (heading text), so the person still reviews and applies it.
export const heading = value => ({type:'set_heading',value});
export function scriptedGateway({agent = [],single = [],multimodal = false} = {}) {
  const bodies = [], transport = createDemoTransport({fetchImpl:async(url,init)=> {
    if (url.endsWith('/session')) return json({token:'dmo_synthetic1',expires_in:900},201);
    if (url.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal}}]});
    const body = JSON.parse(init.body); bodies.push(body);
    const answer = (body.tools ? agent : single).shift();
    return typeof answer === 'function' ? answer(init,body) : answer;
  }});
  return {transport,bodies,agentCalls:()=>bodies.filter(body=>body.tools).length,singleCalls:()=>bodies.filter(body=>!body.tools).length};
}
// The four turns of a plain successful run.
export const successfulRun = (operation = heading('Tax Invoice')) => [
  turn([reasoning(1),fn(1,'get_context',{})]),
  turn([reasoning(2),fn(2,'apply_operations',{summary:'Navy accents',operations:[operation]})]),
  turn([reasoning(3),fn(3,'inspect_draft',{})]),
  turn([reasoning(4),fn(4,'finish',{summary:'Navy accents'})])
];
