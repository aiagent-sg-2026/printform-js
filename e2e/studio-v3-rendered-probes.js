import {JSDOM} from 'jsdom';
import {build} from 'vite';
import {resolve} from 'node:path';
import {createStandaloneHtml} from '../studio-v2/core/exporter.js';

// Match the Node-side exporter/build fixtures; jsdom only parses templates, never measures paper.
const parsingWindow = new JSDOM('').window;
globalThis.DOMParser ??= parsingWindow.DOMParser;
globalThis.document ??= parsingWindow.document;

// Read the current opaque frame's main world after srcdoc replacement, independent
// of the locator utility-world lifecycle; sandbox and output assertions stay intact.
export async function previewDocument(page, read) {
  const element = await page.locator('#preview-frame').elementHandle();
  try {
    const frame = await element.contentFrame();
    return frame ? await frame.evaluate(read) : null;
  } finally {
    await element.dispose();
  }
}

export async function standaloneHtml(page,project) {
  // Use the exact runtimes loaded by the published app, not an unpublished raw module graph
  // or a potentially different local dist directory. The new file runs both runtimes itself.
  const preview = page.frameLocator('#preview-frame');
  const documentRuntime = preview.locator('#pf-document-runtime');
  const runtimeSources = {
    documentRuntime:await documentRuntime.textContent(),
    printform:await preview.locator('#pf-printform-runtime').textContent(),
    runtimeVersion:await documentRuntime.getAttribute('data-version')
  };
  return (await createStandaloneHtml(project,{baseUrl:page.url(),runtimeSources,networkDisabled:true})).html;
}

let numericModules;
export async function mountNumericProbeModules(page) {
  if (!numericModules) {
    const root = resolve(process.cwd());
    const entry = resolve(root,'e2e/__numeric-rendered-probe-entry.js');
    const exports = {
      'model.js':['newProject','designOf','compileProject'],
      'agent-draft.js':['createDraft'],
      'agent-tools.js':['createAgentTools'],
      'preview.js':['PaperPreview'],
      'validation.js':['inspectProject','bindingValidation'],
      'ai-gateway-config.js':['DEMO_CONFIG']
    };
    const source = Object.entries(exports).map(([file,names])=>
      `export {${names.join(',')}} from ${JSON.stringify(resolve(root,'studio-v3',file))};`).join('\n');
    // The site's existing Vite ES-library convention resolves the complete production graph.
    // This is a test-only in-memory entry, not a new public source-module publishing path.
    numericModules = build({root,base:'./',configFile:false,logLevel:'warn',
      plugins:[{name:'numeric-rendered-probe',resolveId:id=>id === entry ? entry : null,load:id=>id === entry ? source : null}],
      build:{target:'es2022',write:false,minify:false,lib:{entry,formats:['es'],fileName:()=> 'numeric-probe.js'},
        rollupOptions:{output:{inlineDynamicImports:true}}}
    }).then(result=> {
      const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle=>bundle.output);
      const chunks = outputs.filter(output=>output.type === 'chunk');
      if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw new Error('Numeric probe must be a self-contained browser module.');
      return chunks[0].code;
    });
  }
  const body = await numericModules;
  const url = new URL('__e2e__/numeric-probe.js',page.url()).href;
  await page.route(url,route=>route.fulfill({status:200,contentType:'text/javascript',body}));
  return url;
}
