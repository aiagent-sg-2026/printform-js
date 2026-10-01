import fs from 'node:fs';
import path from 'node:path';
import { newProject } from '../studio-v3/model.js';
import { validateProject } from '../studio-v2/core/acceptance.js';
import { serializeStandalone } from '../studio-v2/core/project-model.js';

export async function buildStudioV3({root,output}) {
  const directory = path.resolve(output,'studio-v3/samples');
  fs.mkdirSync(directory,{recursive:true});
  const sources = {
    documentRuntime:fs.readFileSync(path.resolve(root,'dist/printform-document.js'),'utf8'),
    printform:fs.readFileSync(path.resolve(root,'dist/printform.js'),'utf8'),runtimeVersion:'2.0.0'
  };
  for (const type of ['invoice','purchase','delivery']) {
    const project = newProject(type);
    project.manifest.documentId = `v3-${type}-sample`;
    const report = validateProject(project);
    if (!report.valid) throw new Error(`Invalid v3 ${type} sample: ${JSON.stringify(report.errors)}`);
    const html = await serializeStandalone(project,sources,report,{networkDisabled:true});
    fs.writeFileSync(path.resolve(directory,`${type}.html`),html);
  }
}
