import {it,expect} from 'vitest';
import {newProject} from '../studio-v3/model.js';
import {parseChatReply} from '../studio-v3/ai-chat-protocol.js';
const reply=color=>JSON.stringify({kind:'proposal',summary:'Requested table fill',operations:[{type:'set_table_style',target:'items',patch:{rowBackground:color}}]});
const parse=(color,request,extra={})=>parseChatReply(reply(color),newProject(),{request,...extra});
it('accepts the destination color when changing table background from blue to yellow',()=>{
 expect(()=>parse('#ffff00','Change the table row background from blue to yellow')).not.toThrow();
});
it('rejects the old color when changing table background from blue to yellow',()=>{
 expect(()=>parse('#0000ff','Change the table row background from blue to yellow')).toThrow('TABLE_BACKGROUND_INTENT');
});
it('uses an explicit hex over the approximate named color red',()=>{
 expect(()=>parse('#a82938','Make the table background red (#a82938)')).not.toThrow();
});
it('enforces a color request made in an element comment when the input is the comments-only default',()=>{
 const project=newProject();
 const refs=[{documentId:project.manifest.documentId,revision:0,id:'items',kind:'section',block:'items',role:'table',comment:'Make table row background yellow'}];
 const padding=JSON.stringify({kind:'proposal',summary:'Yellow table rows',operations:[{type:'set_field',target:'items-description',patch:{valueStyle:{fontSize:12}}}]});
 expect(()=>parseChatReply(padding,project,{request:'Apply the comments on the referenced elements.',references:refs,scope:{mode:'selected',id:'items'}})).toThrow('TABLE_BACKGROUND_INTENT');
});
it.each([
 ['Change the table row background from #0000ff to yellow','#ffff00'],
 ['Change the table row background from blue to red (#a82938)','#a82938'],
 ['Replace the blue table row background with yellow','#ffff00'],
 ['把表格背景从蓝色改成黄色','#ffff00'],
 ['Set default table background to yellow','#ffff00'],
 ['Reset table row background to yellow','#ffff00'],
 ['Make row background pale yellow (#fff8aa)','#fff8aa']
])('accepts the requested destination/precise color: %s',(request,color)=>{
 expect(()=>parse(color,request)).not.toThrow();
 expect(()=>parse('#0000ff',request)).toThrow('TABLE_BACKGROUND_INTENT');
});
it.each(['Make table row background yellow','Make this background yellow','Make this yellow'])('enforces table context for comments-only requests: %s',comment=>{
 const project=newProject(),references=[{documentId:project.manifest.documentId,revision:0,id:'items',kind:'section',block:'items',role:'table',comment}];
 const options={request:'Apply the comments on the referenced elements.',references,scope:{mode:'selected',id:'items'}};
 expect(()=>parseChatReply(reply('#0000ff'),project,options)).toThrow('TABLE_BACKGROUND_INTENT');
 expect(()=>parseChatReply(reply('#ffff00'),project,options)).not.toThrow();
});
it('element comments never authorize a fill outside the selected table scope',()=>{
 const project=newProject(),references=[{documentId:project.manifest.documentId,revision:0,id:'items-description',kind:'column',block:'items',role:'value',comment:'Make table rows yellow'}];
 expect(()=>parseChatReply(reply('#ffff00'),project,{request:'Apply the comments on the referenced elements.',references,scope:{mode:'selected',id:'items-description'}})).toThrow('UNSAFE_SCOPE');
});
it.each([
 'Make table background yellow with text set to black',
 'Make text black with table background set to yellow',
 'Make table background yellow with black text',
 'Make black text with yellow table background',
 'Make table background yellow with #000000 text',
 'Make text #000000 with table background yellow',
 'Replace blue table background with yellow with text set to black',
 'Make table background yellow while text is set to black'
])('keeps body and text colors attached to their own targets: %s',request=>{
 expect(()=>parse('#ffff00',request)).not.toThrow();
 expect(()=>parse('#000000',request)).toThrow('TABLE_BACKGROUND_INTENT');
});
it.each(['Use red or yellow table background','Use #ff0000 or #ffff00 table background'])('fails closed for ambiguous body colors: %s',request=>{
 expect(()=>parse('#ffff00',request)).toThrow('TABLE_BACKGROUND_INTENT');
 expect(()=>parse('#ff0000',request)).toThrow('TABLE_BACKGROUND_INTENT');
});
