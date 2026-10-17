// Parent-run browser probe. Works against the original 42e014b UI and the changed UI.
// No new helper imports; actual File inputs, native file methods, controls and downloaded Blobs.
export async function runFileConsumerProbe(page) {
  await page.waitForFunction(()=>!document.body.inert && document.querySelector('[data-action="save"]'));
  await page.evaluate(()=> {
    const probe = window.__fileConsumerProbe = {downloads:[],reads:[],holds:{},started:0,finished:0};
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.download && this.href.startsWith('blob:')) {
        const filename = this.download;
        fetch(this.href).then(response=>response.text()).then(text=>probe.downloads.push({filename,text}));
      }
      return click.call(this);
    };
    for (const method of ['text','arrayBuffer']) {
      const native = File.prototype[method];
      File.prototype[method] = async function(...args) {
        probe.reads.push({name:this.name,method,size:this.size}); probe.started++;
        try {
          if (probe.holds[this.name]) await probe.holds[this.name].promise;
          return await native.apply(this,args);
        } finally { probe.finished++; }
      };
    }
    probe.choose = (id,name,parts) => {
      const file = new File(parts,name,{type:/csv$/.test(name) ? 'text/csv' : 'application/json'});
      const transfer = new DataTransfer(); transfer.items.add(file);
      const input = document.getElementById(id); input.files = transfer.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    };
    probe.hold = name => {
      let release; const promise = new Promise(resolve=> { release=resolve; });
      probe.holds[name] = {promise,release};
    };
  });
  const settle = async()=> {
    await page.waitForFunction(()=>window.__fileConsumerProbe.started === window.__fileConsumerProbe.finished);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  const saved = async()=> {
    const count = await page.evaluate(()=>window.__fileConsumerProbe.downloads.length);
    await page.locator('[data-action="save"]').click();
    await page.waitForFunction(count=>window.__fileConsumerProbe.downloads.length>count,count);
    return page.evaluate(()=>JSON.parse(window.__fileConsumerProbe.downloads.at(-1).text));
  };
  const before = await saved(), results = {};
  await page.evaluate(()=>window.__fileConsumerProbe.choose('open-file','oversized-project.json',[' '.repeat(10*1024*1024+1)]));
  await settle();
  results.oversizedProject = await page.evaluate(()=>({
    reads:window.__fileConsumerProbe.reads.filter(read=>read.name==='oversized-project.json'),
    message:document.querySelector('#status').textContent
  }));
  results.oversizedProject.unchanged = JSON.stringify((await saved()).project) === JSON.stringify(before.project);
  await page.evaluate(()=>window.__fileConsumerProbe.choose('dataset-file','oversized-data.csv',['x'.repeat(2*1024*1024+1)]));
  await settle();
  results.oversizedDataset = await page.evaluate(()=>({reads:window.__fileConsumerProbe.reads.filter(read=>read.name==='oversized-data.csv'),message:document.querySelector('#status').textContent}));

  // The old implementation only checked bus identity: an edit of the same bus was lost.
  await page.evaluate(source=> {
    window.__fileConsumerProbe.hold('delayed-open.json');
    window.__fileConsumerProbe.choose('open-file','delayed-open.json',[source]);
  },JSON.stringify(before));
  await page.waitForFunction(()=>window.__fileConsumerProbe.reads.some(read=>read.name==='delayed-open.json'));
  await page.locator('#document-name').fill('Newer human work must survive');
  await page.locator('#document-name').press('Tab');
  const edited = await saved();
  await page.evaluate(()=>window.__fileConsumerProbe.holds['delayed-open.json'].release());
  await settle();
  const afterDelayed = await saved();
  results.editedDuringOpen = {preserved:JSON.stringify(afterDelayed.project)===JSON.stringify(edited.project),title:afterDelayed.project.manifest.title};

  // Invalid UTF-8 inside otherwise valid JSON used to be silently replaced by File.text().
  const valid = await saved();
  await page.evaluate(source=> {
    const data = JSON.parse(source); data.project.manifest.title='UTF8_BYTE';
    const text=JSON.stringify(data), position=text.indexOf('UTF8_BYTE'), bytes=new TextEncoder().encode(text);
    bytes[position]=255; window.__fileConsumerProbe.choose('open-file','invalid-utf8.json',[bytes]);
  },JSON.stringify(valid));
  await settle();
  const utf8Message=await page.locator('#status').textContent();
  results.invalidUtf8 = {preserved:JSON.stringify((await saved()).project)===JSON.stringify(valid.project),message:utf8Message};

  // Same-document import reads could finish out of order and overwrite a newer review.
  await page.locator('[data-mode="data"]').click();
  await page.evaluate(()=> {
    const probe=window.__fileConsumerProbe; probe.hold('older-private-source.csv');
    probe.choose('dataset-file','older-private-source.csv',['client,private\nOLDER,PRIVATE_OLD\n']);
    probe.choose('dataset-file','newer-private-source.csv',['client,private\n00007,PRIVATE_UNMAPPED_CANARY\n']);
  });
  await page.waitForFunction(()=>document.querySelector('#database-workbench')?.textContent.includes('newer-private-source.csv'));
  await page.evaluate(()=>window.__fileConsumerProbe.holds['older-private-source.csv'].release());
  await settle();
  results.importRace = await page.evaluate(()=>({newerRetained:document.querySelector('#database-workbench').textContent.includes('newer-private-source.csv'),revision:document.querySelector('#revision').textContent}));
  await page.locator('[data-db-action="import-cancel"]').first().click();
  const retryBefore = await saved();
  await page.evaluate(()=>window.__fileConsumerProbe.choose('open-file','malformed.json',['{"bad":']));
  await settle();
  const afterMalformed = await saved();
  await page.evaluate(source=>window.__fileConsumerProbe.choose('open-file','retry.printform.json',[source]),JSON.stringify(retryBefore));
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Opened editable v3 form'));
  const retried = await saved();
  results.retry = {malformedPreserved:JSON.stringify(afterMalformed.project)===JSON.stringify(retryBefore.project),reopenedData:JSON.stringify(retried.project.sampleData)===JSON.stringify(retryBefore.project.sampleData),schema:JSON.stringify(retried.project.schema)===JSON.stringify(retryBefore.project.schema)};
  return results;
}
