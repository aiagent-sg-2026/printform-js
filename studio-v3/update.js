export function workerVersion(worker,timeout = 3000) {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve,reject)=> {
    const channel = new MessageChannel();
    const timer = setTimeout(()=> { channel.port1.close(); reject(new Error('Update worker did not respond. Retry when online.')); },timeout);
    channel.port1.onmessage = event=> {
      clearTimeout(timer); channel.port1.close();
      const value = event.data;
      resolve(value?.ready && /^[a-f0-9]{40}$/.test(value.build) ? value : null);
    };
    worker.postMessage({type:'VERSION'},[channel.port2]);
  });
}
// Some browsers keep update() pending while a verified worker is waiting.
// Observe installation independently so the user can activate that worker.
export function checkRegistration(registration,timeout = 15000) {
  return new Promise((resolve,reject)=> {
    let worker,done = false;
    const finish = error=> {
      if (done) return; done = true; clearTimeout(timer);
      registration.removeEventListener('updatefound',found); worker?.removeEventListener('statechange',state);
      error ? reject(error) : resolve();
    };
    const state = ()=> {
      if (worker?.state === 'installed') finish();
      if (worker?.state === 'redundant') finish(new Error('Update download or verification failed. Current version and work are unchanged; retry.'));
    };
    const found = ()=> { worker = registration.installing; worker?.addEventListener('statechange',state); state(); };
    const timer = setTimeout(()=>finish(new Error('Update check timed out. Current version and work are unchanged; retry when online.')),timeout);
    registration.addEventListener('updatefound',found); found();
    Promise.resolve(registration.update()).then(()=> { if (!registration.installing) finish(); }).catch(finish);
  });
}
export function navigateUpdate(work,build,reload,message) {
  const fallback = setTimeout(()=> {
    // Stop the pending navigation before allowing new edits; otherwise a late
    // navigation could overwrite those edits with the earlier saved snapshot.
    window.stop(); work.failed();
    message('Reload did not complete. Work and its backup are retained; reconnect and retry Update.');
  },10000);
  const clear = ()=>clearTimeout(fallback);
  window.addEventListener('pagehide',clear,{once:true});
  try { reload(build); } catch (error) { clear(); window.removeEventListener('pagehide',clear); throw error; }
}
export function setupUpdates(work,{sw = navigator.serviceWorker,reload = ()=>location.reload()} = {}) {
  const current = document.querySelector('meta[name=printform-source-revision]').content;
  const version = document.querySelector('#app-version'), button = document.querySelector('#update-button'), status = document.querySelector('#update-status');
  version.textContent = `v3 · ${/^[a-f0-9]{40}$/.test(current) ? current.slice(0,12) : 'local'}`; version.title = current;
  let registration, candidate, busy = false;
  const message = text=> { status.textContent = text; };
  async function refresh() {
    if (!registration) return;
    const worker = registration.waiting || registration.active;
    const value = await workerVersion(worker);
    candidate = value && value.build !== current ? {worker,...value} : null;
    button.textContent = candidate ? `Update to ${candidate.build.slice(0,12)}` : 'Check for updates';
    button.dataset.target = candidate?.build || '';
    if (candidate) message('New build ready. This tab stays on its current version until you choose Update.');
  }
  function watch() {
    const worker = registration.installing; if (!worker) return;
    worker.addEventListener('statechange',()=> {
      if (worker.state === 'installed') void refresh().catch(error=>message(error.message));
      if (worker.state === 'redundant') message('Update download or verification failed. Current version and work are unchanged; retry when online.');
    });
  }
  async function activate(target) {
    if (registration.active === target.worker && target.worker.state === 'activated' && sw.controller === target.worker) return;
    if (registration.waiting !== target.worker && registration.active !== target.worker) throw new Error('The available update changed. Check again; your work is retained.');
    await new Promise((resolve,reject)=> {
      const clear = ()=> { clearTimeout(timer); sw.removeEventListener('controllerchange',changed); target.worker.removeEventListener('statechange',changed); };
      const timer = setTimeout(()=> { clear(); reject(new Error('Update activation timed out. Your work and recovery backup are retained; retry.')); },10000);
      const changed = () => {
        if (sw.controller !== target.worker || target.worker.state !== 'activated') return;
        clear(); resolve();
      };
      sw.addEventListener('controllerchange',changed);
      target.worker.addEventListener('statechange',changed);
      target.worker.postMessage({type:'ACTIVATE',build:target.build});
      changed();
    });
  }
  button.onclick = async()=> {
    if (busy) return; busy = true; button.disabled = true;
    try {
      if (!candidate) {
        message('Checking and verifying the complete update…');
        await checkRegistration(registration);
        await refresh();
        if (!candidate && !registration?.installing) message('Current version is ready. No verified newer build is available.');
        return;
      }
      const target = candidate;
      if (!navigator.onLine) throw new Error('Update is ready. Reconnect, then choose Update again. Current work is unchanged.');
      if (!await work.prepare()) return;
      if (!navigator.onLine) throw new Error('Reconnect, then choose Update again. Work and its recovery backup are retained.');
      await activate(target);
      message(`Updating to ${target.build.slice(0,12)}…`);
      navigateUpdate(work,target.build,reload,message);
    } catch (error) { work.failed(); message(error.message || 'Update failed. Current work is retained.'); }
    finally { busy = false; button.disabled = !registration; if (!work.leaving()) button.focus(); }
  };
  if (!sw?.register) { button.disabled = true; message('Offline updates are unavailable in this browser; current build is shown above.'); return; }
  sw.addEventListener('controllerchange',()=> { if (!work.leaving()) void refresh().catch(error=>message(error.message)); });
  void sw.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(async reg=> {
    registration = reg; button.disabled = false; reg.addEventListener('updatefound',watch); watch(); await refresh();
  }).catch(()=> { button.disabled = true; message('Offline cache could not start. Work remains in this tab; retry when online.'); });
}
