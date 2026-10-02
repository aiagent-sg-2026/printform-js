import { createStandaloneHtml } from '../studio-v2/core/exporter.js';
import { assertTrustedContent } from '../studio-v2/core/content-security.js';
import { bindingValidation, validatePaperReport } from './validation.js';
import { runtimeSources } from './runtime-assets.js';
import { measureTypography, validateTypography } from './ai-typography.js';

const SOURCE = 'printform-studio-v3-preview';
const NONCE = 'cHJpbnRmb3JtLXN0dWRpby12Mw==';
function bridge(token) {
  return `<script nonce="${NONCE}">(() => {
    const token = ${token};
    const send = (type,payload) => parent.postMessage({source:'${SOURCE}',token,type,payload},'*');
    const measureTypography = ${measureTypography.toString()};
    let pages = [];
    function select(id) {
      document.querySelectorAll('[data-v3-selection]').forEach(n => n.remove());
      document.querySelectorAll('[data-v3-id]').forEach(n => { n.style.outline = ''; });
      pages.forEach(page => {
        const nodes = [...page.querySelectorAll('[data-v3-id]')].filter(n => n.dataset.v3Id === id);
        if (!nodes.length) return;
        const rects = nodes.map(n => n.getBoundingClientRect()), root = page.getBoundingClientRect();
        const x = Math.min(...rects.map(r => r.left)) - root.left, y = Math.min(...rects.map(r => r.top)) - root.top;
        const width = Math.max(...rects.map(r => r.right)) - root.left - x, height = Math.max(...rects.map(r => r.bottom)) - root.top - y;
        page.style.position = 'relative';
        const outline = document.createElement('div'); outline.dataset.v3Selection = 'true';
        outline.style.cssText = 'position:absolute;pointer-events:none;border:2px solid #1763dc;z-index:2;left:'+x+'px;top:'+y+'px;width:'+width+'px;height:'+height+'px';
        page.append(outline);
      });
    }
    window.addEventListener('printform:rendered', e => {
      pages = [...document.querySelectorAll('.printform_page')];
      send('rendered', {typography:measureTypography(),report:e.detail, pages:pages.map(p => ({top:p.offsetTop,width:p.getBoundingClientRect().width,height:p.getBoundingClientRect().height,html:p.outerHTML})), styles:[...document.querySelectorAll('style')].map(n => n.textContent).join('\\n'), height:Math.max(1123,...pages.map(p => p.offsetTop + p.offsetHeight + 24))});
    });
    document.addEventListener('click', e => {
      const n = e.target.closest('[data-v3-id]');
      if (n) { e.preventDefault(); select(n.dataset.v3Id); send('selection',{id:n.dataset.v3Id,page:pages.indexOf(n.closest('.printform_page'))}); }
    });
    window.addEventListener('message', e => {
      if (e.source !== parent || e.data?.source !== 'printform-studio-v3' || e.data.token !== token) return;
      if (e.data.type === 'select') select(e.data.id);
      if (e.data.type === 'print') { select(''); window.print(); }
    });
    window.addEventListener('error', e => send('error',{message:e.message}));
  })();</script>`;
}

export class PaperPreview {
  constructor(frame, onReport, onSelect) {
    this.frame = frame; this.token = 0; this.onReport = onReport; this.onSelect = onSelect; this.pages = []; this.committedFacts = null;
    window.addEventListener('message', e => {
      const d = e.data;
      if (e.source !== frame.contentWindow || d?.source !== SOURCE || d.token !== this.token) return;
      if (d.type === 'selection') onSelect(d.payload);
      if (d.type === 'rendered') {
        this.pages = d.payload.pages; this.height = d.payload.height;
        if (this.measurement.committed && validatePaperReport(d.payload.report).status === 'ready') this.committedFacts = {...this.measurement,facts:validateTypography(d.payload.typography)};
        frame.style.height = `${this.height}px`;
        this.finish(validatePaperReport(d.payload.report), d.payload);
      }
      if (d.type === 'error') this.finish({status:'blocked',validation:{errors:[{code:'RENDER_ERROR',message:d.payload.message}],warnings:[]}}, {});
    });
  }
  cancel() { this.token += 1; clearTimeout(this.timer); this.resolve?.({status:'superseded'}); this.resolve = null; }
  finish(report, view) {
    clearTimeout(this.timer); this.resolve?.(report); this.resolve = null;
    this.onReport(report, view);
  }
  async render(project,{committed=false}={}) {
    this.cancel();
    const token = this.token; this.measurement = {committed,documentId:project.manifest.documentId,revision:project.revision,design:JSON.stringify(project.manifest.studioV3)};
    if (committed) this.committedFacts = null;
    const resultPromise = new Promise(resolve => { this.resolve = resolve; });
    try {
      assertTrustedContent(project, {allowExternalHttps:false});
      const bindings = bindingValidation(project);
      if (!bindings.valid) {
        this.frame.srcdoc = '<!doctype html><p style="font:16px Arial;padding:36px;color:#a42323">Fix the data binding errors to render this form.</p>';
        this.pages = []; this.height = 1123;
        this.finish({status:'blocked',validation:{errors:bindings.errors,warnings:[]}}, {});
        return resultPromise;
      }
      const result = await createStandaloneHtml(project, {runtimeSources:await runtimeSources(),requireTrusted:false,networkDisabled:true,scriptNonce:NONCE});
      if (token !== this.token) return {status:'superseded'};
      const at = result.html.lastIndexOf('</body>');
      this.frame.srcdoc = '';
      this.frame.srcdoc = result.html.slice(0, at) + bridge(token) + result.html.slice(at);
      this.timer = setTimeout(() => {
        if (token === this.token) this.finish({status:'blocked',validation:{errors:[{code:'RENDER_TIMEOUT',message:'Rendering timed out. Check data size and retry.'}],warnings:[]}}, {});
      }, 25000);
    } catch (e) {
      if (token === this.token) {
        this.frame.srcdoc = '<!doctype html><p style="font:16px Arial;padding:36px">Unable to render this document.</p>';
        this.finish({status:'blocked',validation:{errors:[{code:e.code || 'RENDER_FAILED',message:e.message}],warnings:[]}}, {});
      }
    }
    return resultPromise;
  }
  factsFor(project) { const saved = this.committedFacts; return saved && saved.documentId === project.manifest.documentId && saved.revision === project.revision && saved.design === JSON.stringify(project.manifest.studioV3) ? saved.facts : []; }
  send(type, extra = {}) { this.frame.contentWindow?.postMessage({source:'printform-studio-v3',token:this.token,type,...extra}, '*'); }
  thumbnails(container, pages, styles, onPage) {
    container.replaceChildren();
    pages.forEach((page, i) => {
      const button = document.createElement('button'); button.className = 'thumbnail'; button.dataset.page = i;
      button.setAttribute('aria-label', `Go to page ${i + 1}`);
      const scene = document.createElement('span'); scene.className = 'thumbnail-scene';
      const shadow = scene.attachShadow({mode:'open'});
      const style = document.createElement('style');
      style.textContent = styles + '\n#pf-mount {width:794px;transform:scale(.09);transform-origin:top left;} #pf-mount .printform_page {margin:0;box-shadow:none;}';
      const mount = document.createElement('div'); mount.id = 'pf-mount';
      const template = document.createElement('template'); template.innerHTML = page.html;
      template.content.querySelectorAll('script,iframe,object,embed,link,style').forEach(n => n.remove());
      template.content.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on|^(src|href)$/i.test(a.name)) n.removeAttribute(a.name); }));
      mount.append(template.content); shadow.append(style, mount);
      const number = document.createElement('span'); number.textContent = i + 1;
      button.append(scene, number); button.onclick = () => onPage(i); container.append(button);
    });
  }
}
