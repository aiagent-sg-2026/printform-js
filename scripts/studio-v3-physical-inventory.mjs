import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

const execute = promisify(execFile);
const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
export const INVENTORY_COMMANDS = Object.freeze({
  cups:{file:'/usr/bin/lpstat',args:['-p','-d']},
  usb:{file:'/usr/sbin/system_profiler',args:['SPUSBDataType','-json']}
});

// No discovery packets, queue changes, driver installation, or print/scan jobs.
export async function inventoryPhysicalDevices() {
  const commands = await Promise.all(Object.entries(INVENTORY_COMMANDS).map(async ([id,{file,args}]) => {
    try {
      const {stdout,stderr} = await execute(file,args,{timeout:15000,maxBuffer:1024*1024,env:{...process.env,LC_ALL:'C',LANG:'C'}});
      return {id,file,args,exitCode:0,stdout,stderr};
    } catch (error) {
      return {id,file,args,exitCode:Number.isInteger(error.code)?error.code:null,
        errorCode:typeof error.code==='string'?error.code:null,stdout:error.stdout || '',stderr:error.stderr || ''};
    }
  }));
  return describePhysicalInventory(commands);
}

export function describePhysicalInventory(commands) {
  const cups = commands.find(command=>command.id==='cups'), usb = commands.find(command=>command.id==='usb');
  const printers = [...(cups?.stdout || '').matchAll(/^printer ([^\s]+) /gm)].map(match=>({queue:match[1]}));
  const noQueues = !!cups && cups.exitCode===1 && /No destinations added\.|no system default destination/.test(`${cups.stdout}\n${cups.stderr}`) && !printers.length;
  const errors = [];
  if (!cups || (cups.exitCode!==0 && !noQueues)) errors.push('CUPS_INVENTORY_UNAVAILABLE');
  const usbCandidates = [];
  if (usb?.exitCode===0) {
    try {
      const root = JSON.parse(usb.stdout);
      if (!Array.isArray(root.SPUSBDataType)) throw new Error();
      const walk = items => {
        for (const item of items) {
          if (!item || typeof item!=='object') throw new Error();
          if (item.vendor_id && item.product_id) {
            const identity = {name:item._name || '',vendorId:item.vendor_id,productId:item.product_id,
              location:item.location_id || '',serial:item.serial_num || ''};
            usbCandidates.push({id:hash(JSON.stringify(identity)),name:identity.name,vendorId:identity.vendorId,productId:identity.productId});
          }
          if (item._items!==undefined) {
            if (!Array.isArray(item._items)) throw new Error();
            walk(item._items);
          }
        }
      };
      walk(root.SPUSBDataType);
    } catch { errors.push('USB_INVENTORY_INVALID'); }
  } else errors.push('USB_INVENTORY_UNAVAILABLE');
  return {schema:'studio-physical-inventory-v1',observedAt:new Date().toISOString(),platform:process.platform,
    printers,usbCandidates,scannerQualification:'not-established-by-usb-enumeration',errors,
    prerequisites:[...(!printers.length?['NO_CONFIGURED_PRINTER']:[]),...(!usbCandidates.length?['NO_USB_SCANNER_CANDIDATE']:[])],
    commands:commands.map(({id,file,args,exitCode,errorCode,stdout,stderr})=>({id,file,args,exitCode,errorCode,
      stdoutDigest:hash(stdout),stderrDigest:hash(stderr)}))};
}
