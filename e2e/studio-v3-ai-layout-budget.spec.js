import { test, expect } from './studio-v3-test.js';
// Layout budget for the AI panel: the conversation must keep room, the chrome around it must stay compact.
// Measured in a real browser with a scripted fictional gateway (nothing leaves the machine).
test.use({workInSteps:true});
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function gateway(page) {
  await page.addInitScript(()=> {
    const original = window.fetch.bind(window);
    const frame = (type,data)=>`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`;
    const json = (body,status = 200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const sse = output=>new Response(frame('response.created',{response:{status:'in_progress',output:[]}})+frame('response.completed',{response:{status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}}}),{status:200,headers:{'content-type':'text/event-stream'}});
    const reasoning = n=>({id:`rs_${n}`,type:'reasoning',content:[],encrypted_content:`enc-${n}`,summary:[]});
    const call = (n,name,args)=>({id:`fc_${n}`,type:'function_call',status:'completed',call_id:`call_${n}`,name,arguments:JSON.stringify(args)});
    const a = {summary:'Larger blue title and tighter table',operations:[{type:'set_style',patch:{color:'#1d4ed8'}},{type:'set_element_style',target:'header-title',patch:{fontSize:20,color:'#1d4ed8'}},{type:'set_table_style',target:'items',patch:{rowBackground:'#eef2ff'}}]};
    const b = {summary:'Page margins',operations:[{type:'set_page',patch:{margins:{top:12}}}]};
    const script = [()=>call(1,'get_context',{}),()=>call(2,'apply_operations',a),()=>call(3,'inspect_draft',{}),()=>call(4,'finish',{summary:'I made the title larger and blue and tinted the table rows. The changes are applied to your draft.'}),
      ()=>call(5,'get_context',{}),()=>call(6,'apply_operations',b),()=>call(7,'inspect_draft',{}),()=>call(8,'finish',{summary:'I changed the page margins. Review them, then apply.'})];
    let turns = 0;
    window.fetch = async (input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:true}}]});
      const body = JSON.parse(init.body);
      if (body.tools) { const n = turns++; return sse([reasoning(n + 1),script[n % script.length]()]); }
      return sse([{type:'message',content:[{type:'output_text',text:'ok'}]}]);
    };
  });
}
const send = async(page,text)=> { await page.locator('#ai-prompt').fill(text); await page.locator('[data-ai-send]').click(); };
const box = async(page,selector)=> { const b = await page.locator(selector).first().boundingBox(); expect(b,selector).not.toBeNull(); return b; };
const BUDGETS = [
  ['narrow 400x800',{width:400,height:800},{conversationMin:300,headerMax:104,suggestionsMax:112,sendReasonMax:56,scopeBarMax:44}],
  ['wide 1440x900',{width:1440,height:900},{conversationMin:340,headerMax:104,suggestionsMax:112,sendReasonMax:56,scopeBarMax:44}]
];
for (const [name,size,budget] of BUDGETS) {
  test(`AI panel layout budget at ${name}`,async({page})=> {
    await page.setViewportSize(size); await gateway(page); await page.goto('/studio-v3/'); await ready(page); await page.locator('[data-ai-toggle]').click();
    // Empty state: one set of starter chips only (the welcome starters), no second "Suggested actions" set.
    await expect(page.locator('[data-ai-suggestions]')).toBeHidden();
    await expect(page.locator('[data-ai-log]')).not.toContainText('Review any proposed changes before you apply them');
    await expect(page.locator('[data-ai-log]')).not.toContainText('Ask → Preview → Apply');
    await send(page,'Make the invoice title larger and blue, and improve spacing for the header and table.');
    await expect(page.locator('.ai-change-card').first()).toContainText('Applied to draft',{timeout:30000});
    const scroller = await box(page,'.ai-conversation-scroll'), card = await box(page,'.ai-change-card');
    expect(scroller.height,'conversation height').toBeGreaterThanOrEqual(budget.conversationMin);
    expect((await box(page,'.ai-heading')).height,'header height').toBeLessThanOrEqual(budget.headerMax);
    expect((await box(page,'[data-ai-suggestions]')).height,'suggestions height').toBeLessThanOrEqual(budget.suggestionsMax);
    expect((await box(page,'[data-ai-send-reason]')).height,'recipient notice height').toBeLessThanOrEqual(budget.sendReasonMax);
    const bar = await page.locator('[data-ai-scope]').first().boundingBox(); if (bar) expect(bar.height,'scope bar height').toBeLessThanOrEqual(budget.scopeBarMax);
    // The applied card is fully visible inside the conversation scroller, with its buttons.
    expect(card.y).toBeGreaterThanOrEqual(scroller.y - 1); expect(card.y + card.height).toBeLessThanOrEqual(scroller.y + scroller.height + 1);
    await expect(page.locator('.ai-change-card [data-ai=undo]')).toBeVisible();
    await expect(page.locator('.ai-change-card')).toContainText('Revision 1');
    // One header row: title and the three controls share a row (their vertical centers are within 24px).
    const title = await box(page,'.ai-heading h2'), close = await box(page,'.ai-heading [data-ai=close]');
    expect(Math.abs((title.y + title.height/2) - (close.y + close.height/2)),'title and close share a row').toBeLessThanOrEqual(24);
    // Privacy boundary stays visible.
    await expect(page.locator('[data-ai-send-reason]')).toContainText('fictional data only');
  });
}
