import {test,expect} from './studio-v3-test.js';
test.use({workInSteps:true});
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const RUN = {name:'Run all synthetic samples',exact:true};
const LABELS = {'0':'Empty','1':'Single item','45':'Standard','100':'Multi-page','500':'Stress','long':'Long & bilingual'};

// A scripted Demo gateway: each turn calls the next tool. Only the gateway is faked; the page, tools and renderer are real.
async function gateway(page,steps) {
  await page.addInitScript(steps => {
    const original = window.fetch.bind(window), json = (body,status = 200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    let turn = 0; window.__wire = [];
    window.fetch = async (input,init) => {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body = JSON.parse(init.body); window.__wire.push(body);
      const [name,args] = steps[turn++], output = [{id:`fc_${turn}`,type:'function_call',status:'completed',call_id:`call_${turn}`,name,arguments:JSON.stringify(args || {})}];
      const usage = {input_tokens:10,output_tokens:2,total_tokens:12};
      if (!body.stream) return json({status:'completed',output,usage});
      return new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response:{status:'completed',output,usage}})}\n\n`,{headers:{'content-type':'text/event-stream'}});
    };
  },steps);
}

test('the Validate panel and the agent tool report the same result for every scenario',async({page})=> {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{ if (m.type() === 'error') errors.push(m.text()); });
  await gateway(page,[['validate_scenarios',{}],['finish_answer',{message:'Every scenario was checked.'}]]);
  await page.goto('/studio-v3/'); await ready(page);
  // The person's path: run every synthetic sample from the Validate panel.
  await page.locator('[data-mode=validate]').click();
  await page.getByRole('button',RUN).click();
  await expect(page.getByRole('button',RUN)).toBeVisible({timeout:120000}); await ready(page);
  const ui = {};
  for (const [id,label] of Object.entries(LABELS)) ui[id] = (await page.locator('#right-panel p.hint').filter({hasText:`${label}:`}).first().textContent()).trim();
  for (const text of Object.values(ui)) expect(text).not.toContain('Not checked');
  // The agent's path: a read-only question that calls validate_scenarios.
  await page.locator('[data-ai-toggle]').click();
  await page.locator('#ai-prompt').fill('Does this form work with every sample size?'); await page.locator('[data-ai-send]').click();
  await expect(page.locator('.ai-message').filter({hasText:'Every scenario was checked.'})).toBeVisible({timeout:120000});
  const wire = await page.evaluate(() => window.__wire);
  expect(wire).toHaveLength(2); expect(wire[0].tools.map(t=>t.name)).toContain('validate_scenarios');
  for (const name of ['apply_operations','undo_step','finish']) expect(wire[0].tools.map(t=>t.name)).not.toContain(name);
  const result = JSON.parse(wire[1].input.filter(i=>i.type === 'function_call_output').at(-1).output);
  expect(result.scenarios.map(s=>s.id)).toEqual(Object.keys(LABELS));
  for (const scenario of result.scenarios) {
    const text = ui[scenario.id];
    if (scenario.ready) expect(text, scenario.id).toContain(`${scenario.metrics.logicalPages} pages · passed`);
    else expect(text, scenario.id).toMatch(/\d+ issue\(s\)/);
    expect(scenario).not.toHaveProperty('pages');
  }
  expect(result.ready).toBe(result.scenarios.every(s=>s.ready));
  await expect(page.locator('#revision')).toHaveText('r0'); expect(errors).toEqual([]);
});
