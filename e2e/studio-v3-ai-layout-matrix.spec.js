import { test, expect } from './studio-v3-test.js';
const { PNG } = require('playwright-core/lib/utilsBundle');
// Layout matrix for the AI panel across real window sizes (including short laptop windows) and states.
// Measured in a real browser with a scripted fictional gateway (nothing leaves the machine).
test.use({workInSteps:true});
const ready = page=>expect.soft(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function gateway(page) {
  await page.addInitScript(()=> {
    const original = window.fetch.bind(window);
    const frame = (type,data)=>`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`;
    const json = (body,status = 200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const sse = output=>new Response(frame('response.created',{response:{status:'in_progress',output:[]}})+frame('response.completed',{response:{status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}}}),{status:200,headers:{'content-type':'text/event-stream'}});
    const reasoning = n=>({id:`rs_${n}`,type:'reasoning',content:[],encrypted_content:`enc-${n}`,summary:[]});
    const call = (n,name,args)=>({id:`fc_${n}`,type:'function_call',status:'completed',call_id:`call_${n}`,name,arguments:JSON.stringify(args)});
    const a = {summary:'Larger blue title and tighter table',operations:[{type:'set_style',patch:{color:'#1d4ed8'}},{type:'set_element_style',target:'header-title',patch:{fontSize:20,color:'#1d4ed8'}},{type:'set_table_style',target:'items',patch:{rowBackground:'#eef2ff'}}]};
    const b = {summary:'Heading text',operations:[{type:'set_heading',value:'Tax Invoice'}]};
    const script = [()=>call(1,'get_context',{}),()=>call(2,'apply_operations',a),()=>call(3,'inspect_draft',{}),()=>call(4,'finish',{summary:'I made the title larger and blue and tinted the table rows. The changes are applied to your draft.'}),
      ()=>call(5,'get_context',{}),()=>call(6,'apply_operations',b),()=>call(7,'inspect_draft',{}),()=>call(8,'finish',{summary:'I changed the heading text. Review it, then apply.'})];
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
// width x height in CSS pixels. The short ones are common laptop windows (the owner's own window was about 1000x570).
const SIZES = [[1000,568],[1000,640],[1280,720],[1440,900],[768,1024],[400,800],[360,640]];
for (const [width,height] of SIZES) {
  test(`AI panel layout matrix ${width}x${height}`,async({browser})=> {
    const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:2}), page = await context.newPage();
    await gateway(page); await page.goto('/studio-v3/'); await ready(page); await page.locator('[data-ai-toggle]').click();
    const panelH = (await box(page,'#ai-panel')).height;
    // Empty state: the welcome title and the composer are fully visible, the starter cards are compact.
    const sc0 = await box(page,'.ai-conversation-scroll');
    expect.soft(sc0.height,'empty: conversation height').toBeGreaterThanOrEqual(Math.min(200,panelH*.38));
    await expect(page.locator('.ai-welcome h3').first()).toBeInViewport({ratio:1});
    for (const card of await page.locator('[data-ai-log] [data-prompt]').all()) expect.soft((await card.boundingBox()).height,'starter card height').toBeLessThanOrEqual(width < 500 ? 96 : 76);
    // Header: no hairline artifacts (thin full-width-ish bars) inside the header, one row for title and controls.
    const thin = await page.locator('.ai-heading').evaluate(h=>[...h.querySelectorAll('*')].filter(n=> { const r = n.getBoundingClientRect(),s = getComputedStyle(n); return r.width>30 && r.height>0 && r.height<=3 && (s.backgroundColor!=='rgba(0, 0, 0, 0)' || parseFloat(s.borderTopWidth)>0 || parseFloat(s.borderBottomWidth)>0) && !n.closest('button,summary,[role=progressbar]'); }).map(n=>n.className||n.tagName));
    expect.soft(thin,'hairline artifacts in header').toEqual([]);
    // Pixel check: the top strip of every header control box is one flat color (the glyph is centered, so nothing legitimate is drawn there); a stray line shows up as stray pixels.
    for (const selector of ['.ai-settings>summary','[data-ai-history]','[data-ai=close]']) {
      const b = await box(page,selector);
      const png = PNG.sync.read(await page.screenshot({clip:{x:b.x,y:b.y,width:b.width,height:8}})), base = [png.data[0],png.data[1],png.data[2]];
      let off = 0; for (let i=0;i<png.data.length;i+=4) if (Math.abs(png.data[i]-base[0])+Math.abs(png.data[i+1]-base[1])+Math.abs(png.data[i+2]-base[2])>12) off++;
      expect.soft(off,`stray pixels in the top strip of ${selector}`).toBe(0);
    }
    // Composer: the scope pill never takes most of the row; the hint shows when the composer is wide enough.
    const comp = await box(page,'.ai-composer'), pill = await box(page,'#ai-scope');
    expect.soft(pill.width,'scope pill width').toBeLessThanOrEqual(comp.width*.62);
    if (comp.width>=440) await expect(page.locator('.ai-composer')).toContainText('Shift + Enter');
    // One exchange: the newest card is readable, its heading and buttons are not clipped.
    await send(page,'Make the invoice title larger and blue, and improve spacing for the header and table.');
    const card = page.locator('.ai-change-card').first();
    await expect(card).toContainText('Applied to draft',{timeout:30000});
    const sc = await box(page,'.ai-conversation-scroll');
    expect.soft(sc.height,'conversation height after one exchange').toBeGreaterThanOrEqual(Math.min(200,panelH*.38));
    const head = await card.getByRole('heading',{name:/Applied to draft/}).boundingBox(), undo = await card.locator('[data-ai=undo]').boundingBox();
    for (const [what,b] of [['card heading',head],['Undo button',undo]]) { expect.soft(b,what).not.toBeNull(); expect.soft(b.y,what+' top inside the conversation').toBeGreaterThanOrEqual(sc.y-1); expect.soft(b.y+b.height,what+' bottom inside the conversation').toBeLessThanOrEqual(sc.y+sc.height+1); }
    // A needs-approval card: Apply/Preview/Discard row is reachable and the card heading is visible.
    await send(page,'Change the heading text to Tax Invoice.');
    await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:30000});
    const sc2 = await box(page,'.ai-conversation-scroll'), prop = page.locator('[data-ai-proposal]');
    const ph = await prop.getByRole('heading',{name:/Suggested changes/}).boundingBox(), pd = await prop.locator('[data-ai=discard]').boundingBox();
    for (const [what,b] of [['proposal heading',ph],['Discard button',pd]]) { expect.soft(b,what).not.toBeNull(); expect.soft(b.y,what+' top inside the conversation').toBeGreaterThanOrEqual(sc2.y-1); expect.soft(b.y+b.height,what+' bottom inside the conversation').toBeLessThanOrEqual(sc2.y+sc2.height+1); }
    // Composer and the privacy notice stay on screen.
    const sendBtn = await box(page,'[data-ai-send]'); expect.soft(sendBtn.y+sendBtn.height).toBeLessThanOrEqual(height+1);
    await expect(page.locator('[data-ai-send-reason]')).toBeInViewport({ratio:.9});
    await context.close();
  });
}
