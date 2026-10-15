import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {readEventStream} from '../studio-v3/ai-response-reader.js';
import {responsesResult} from '../studio-v3/ai-responses-wire.js';

// The event order, field names and proposal text come from a real Demo gateway answer to a typography request
// (fictional demo data only). Response ids and the encrypted reasoning blob are replaced by placeholders.
const text = JSON.parse(fs.readFileSync('tests/fixtures/real-gateway-typography-proposal.json','utf8'));
const frame = (type,body) => `event: ${type}\ndata: ${JSON.stringify({type,...body})}\n\n`;
const reasoning = {id:'rs_placeholder',type:'reasoning',content:[],encrypted_content:'placeholder',summary:[]};
const message = {id:'msg_placeholder',type:'message',status:'completed',content:[{type:'output_text',annotations:[],logprobs:[],text}],phase:'final_answer',role:'assistant'};
function realStream() {
  const response = {id:'resp_placeholder',object:'response',model:'demo-auto',status:'in_progress',output:[]};
  return frame('response.created',{response})+frame('response.in_progress',{response})
    + frame('response.output_item.added',{item:reasoning,output_index:0})+frame('response.output_item.done',{item:reasoning,output_index:0})
    + frame('response.output_item.added',{item:{...message,status:'in_progress',content:[]},output_index:1})
    + frame('response.content_part.added',{part:{type:'output_text',text:''},output_index:1})
    + text.match(/.{1,40}/gs).map(delta=>frame('response.output_text.delta',{delta,output_index:1})).join('')
    + frame('response.output_text.done',{text,output_index:1})+frame('response.output_item.done',{item:message,output_index:1})
    + frame('response.completed',{response:{...response,status:'completed',output:[reasoning,message],usage:{input_tokens:6417,output_tokens:702,total_tokens:7119}}});
}
describe('a real gateway answer to the typography starter',()=> {
  it('is read to completion, with progress from the answer text, and yields the proposal text and usage',async()=> {
    let chars = 0;
    const completed = await readEventStream(new Response(realStream()).body.getReader(),new AbortController().signal,{addChars:count=>{chars += count;}});
    const result = responsesResult(completed);
    expect(result.text).toBe(text); expect(chars).toBe(text.length);
    expect(result.usage).toEqual({prompt_tokens:6417,completion_tokens:702,total_tokens:7119});
  });
});
