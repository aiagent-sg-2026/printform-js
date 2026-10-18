// @vitest-environment node
import {describe,it,expect,afterEach,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectPhysicalEvidence,parsePhysicalJson,physicalDigest} from '../scripts/studio-v3-physical-evidence.mjs';
import {describePhysicalInventory} from '../scripts/studio-v3-physical-inventory.mjs';
import {physicalArguments} from '../scripts/studio-v3-physical-check.mjs';

const roots=[];
afterEach(()=>{ vi.restoreAllMocks(); for (const root of roots.splice(0)) fs.rmSync(root,{recursive:true,force:true}); });
const inventory={printers:[{queue:'synthetic-queue'}],usbCandidates:[{id:`sha256:${'a'.repeat(64)}`}],errors:[],prerequisites:[]};
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'printform-physical-consumer-')); roots.push(root);
  const ref=(name,value,mediaType)=> {
    const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value));
    fs.writeFileSync(path.join(root,name),bytes); return {path:name,digest:physicalDigest(bytes),mediaType};
  };
  const source=ref('source.json',{sampleData:{codes:{code128:'00A<&',ean13:'0001234567895'}}},'application/json');
  const artifact=ref('output.html','<!doctype html><html><body>Synthetic test only</body></html>','text/html');
  // Synthetic digital image intentionally cannot certify physical provenance, even with all fields.
  const capture=ref('synthetic.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64'),'image/png');
  const symbols=[['a','CODE128','code128','00A<&'],['b','EAN13','ean13','0001234567895']].map(([id,format,key,value])=>({id,format,pointer:`/sampleData/codes/${key}`,scan:ref(`${id}.txt`,`${value}\r\n`,'text/plain'),terminator:'CRLF'}));
  const bundle={schema:'studio-physical-evidence-v1',id:'synthetic-only',sourceAuthor:'synthetic-author',source,artifact,
    printer:{queue:'synthetic-queue',model:'synthetic-printer',dpi:300},
    scanner:{usbId:inventory.usbCandidates[0].id,model:'synthetic-reader',firmware:'test',mode:'hardware-barcode-reader'},
    media:{id:'synthetic-media',type:'plain-paper',widthMm:210,heightMm:297},
    print:{operator:'synthetic-operator',printedAt:'2026-10-01T00:00:00.000Z',scalePercent:100},
    capture:{observer:'synthetic-independent-observer',method:'camera-photo-of-physical-sheet',capturedAt:'2026-10-01T00:01:00.000Z',artifact:capture},symbols};
  const measurements={schema:'physical-measurement-v1',evidenceId:bundle.id,sourceDigest:source.digest,artifactDigest:artifact.digest,captureDigest:capture.digest,
    printerQueue:bundle.printer.queue,scannerUsbId:bundle.scanner.usbId,mediaId:bundle.media.id,observer:bundle.capture.observer,
    measuredAt:'2026-10-01T00:02:00.000Z',instrument:{id:'synthetic-caliper',model:'synthetic',calibratedAt:'2026-09-01T00:00:00.000Z'},
    mediaWidthMm:210,mediaHeightMm:297,clipped:false,
    symbols:symbols.map(symbol=>({id:symbol.id,format:symbol.format,scanDigest:symbol.scan.digest,moduleWidthMm:0.5,barHeightMm:12,quietLeftMm:6,quietRightMm:6}))};
  const save=()=> {
    bundle.measurements=ref('measurements.json',measurements,'application/json');
    fs.writeFileSync(path.join(root,'bundle.json'),JSON.stringify(bundle));
    return path.join(root,'bundle.json');
  };
  return {root,bundle,measurements,ref,save,check:(devices=inventory)=>inspectPhysicalEvidence(save(),devices)};
}

describe('physical evidence consumer boundaries',()=> {
  it('reports missing evidence and no hardware without inventing a physical receipt',()=> {
    const result=inspectPhysicalEvidence(undefined,{prerequisites:['NO_CONFIGURED_PRINTER'],errors:[]});
    expect(result).toMatchObject({status:'missing',physicalGate:'missing',certified:false});
    expect(result.missing).toContain('EVIDENCE_BUNDLE_REQUIRED');
  });
  it('binds source bytes, exact independent scanner bytes and measurements, never certifies authored records',()=> {
    const result=fixture().check();
    expect(result).toMatchObject({status:'supplied-for-independent-review',physicalGate:'independent-review-required',certified:false});
    expect(result.observations.map(row=>row.decodedValue)).toEqual(['00A<&','0001234567895']);
  });
  it('fails closed when named hardware is absent even for a structurally complete package',()=> {
    const result=fixture().check({printers:[],usbCandidates:[],errors:[],prerequisites:[]});
    expect(result).toMatchObject({status:'no-device',physicalGate:'missing',certified:false});
    expect(result.missing).toEqual(['PRINTER_NOT_PRESENT','SCANNER_NOT_PRESENT']);
  });
  it.each(['../outside.txt','/etc/passwd','http://example.test/a','sub/../../outside','sub\\outside.txt'])('rejects unsafe explicit reference %s',unsafe=> {
    const f=fixture(); f.bundle.symbols[0].scan.path=unsafe;
    expect(f.check().errors).toContain('ARTIFACT_PATH_OR_DIGEST');
  });
  it('rejects symlink escape without following the target',()=> {
    const f=fixture(); fs.symlinkSync('/etc/passwd',path.join(f.root,'linked.json')); f.bundle.source.path='linked.json';
    expect(f.check().errors).toContain('ARTIFACT_SYMLINK');
  });
  it('rejects linked-directory escape',()=> {
    const f=fixture(); fs.symlinkSync(os.tmpdir(),path.join(f.root,'linked')); f.bundle.source.path='linked/source.json';
    expect(f.check().errors).toContain('ARTIFACT_SYMLINK');
  });
  it.each(['file','ancestor'])('rejects %s replacement between lstat and open before reading replacement bytes',mode=> {
    const f=fixture(),foreign=fixture(),base=fs.realpathSync(f.root),other=fs.realpathSync(foreign.root);
    fs.mkdirSync(path.join(base,'nested'));
    fs.copyFileSync(path.join(base,'source.json'),path.join(base,'nested','source.json'));
    f.bundle.source.path='nested/source.json';
    const file=f.save(),target=path.join(base,'nested','source.json');
    const open=fs.openSync,read=fs.readSync;
    let replacementFd,swapped=false,foreignReads=0;
    vi.spyOn(fs,'openSync').mockImplementation((name,...args)=> {
      if (name===target && !swapped) {
        swapped=true;
        if (mode==='file') {
          fs.renameSync(target,`${target}.held`);
          fs.copyFileSync(path.join(other,'source.json'),target);
        } else {
          fs.renameSync(path.join(base,'nested'),path.join(base,'held'));
          fs.symlinkSync(other,path.join(base,'nested'));
        }
        replacementFd=open(name,...args);
        return replacementFd;
      }
      return open(name,...args);
    });
    vi.spyOn(fs,'readSync').mockImplementation((fd,...args)=> {
      if (swapped && fd===replacementFd) foreignReads++;
      return read(fd,...args);
    });
    const result=inspectPhysicalEvidence(file,inventory);
    expect(swapped).toBe(true);
    expect(result).toMatchObject({status:'invalid',certified:false});
    expect(result.errors).toContain('ARTIFACT_PATH_CHANGED');
    expect(foreignReads).toBe(0);
  });
  it('rejects identical-byte ancestor replacement after reading rather than returning a custody result',()=> {
    const f=fixture(),base=fs.realpathSync(f.root),nested=path.join(base,'nested'),replacement=path.join(base,'replacement');
    fs.mkdirSync(nested); fs.mkdirSync(replacement);
    for (const directory of [nested,replacement]) fs.copyFileSync(path.join(base,'source.json'),path.join(directory,'source.json'));
    f.bundle.source.path='nested/source.json';
    const file=f.save(),target=path.join(nested,'source.json'),open=fs.openSync,read=fs.readSync;
    let targetFd,swapped=false;
    vi.spyOn(fs,'openSync').mockImplementation((name,...args)=> {
      const fd=open(name,...args);
      if (name===target) targetFd=fd;
      return fd;
    });
    vi.spyOn(fs,'readSync').mockImplementation((fd,...args)=> {
      const count=read(fd,...args);
      if (fd===targetFd && count>0 && !swapped) {
        swapped=true;
        fs.renameSync(nested,path.join(base,'held'));
        fs.renameSync(replacement,nested);
      }
      return count;
    });
    const result=inspectPhysicalEvidence(file,inventory);
    expect(swapped).toBe(true);
    expect(result).toMatchObject({status:'invalid',certified:false});
    expect(result.errors).toContain('ARTIFACT_PATH_CHANGED');
  });
  it('requires unchanged artifact bytes',()=> {
    const f=fixture(),file=f.save(); fs.appendFileSync(path.join(f.root,'output.html'),'changed');
    expect(inspectPhysicalEvidence(file,inventory).errors).toContain('ARTIFACT_DIGEST_MISMATCH');
  });
  it.each(['0001234567895','00A<&\n','00A<&\r\nextra','0A<&\r\n'])('rejects substituted or normalized raw scan %j',value=> {
    const f=fixture(); f.bundle.symbols[0].scan=f.ref('wrong.txt',value,'text/plain');
    expect(f.check().errors).toContain('SCANNER_VALUE_MISMATCH');
  });
  it('does not coerce numeric source values to barcode strings',()=> {
    const f=fixture(); f.bundle.source=f.ref('numeric.json',{sampleData:{codes:{code128:123,ean13:'0001234567895'}}},'application/json');
    f.measurements.sourceDigest=f.bundle.source.digest;
    expect(f.check().status).toBe('invalid');
  });
  it('rejects SVG or label-only evidence even when renamed to PNG and rehashed',()=> {
    const f=fixture(); f.bundle.capture.artifact=f.ref('label.png','<svg><text>0001234567895</text></svg>','image/png');
    expect(f.check().errors).toContain('PHYSICAL_PHOTO_REQUIRED');
  });
  it('rejects direct digital screenshot provenance rather than upgrading it to physical acceptance',()=> {
    const f=fixture(); f.bundle.capture.method='browser-screenshot';
    expect(f.check().errors).toContain('PHYSICAL_CAPTURE_REQUIRED');
  });
  it('rejects operator self-attestation and source-author observation',()=> {
    for (const observer of ['synthetic-operator','synthetic-author']) {
      const f=fixture(); f.bundle.capture.observer=observer;
      expect(f.check().errors).toContain('INDEPENDENT_OBSERVER_REQUIRED');
    }
  });
  it('rejects foreign measurement custody and scanner digest',()=> {
    const f=fixture(); f.measurements.artifactDigest=`sha256:${'b'.repeat(64)}`;
    expect(f.check().errors).toContain('MEASUREMENT_IDENTITY_MISMATCH');
    f.measurements.artifactDigest=f.bundle.artifact.digest; f.measurements.symbols[0].scanDigest=`sha256:${'c'.repeat(64)}`;
    expect(f.check().errors).toContain('MEASURED_SYMBOL_IDENTITY');
  });
  it('requires observed quiet zones and rejects clipped physical output',()=> {
    const f=fixture(); f.measurements.symbols[0].quietLeftMm=1;
    expect(f.check().errors).toContain('PHYSICAL_QUIET_ZONE');
    f.measurements.symbols[0].quietLeftMm=6; f.measurements.clipped=true;
    expect(f.check().errors).toContain('MEASUREMENT_GEOMETRY');
  });
  it('requires both symbologies without duplicate symbol receipts',()=> {
    const f=fixture(); f.bundle.symbols[1]=f.bundle.symbols[0];
    expect(f.check().errors).toContain('SYMBOL_IDENTITY');
  });
  it('rejects extra authority claims and unknown fields',()=> {
    const f=fixture(); f.bundle.certified=true;
    expect(f.check().errors).toContain('EVIDENCE_FIELDS');
  });
  it.each(['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"constructor":{}}','{"__proto__":{}}','{"a":1} trailing'])('rejects ambiguous JSON %s',source=> {
    expect(()=>parsePhysicalJson(Buffer.from(source))).toThrow();
  });
  it('rejects malformed UTF-8 and overlarge metadata',()=> {
    expect(()=>parsePhysicalJson(Buffer.from([123,34,0xff,34,58,49,125]))).toThrow();
    expect(()=>parsePhysicalJson(Buffer.alloc(128*1024+1,32))).toThrow();
  });
});

describe('read-only physical inventory and argument boundaries',()=> {
  it('records CUPS no destinations as absence, not successful printing',()=> {
    const result=describePhysicalInventory([
      {id:'cups',file:'lpstat',args:['-p','-d'],exitCode:1,stdout:'no system default destination\n',stderr:'lpstat: No destinations added.\n'},
      {id:'usb',file:'system_profiler',args:['SPUSBDataType','-json'],exitCode:0,stdout:'{"SPUSBDataType":[]}',stderr:''}
    ]);
    expect(result.errors).toEqual([]); expect(result.prerequisites).toEqual(['NO_CONFIGURED_PRINTER','NO_USB_SCANNER_CANDIDATE']);
    expect(result.printers).toEqual([]); expect(result.usbCandidates).toEqual([]);
  });
  it('does not relabel USB presence as qualified scanner hardware',()=> {
    const result=describePhysicalInventory([
      {id:'cups',exitCode:0,stdout:'printer queue is idle. enabled since today\n',stderr:''},
      {id:'usb',exitCode:0,stdout:JSON.stringify({SPUSBDataType:[{_items:[{_name:'USB device',vendor_id:'0x0001',product_id:'0x0002',serial_num:'not-public'}]}]}),stderr:''}
    ]);
    expect(result.usbCandidates).toHaveLength(1); expect(JSON.stringify(result)).not.toContain('not-public');
    expect(result.scannerQualification).toBe('not-established-by-usb-enumeration');
  });
  it('distinguishes unavailable inventory from a confirmed empty list',()=> {
    expect(describePhysicalInventory([]).errors).toEqual(['CUPS_INVENTORY_UNAVAILABLE','USB_INVENTORY_UNAVAILABLE']);
  });
  it.each([[],['print'],['check','--approve'],['inventory','anything'],['check','x','y'],['check','']])('rejects unsupported CLI arguments %j',args=> {
    expect(()=>physicalArguments(args)).toThrow();
  });
  it('allows only inspection and missing-evidence reporting',()=> {
    expect(physicalArguments(['inventory'])).toEqual({command:'inventory'});
    expect(physicalArguments(['check'])).toEqual({command:'check',file:undefined});
    expect(physicalArguments(['check','bundle.json'])).toEqual({command:'check',file:'bundle.json'});
  });
});
