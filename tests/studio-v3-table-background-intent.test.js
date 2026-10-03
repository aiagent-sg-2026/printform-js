import {describe,it,expect} from 'vitest';
import {newProject} from '../studio-v3/model.js';
import {parseChatReply} from '../studio-v3/ai-chat-protocol.js';
import {runLayoutHarness} from '../studio-v3/ai-harness.js';
import {tableBackgroundIntents} from '../studio-v3/table-background-intent.js';
const reply=operations=>JSON.stringify({kind:'proposal',summary:'Changed the table data row backgrounds to yellow',operations});
const fill=color=>({type:'set_table_style',target:'items',patch:{rowBackground:color}});
const padding={type:'set_style',patch:{padding:12}};
const request='row data table bg style use yellow';
const parse=(operations,text=request,project=newProject())=>parseChatReply(reply(operations),project,{request:text});
describe('table fill semantic acceptance',()=>{
  it.each([
    [request,[padding]],
    [request,[fill('#0000ff')]],
    ['Make every data row yellow.',[{type:'set_style',patch:{color:'#ffff00'}}]],
    ['Make table row background yellow',[{type:'set_style',patch:{striped:false}}]],
    ['把数据行改成黄色',[fill('#0000ff')]],
    ['Use #fF0 for the table background',[fill('#0000ff')]],
    ['Change table row background',[padding]],
    ['Make the table background pale yellow',[padding]]
  ])('rejects unmet final body fill for %s',(text,operations)=>{
    expect(()=>parse(operations,text)).toThrow('TABLE_BACKGROUND_INTENT');
  });
  it.each(['Make every data row yellow.','把数据行改成黄色','表格背景改成黃色','Use #fF0 for the table background',request])('accepts correct body fill for %s',text=>{
    expect(parse([fill('#FFFF00')],text).design.tableStyle.rowBackground).toBe('#FFFF00');
  });
  it('compares final state, allowing an already-satisfied fill with other requested edits',()=>{
    const project=parse([fill('#ffff00')]).candidate;
    expect(parse([padding],'Keep data rows yellow and increase padding',project).design.padding).toBe(12);
    expect(()=>parse([fill('#0000ff'),padding],'Keep data rows yellow and increase padding',project)).toThrow('TABLE_BACKGROUND_INTENT');
  });
  it('checks explicit clearing and does not force a new fill',()=>{
    const project=parse([fill('#ffff00')]).candidate;
    expect(()=>parse([padding],'Clear table background',project)).toThrow('TABLE_BACKGROUND_INTENT');
    expect(parse([fill(null)],'Clear table background',project).design.tableStyle).toBeUndefined();
    expect(parse([padding],'Restore default table background',newProject()).design.padding).toBe(12);
  });
  it('uses row-color clauses rather than unrelated accent or text colors',()=>{
    expect(parse([fill('#ffff00')],'Use blue accents and make table rows yellow').kind).toBe('proposal');
    expect(parse([fill('#ffff00')],'Make row background yellow with black text').kind).toBe('proposal');
    expect(()=>parse([fill('#0000ff')],'Make row background yellow with black text')).toThrow('TABLE_BACKGROUND_INTENT');
  });
  it.each(['Use yellow brand accents','Make table row text yellow','Make table header yellow','Make table borders yellow'])('does not reinterpret other element colors: %s',text=>{
    expect(tableBackgroundIntents(text)).toEqual([]);
  });
  it('runs repairs for padding-only then wrong-color proposals before a matching body fill',async()=>{
    const responses=[reply([padding]),reply([fill('#0000ff')]),reply([fill('#ffff00')])],sent=[];
    const result=await runLayoutHarness({project:newProject(),alias:'demo-fast',request:'{}',chat:{request},signal:new AbortController().signal,
      transport:{plan:async(_alias,wire)=>{sent.push(wire);return{text:responses[sent.length-1]};}},inspectCandidate:async()=>({ready:true})});
    expect(sent).toHaveLength(3);expect(sent[1]).toContain('TABLE_BACKGROUND_INTENT');expect(sent[2]).toContain('TABLE_BACKGROUND_INTENT');
    expect(result.design.tableStyle.rowBackground).toBe('#ffff00');
  });
});
