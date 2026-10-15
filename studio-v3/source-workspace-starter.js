// Public fictional source only: never serialize the active project/sampleData here.
export function sourceWorkspaceStarter() {
  return [
    {path:'src/form.mjs',content:`export function buildForm({title = 'GENERATED FORM'} = {}) {
  if (typeof title !== 'string' || !title.trim() || title.length > 100) throw new RangeError('A printable heading must contain 1..100 characters.');
  return {
    format:'printform-operation-artifact',version:1,
    summary:'Source-generated heading; review the actual paper before Apply.',
    operations:[
      {type:'set_section',target:'header',patch:{enabled:true}},
      {type:'set_heading',value:title}
    ]
  };
}
`},
    {path:'test/form.test.mjs',content:`import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForm} from '../src/form.mjs';

test('blank and non-text headings cannot produce an invisible print title',()=> {
  for (const title of ['', '  \\n ', null, 42]) assert.throws(()=>buildForm({title}),RangeError);
});
test('headings beyond the supported authoring boundary are rejected before build',()=> {
  assert.throws(()=>buildForm({title:'x'.repeat(101)}),RangeError);
});
`},
    {path:'build.mjs',content:`import {mkdir,writeFile} from 'node:fs/promises';
import {buildForm} from './src/form.mjs';
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/form.printform-operations.json',JSON.stringify(buildForm(),null,2)+'\\n');
`},
    {path:'README.md',content:`# Fictional PrintForm source workspace

This project contains no active Studio dataset, business values or credentials.
Use Node builtins only; the isolated command environment has no network/package install.

- Source: src/form.mjs, returning the current release's typed operation artifact.
- Tests: node --test test/form.test.mjs
- Build: node build.mjs
- Artifact: artifacts/form.printform-operations.json

Tests are editable source, not an independent qualification oracle. A command exit or printed "passed" is not proof of the requested form. The trusted Studio parser still checks all operations, financial bindings and selected scope; inspect the exact candidate and obtain human Preview/Apply. Do not add live business values, tokens, arbitrary HTML or executable browser code. All files expire when this run closes; the live form is unchanged until human Apply.
`}
  ];
}
