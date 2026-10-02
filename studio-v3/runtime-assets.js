let cached;
export function runtimeSources() {
  if (!cached) {
    const base = document.querySelector('meta[name=printform-assets]')?.content;
    const prefix = base?.startsWith('./releases/') ? base : '../dist/';
    cached = Promise.all(['printform-document.js','printform.js'].map(name=>fetch(prefix+name).then(response=> {
      if (!response.ok) throw new Error('This build’s print runtime is unavailable. Retry when online.');
      return response.text();
    }))).then(([documentRuntime,printform])=>({documentRuntime,printform,runtimeVersion:'2.0.0'})).catch(error=> { cached = null; throw error; });
  }
  return cached;
}
