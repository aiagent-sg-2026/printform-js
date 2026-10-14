import {test,expect} from '@playwright/test';
import {demoDataForKind} from '../studio-v3/demo-catalog.js';

async function renderClaim(page,{scenario='default',retention,monetaryOnly=false}={}) {
  // A fresh same-origin HTML host loads the public engine unchanged. Unlike
  // index001 it has no legacy variables/CSS; engine-created styles/state survive.
  await page.route('**/erp-business-fixture.html',route=>route.fulfill({
    contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><script src="/dist/printform.js"></script></head><body></body></html>'
  }));
  await page.goto('/erp-business-fixture.html');
  await page.waitForFunction(()=>window.__printFormProcessed===true && window.__printFormProcessing===false);
  return page.evaluate(async({scenario,retention,monetaryOnly})=> {
    const {createProgressClaimProject}=await import('/studio-v2/samples/progress-claim.js');
    const {createProjectScenario}=await import('/studio-v2/core/sample-scenarios.js');
    const {bindTemplate}=await import('/studio-v2/core/binding.js');
    const {inspectRenderedDocument}=await import('/studio-v2/core/acceptance.js');
    const {inspectMonetaryTokens}=await import('/studio-v2/core/monetary-inspection.js');
    const project=createProgressClaimProject();
    document.documentElement.lang=project.manifest.locale;
    document.title=project.manifest.title;
    if(retention!==undefined)project.sampleData.settlement.retention=retention;
    const data=createProjectScenario(project,scenario);
    document.body.replaceChildren();document.body.style.margin='0';
    const style=document.createElement('style');style.textContent=project.themeCss;document.head.append(style);
    const template=document.createElement('template');template.id='pf-template';template.innerHTML=project.templateHtml;
    const mount=document.createElement('main');mount.id='pf-mount';document.body.append(template,mount);
    const bound=bindTemplate(template,data,project.manifest);
    if(monetaryOnly) {
      // Exercise the actual monetary geometry consumer on the bound claim.
      // This shell is not a pagination result or a claim-readiness attestation.
      const shell=document.createElement('div');shell.className='printform_page';
      shell.append(bound.fragment);mount.append(shell);
    } else mount.append(bound.fragment);
    await document.fonts.ready;
    await Promise.all([...mount.querySelectorAll('img')].map(image=>image.decode()));
    const form=mount.querySelector('.printform'),sourceRect=form.getBoundingClientRect();
    const sourceGeometry={width:sourceRect.width,height:sourceRect.height};
    const configuredGeometry={width:Number(form.dataset.papersizeWidth),height:Number(form.dataset.papersizeHeight)};
    const sourceRows=[...mount.querySelectorAll('[data-pf-text="./description"]')].map(node=>node.textContent);
    let formatErrors=[],formatReport=null;
    if(!monetaryOnly) {
      try {formatReport=await window.PrintForm.formatAll({force:true});}
      catch(error) {
        formatReport=error.report;
        formatErrors=Array.from(error.errors||[error],item=>({name:item.name,code:item.code||null,message:item.message}));
      }
    }
    const inspection=monetaryOnly ? null : inspectRenderedDocument(document,project.manifest,{expectedRowCount:bound.report.tableRows,expectedRowsByRepeat:bound.report.expectedRowsByRepeat});
    window.__businessScenario={inspectMonetaryTokens,data};
    const retainedSourceRows=[...mount.querySelectorAll('.prowitem [data-pf-text="./description"]')].map(node=>node.textContent);
    return {binding:bound.report.errors,formatErrors,formatReport,formatted:window.__printFormProcessed,valid:inspection?.valid,codes:inspection?.errors.map(error=>error.code)||[],pageGeometry:inspection?.pageGeometry||[],retainedSourceRows,sourceRows,sourceGeometry,configuredGeometry,descriptions:(data.valuationRows||data.items).map(row=>row.description),currency:project.manifest.currency};
  },{scenario,retention,monetaryOnly});
}

for(const supplied of ['(645,650.00)','-645,650.00','6,023,176.50']) {
  test(`SGD source string ${supplied} remains exact and real clipping is rejected then recovers`,async({page})=> {
    const result=await renderClaim(page,{retention:supplied,monetaryOnly:true});
    expect(result.binding).toEqual([]);expect(result.currency).toBe('SGD');
    expect(result.sourceGeometry.width).toBe(750);expect(result.sourceGeometry.height).toBeGreaterThan(0);
    const probe=await page.evaluate(()=> {
      const node=document.querySelector('.printform_page [data-pf-text="/settlement/retention"]');
      const {inspectMonetaryTokens}=window.__businessScenario;
      const source=node.textContent,baseline=inspectMonetaryTokens(document).includes(node);
      const before=node.getAttribute('style');
      node.style.cssText='display:block;width:12px;overflow:hidden;white-space:nowrap';
      const clipped=inspectMonetaryTokens(document).includes(node),after=node.textContent;
      if(before===null)node.removeAttribute('style');else node.setAttribute('style',before);
      return {source,after,baseline,clipped,recovered:!inspectMonetaryTokens(document).includes(node)};
    });
    expect(probe).toEqual({source:supplied,after:supplied,baseline:false,clipped:true,recovered:true});
  });
}

test('long claim source is conserved in complete output or atomic blocked rollback',async({page})=> {
  const control=await renderClaim(page);
  expect(control.binding).toEqual([]);expect(control.formatErrors).toEqual([]);
  expect(control.valid).toBe(true);expect(control.pageGeometry).toHaveLength(2);
  const result=await renderClaim(page,{scenario:'long-text'});
  expect(result.binding).toEqual([]);
  expect(result.descriptions).toHaveLength(6);
  expect(result.descriptions.every(text=>/\p{Script=Han}/u.test(text)&&/\p{Script=Latin}/u.test(text))).toBe(true);
  expect(result.sourceGeometry.width).toBe(750);
  expect(result.sourceGeometry.height).toBeGreaterThan(result.configuredGeometry.height);
  expect(result.sourceRows).toEqual(result.descriptions);
  if(result.formatErrors.length) {
    expect(result.formatReport).toEqual({formattedCount:0,failedCount:1});
    expect(result.formatted).toBe(false);expect(result.valid).toBe(false);
    expect(result.pageGeometry).toEqual([]);
    expect(result.formatErrors.map(error=>error.name)).toContain('RangeError');
    expect(result.retainedSourceRows).toEqual(result.descriptions);
  } else {
    expect(result.formatReport).toEqual({formattedCount:1,failedCount:0});
    expect(result.formatted).toBe(true);expect(result.valid).toBe(true);
    for(const geometry of result.pageGeometry) {
      expect(geometry.width).toBe(result.configuredGeometry.width);
      expect(geometry.height).toBe(result.configuredGeometry.height);
    }
    const rendered=await page.locator('.prowitem_processed [data-pf-text="./description"]').allTextContents();
    expect(rendered.join('')).toBe(result.descriptions.join(''));
  }
});

for(const kind of ['BankPayment','BankReceipt','PCAR','CCAR']) {
  test(`${kind} sample picker retains its exact business fixture and ERP restore`,async({page})=> {
    page.on('dialog',dialog=>dialog.accept());
    await page.goto('/studio-v3/');
    await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
    await page.locator('[data-action=new]').click();
    const details=page.locator('#new-dialog details');
    if(await details.getAttribute('open')===null)await details.locator('summary').click();
    await page.locator(`[data-demo-template=${kind}]`).click();
    await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
    await page.locator('[data-mode=data]').click();
    await page.locator('#database-workbench [data-db-group=json]').click();
    const original=JSON.parse(await page.locator('#data-json').inputValue());
    const revision=await page.locator('#revision').textContent();
    await page.locator('[data-sample="1"]').click();
    await expect(page.locator('#revision')).not.toHaveText(revision);
    await expect(page.frameLocator('#preview-frame').locator('.prowitem_processed')).toHaveCount(1);
    const generated=JSON.parse(await page.locator('#data-json').inputValue());
    const seed=demoDataForKind(kind);
    expect(generated).toEqual({...seed,items:[seed.items[0]]});
    await page.locator('[data-sample=erp]').click();
    await expect.poll(async()=>JSON.parse(await page.locator('#data-json').inputValue())).toEqual(original);
  });
}
