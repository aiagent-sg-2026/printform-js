import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inventoryPhysicalDevices} from './studio-v3-physical-inventory.mjs';
import {inspectPhysicalEvidence} from './studio-v3-physical-evidence.mjs';

export function physicalArguments(args) {
  if (args.length===1 && args[0]==='--help') return {command:'help'};
  if (args.length===1 && args[0]==='inventory') return {command:'inventory'};
  if (args[0]==='check' && args.length<=2 && (args.length===1 || (typeof args[1]==='string' && args[1].length>0 && !args[1].startsWith('-')))) return {command:'check',file:args[1]};
  throw Object.assign(new Error('Use inventory, check [bundle.json], or --help; no device operations are supported.'),{code:'ARGUMENTS_INVALID'});
}
export async function physicalCheckMain(args) {
  let options;
  try { options=physicalArguments(args); }
  catch (error) { console.log(JSON.stringify({status:'invalid',errors:[error.code],message:error.message})); return 1; }
  if (options.command==='help') {
    console.log('Read-only: node scripts/studio-v3-physical-check.mjs inventory | check [bundle.json]\nExit: 0 inventory with prerequisites; 1 invalid; 2 missing/no device; 3 supplied for independent review (NOT certified).\nNo print jobs, scanner commands, browser changes, network probing, evidence submission or approval.');
    return 0;
  }
  const inventory=await inventoryPhysicalDevices();
  if (options.command==='inventory') {
    console.log(JSON.stringify(inventory,null,2));
    return inventory.prerequisites.length || inventory.errors.length ? 2 : 0;
  }
  const result=inspectPhysicalEvidence(options.file,inventory);
  console.log(JSON.stringify({...result,inventory},null,2));
  return result.status==='invalid'?1:result.status==='supplied-for-independent-review'?3:2;
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode=await physicalCheckMain(process.argv.slice(2));
