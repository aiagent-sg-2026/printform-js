// Run after runFileConsumerProbe(page), which installs the real download observer.
// Baseline reports featureAvailable:false; revised builds exercise the actual Share copy controls.
export async function runShareConsumerProbe(page) {
  const download = async selector => {
    const count=await page.evaluate(()=>window.__fileConsumerProbe.downloads.length);
    await page.locator(selector).click();
    await page.waitForFunction(count=>window.__fileConsumerProbe.downloads.length>count,count);
    return page.evaluate(()=>window.__fileConsumerProbe.downloads.at(-1));
  };
  const initial=JSON.parse((await download('[data-action="save"]')).text);
  initial.project.manifest.title='Fictional privacy consumer';
  initial.project.manifest.studioV3.blocks.items.enabled=false;
  initial.project.sampleData.unboundShareCanary='LIVE_UNBOUND_MUST_REMAIN_721';
  await page.evaluate(source=>window.__fileConsumerProbe.choose('open-file','privacy-fixture.printform.json',[source]),JSON.stringify(initial));
  await page.waitForFunction(()=>document.querySelector('#document-name').value==='Fictional privacy consumer');
  await page.locator('[data-mode="data"]').click();
  await page.evaluate(()=>window.__fileConsumerProbe.choose('dataset-file','PRIVATE_FILENAME_CANARY_5512.csv',['client,private\n00007.500,PRIVATE_UNMAPPED_CANARY_9862\n']));
  await page.waitForFunction(()=>document.querySelector('[data-db-import-control="target"]'));
  await page.evaluate(()=> {
    const input=document.querySelector('[data-db-import-control="target"]'); input.value=''; input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const mapping='[data-db-import-control="field"][data-db-import-field="/customer/name"]';
  for (let pageIndex=0;pageIndex<25 && !await page.locator(mapping).count();pageIndex++) await page.locator('[data-db-action="import-next-fields"]').click();
  await page.locator(mapping).selectOption('/client');
  // Native selectOption fires input, matching keyboard/mouse selection.
  await page.locator('[data-db-action="import-preview"]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-db-action="import-apply"]').disabled);
  await page.locator('[data-db-action="import-apply"]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-db-action="import-apply"]'));
  const original=JSON.parse((await download('[data-action="save"]')).text);
  const featureAvailable=await page.locator('[data-action="share"]').count()>0;
  const results={featureAvailable,ordinarySourceRetained:original.project.manifest.localImport?.sourceText==='client,private\n00007.500,PRIVATE_UNMAPPED_CANARY_9862\n',mappedExact:original.project.sampleData.customer.name==='00007.500'};
  if (!featureAvailable) return results;
  await page.locator('#document-name').fill('Fictional privacy consumer · unsaved original');
  await page.locator('#document-name').press('Tab');
  await page.waitForFunction(()=>document.querySelector('#revision').textContent.includes('unsaved'));
  const stateBefore=await page.evaluate(()=>({revision:document.querySelector('#revision').textContent,undoDisabled:document.querySelector('[data-action="undo"]').disabled,title:document.querySelector('#document-name').value}));
  await page.locator('[data-action="share"]').click();
  const json=await download('[data-action="save-share"]');
  await page.locator('[data-action="share"]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="export-share"]').disabled);
  const html=await download('[data-action="export-share"]');
  const stateAfter=await page.evaluate(()=>({revision:document.querySelector('#revision').textContent,undoDisabled:document.querySelector('[data-action="undo"]').disabled,title:document.querySelector('#document-name').value}));
  const shared=JSON.parse(json.text), check=text=>!text.includes('PRIVATE_UNMAPPED_CANARY_9862')&&!text.includes('PRIVATE_FILENAME_CANARY_5512');
  results.json={filename:json.filename,sourceOnlyCanariesAbsent:check(json.text),mappedExact:shared.project.sampleData.customer.name==='00007.500',receiptAbsent:shared.project.manifest.localImport===undefined,allLiveDataPreserved:JSON.stringify(shared.project.sampleData)===JSON.stringify(original.project.sampleData)};
  results.html={filename:html.filename,sourceOnlyCanariesAbsent:check(html.text),mappedExact:html.text.includes('00007.500'),unboundLiveValuePreserved:html.text.includes('LIVE_UNBOUND_MUST_REMAIN_721')};
  results.stateBefore=stateBefore; results.stateAfter=stateAfter;
  results.liveStatePreserved=JSON.stringify(stateBefore)===JSON.stringify(stateAfter);
  const after=JSON.parse((await download('[data-action="save"]')).text);
  results.originalReceiptUnchanged=JSON.stringify(after.project.manifest.localImport)===JSON.stringify(original.project.manifest.localImport);
  await page.evaluate(source=>window.__fileConsumerProbe.choose('open-file','reopen-share.printform.json',[source]),json.text);
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Opened editable v3 form'));
  const reopened=JSON.parse((await download('[data-action="save"]')).text);
  results.reopened={mappedExact:reopened.project.sampleData.customer.name==='00007.500',schemaRetained:JSON.stringify(reopened.project.schema)===JSON.stringify(shared.project.schema),receiptAbsent:reopened.project.manifest.localImport===undefined};
  return results;
}
