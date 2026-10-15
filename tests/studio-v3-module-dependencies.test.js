// @vitest-environment node
import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importClosure } from '../scripts/studio-v3-agent-impact.mjs';

it('publishes real static/literal-dynamic dependencies without treating fictional source or comments as imports',()=> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'printform-module-closure-'));
  try {
    fs.writeFileSync(path.join(root,'entry.js'),[
      "import './dependency.js';",
      "export { value } from './dependency.js';",
      "export const fixture = `import fictional from './not-a-real-module.mjs';`;",
      "// import imaginary from './not-a-comment-dependency.js';",
      "const url = import.meta.url;",
      "export const load = () => import('./lazy.js');"
    ].join('\n'));
    fs.writeFileSync(path.join(root,'dependency.js'),'export const value = 42;');
    fs.writeFileSync(path.join(root,'lazy.js'),'export default 43;');
    expect(importClosure(root,['entry.js'])).toEqual({files:['dependency.js','entry.js','lazy.js'],untracked:[]});
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

it('still reports an executable computed import as untracked instead of silently publishing incomplete coverage',()=> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'printform-module-untracked-'));
  try {
    fs.writeFileSync(path.join(root,'entry.js'),'export const load = name => import(name);');
    expect(importClosure(root,['entry.js'])).toEqual({files:['entry.js'],untracked:['entry.js']});
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
