import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseLosslessRecords} from '../studio-v3/structured-import-parser.js';
import {pointerTokens} from '../studio-v2/core/json.js';
import {validateBarcode} from '../studio-v2/core/barcode.js';

const LIMIT = 20*1024*1024;
const fail = code => { throw Object.assign(new Error(code),{code}); };
export const physicalDigest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const text = value => typeof value==='string' && value.length>0 && value.length<=240 && !/[\x00-\x1f\x7f]/.test(value);
const positive = value => typeof value==='number' && Number.isFinite(value) && value>0 && value<=10000;
const digest = value => typeof value==='string' && /^sha256:[a-f0-9]{64}$/.test(value);
const timestamp = value => typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && new Date(value).toISOString()===value;
function shape(value,keys,code) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length!==keys.length || keys.some(key=>!Object.hasOwn(value,key))) fail(code);
}
const sameFile = (left,right) => left.dev===right.dev && left.ino===right.ino;
function pathSnapshot(base,file) {
  const relative=path.relative(base,file);
  if (!relative || relative==='..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('ARTIFACT_PATH_ESCAPE');
  const contained = () => {
    if (fs.realpathSync(base)!==base || fs.realpathSync(file)!==file) fail('ARTIFACT_PATH_ESCAPE');
  };
  contained();
  let current=base;
  const paths=[base,...relative.split(path.sep).map(part=>(current=path.join(current,part)))];
  const stats=paths.map((entry,index)=> {
    const stat=fs.lstatSync(entry);
    if (stat.isSymbolicLink()) fail('ARTIFACT_SYMLINK');
    if (index<paths.length-1 && !stat.isDirectory()) fail('ARTIFACT_PATH_TYPE');
    return stat;
  });
  contained();
  return stats;
}
function requireSnapshot(base,file,expected,opened) {
  const actual=pathSnapshot(base,file);
  if (actual.length!==expected.length || actual.some((stat,index)=>!sameFile(stat,expected[index])) ||
    (opened && !sameFile(actual.at(-1),opened))) fail('ARTIFACT_PATH_CHANGED');
}
function readRegular(file,maxBytes=LIMIT,base=path.dirname(file)) {
  const expected=pathSnapshot(base,file);
  const fd = fs.openSync(file,fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size<1 || stat.size>maxBytes) fail('ARTIFACT_SIZE_OR_TYPE');
    // Check descriptor identity and the whole path again before consuming bytes.
    if (!sameFile(expected.at(-1),stat)) fail('ARTIFACT_PATH_CHANGED');
    requireSnapshot(base,file,expected,stat);
    const bytes = Buffer.allocUnsafe(stat.size+1);
    let count=0,read;
    while (count<bytes.length && (read=fs.readSync(fd,bytes,count,bytes.length-count,null))>0) count+=read;
    const after=fs.fstatSync(fd);
    if (count!==stat.size || after.size!==stat.size || after.mtimeMs!==stat.mtimeMs || after.ctimeMs!==stat.ctimeMs) fail('ARTIFACT_CHANGED_DURING_READ');
    requireSnapshot(base,file,expected,after);
    return bytes.subarray(0,count);
  } finally { fs.closeSync(fd); }
}
export function parsePhysicalJson(bytes) {
  if (bytes.length>128*1024) fail('JSON_SIZE_LIMIT');
  const value = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  parseLosslessRecords(value); // Existing duplicate/prototype/depth protections; no last-key-wins.
  return JSON.parse(value);
}
function reader(base) {
  let total=0;
  return ref => {
    shape(ref,['path','digest','mediaType'],'ARTIFACT_REFERENCE');
    if (!digest(ref.digest) || typeof ref.path!=='string' || ref.path.length>240 ||
      !ref.path.split('/').every(part=>/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part) && part!=='.' && part!=='..')) fail('ARTIFACT_PATH_OR_DIGEST');
    let file=base;
    for (const part of ref.path.split('/')) {
      file=path.join(file,part);
      if (fs.lstatSync(file).isSymbolicLink()) fail('ARTIFACT_SYMLINK');
    }
    const bytes=readRegular(file,LIMIT,base);
    total+=bytes.length;
    if (total>80*1024*1024) fail('BUNDLE_SIZE_LIMIT');
    if (physicalDigest(bytes)!==ref.digest) fail('ARTIFACT_DIGEST_MISMATCH');
    return bytes;
  };
}
const referenceType = (ref,type) => { if (ref?.mediaType!==type) fail('ARTIFACT_MEDIA_TYPE'); };
function photo(bytes,type) {
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=bytes.length>4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes.at(-2)===255 && bytes.at(-1)===217;
  if (!((type==='image/png' && png) || (type==='image/jpeg' && jpeg))) fail('PHYSICAL_PHOTO_REQUIRED');
}
function sourceValue(source,pointer) {
  let value=source;
  for (const key of pointerTokens(pointer)) {
    if (!value || typeof value!=='object' || !Object.hasOwn(value,key)) fail('SOURCE_POINTER_MISSING');
    value=value[key];
  }
  return value;
}
function inspectBundle(bundle,load,inventory) {
  shape(bundle,['schema','id','sourceAuthor','source','artifact','printer','scanner','media','print','capture','measurements','symbols'],'EVIDENCE_FIELDS');
  if (bundle.schema!=='studio-physical-evidence-v1' || !text(bundle.id) || !text(bundle.sourceAuthor)) fail('EVIDENCE_IDENTITY');
  shape(bundle.printer,['queue','model','dpi'],'PRINTER_FIELDS');
  shape(bundle.scanner,['usbId','model','firmware','mode'],'SCANNER_FIELDS');
  shape(bundle.media,['id','type','widthMm','heightMm'],'MEDIA_FIELDS');
  shape(bundle.print,['operator','printedAt','scalePercent'],'PRINT_FIELDS');
  shape(bundle.capture,['observer','method','capturedAt','artifact'],'CAPTURE_FIELDS');
  const {printer,scanner,media,print,capture}=bundle;
  if (![printer.queue,printer.model,scanner.model,scanner.firmware,media.id,media.type,print.operator,capture.observer].every(text) ||
    ![printer.dpi,media.widthMm,media.heightMm].every(positive) || !digest(scanner.usbId) || scanner.mode!=='hardware-barcode-reader') fail('DEVICE_OR_MEDIA_IDENTITY');
  if (!timestamp(print.printedAt) || !timestamp(capture.capturedAt) || capture.capturedAt<print.printedAt || Date.parse(capture.capturedAt)>Date.now()) fail('CAPTURE_TIME');
  if (print.scalePercent!==100) fail('PRINT_SCALE_NOT_100');
  if (capture.method!=='camera-photo-of-physical-sheet') fail('PHYSICAL_CAPTURE_REQUIRED');
  if (capture.observer===print.operator || capture.observer===bundle.sourceAuthor) fail('INDEPENDENT_OBSERVER_REQUIRED');
  referenceType(bundle.source,'application/json');
  const source=parsePhysicalJson(load(bundle.source));
  const artifact=load(bundle.artifact);
  if (!(bundle.artifact.mediaType==='text/html' && /^\s*<!doctype html/i.test(artifact.toString('utf8'))) &&
    !(bundle.artifact.mediaType==='application/pdf' && artifact.subarray(0,5).toString()==='%PDF-')) fail('PRINT_ARTIFACT_REQUIRED');
  const photoBytes=load(capture.artifact); photo(photoBytes,capture.artifact.mediaType);
  if ([bundle.source.digest,bundle.artifact.digest].includes(capture.artifact.digest)) fail('CAPTURE_NOT_INDEPENDENT');
  referenceType(bundle.measurements,'application/json');
  const measured=parsePhysicalJson(load(bundle.measurements));
  shape(measured,['schema','evidenceId','sourceDigest','artifactDigest','captureDigest','printerQueue','scannerUsbId','mediaId','observer','measuredAt','instrument','mediaWidthMm','mediaHeightMm','clipped','symbols'],'MEASUREMENT_FIELDS');
  if (measured.schema!=='physical-measurement-v1' || measured.evidenceId!==bundle.id || measured.sourceDigest!==bundle.source.digest ||
    measured.artifactDigest!==bundle.artifact.digest || measured.captureDigest!==capture.artifact.digest || measured.printerQueue!==printer.queue ||
    measured.scannerUsbId!==scanner.usbId || measured.mediaId!==media.id || measured.observer!==capture.observer) fail('MEASUREMENT_IDENTITY_MISMATCH');
  shape(measured.instrument,['id','model','calibratedAt'],'INSTRUMENT_FIELDS');
  if (!text(measured.instrument.id) || !text(measured.instrument.model) || !timestamp(measured.instrument.calibratedAt) ||
    !timestamp(measured.measuredAt) || measured.measuredAt<capture.capturedAt || measured.measuredAt<measured.instrument.calibratedAt || Date.parse(measured.measuredAt)>Date.now()) fail('MEASUREMENT_PROVENANCE');
  if (!positive(measured.mediaWidthMm) || !positive(measured.mediaHeightMm) || measured.clipped!==false) fail('MEASUREMENT_GEOMETRY');
  if (!Array.isArray(bundle.symbols) || bundle.symbols.length<2 || bundle.symbols.length>16 || !Array.isArray(measured.symbols) || measured.symbols.length!==bundle.symbols.length) fail('SYMBOL_COVERAGE');
  const seen=new Set(),formats=new Set(),observations=[];
  for (const symbol of bundle.symbols) {
    shape(symbol,['id','format','pointer','scan','terminator'],'SYMBOL_FIELDS');
    if (!text(symbol.id) || seen.has(symbol.id) || !['CODE128','EAN13'].includes(symbol.format) || !['none','LF','CRLF','CR'].includes(symbol.terminator)) fail('SYMBOL_IDENTITY');
    seen.add(symbol.id); formats.add(symbol.format);
    const expected=sourceValue(source,symbol.pointer); validateBarcode(expected,{format:symbol.format});
    referenceType(symbol.scan,'text/plain');
    const raw=load(symbol.scan),suffix={none:'',LF:'\n',CRLF:'\r\n',CR:'\r'}[symbol.terminator];
    if (!raw.equals(Buffer.from(expected+suffix,'utf8'))) fail('SCANNER_VALUE_MISMATCH');
    const rows=measured.symbols.filter(item=>item?.id===symbol.id);
    if (rows.length!==1) fail('MEASURED_SYMBOL_MISSING_OR_DUPLICATE');
    const row=rows[0];
    shape(row,['id','format','scanDigest','moduleWidthMm','barHeightMm','quietLeftMm','quietRightMm'],'MEASURED_SYMBOL_FIELDS');
    if (row.format!==symbol.format || row.scanDigest!==symbol.scan.digest || ![row.moduleWidthMm,row.barHeightMm,row.quietLeftMm,row.quietRightMm].every(positive)) fail('MEASURED_SYMBOL_IDENTITY');
    const [left,right]=symbol.format==='EAN13'?[11,7]:[10,10];
    if (row.quietLeftMm<left*row.moduleWidthMm || row.quietRightMm<right*row.moduleWidthMm) fail('PHYSICAL_QUIET_ZONE');
    observations.push({id:symbol.id,format:symbol.format,decodedValue:new TextDecoder('utf-8',{fatal:true}).decode(raw).slice(0,expected.length),scanDigest:symbol.scan.digest,
      observedModuleWidthMm:row.moduleWidthMm,observedBarHeightMm:row.barHeightMm});
  }
  if (formats.size!==2) fail('BOTH_FORMATS_REQUIRED');
  const missing=[...(inventory.errors || []),
    ...(!inventory.printers.some(item=>item.queue===printer.queue)?['PRINTER_NOT_PRESENT']:[]),
    ...(!inventory.usbCandidates.some(item=>item.id===scanner.usbId)?['SCANNER_NOT_PRESENT']:[])];
  return {status:missing.length?'no-device':'supplied-for-independent-review',errors:[],missing,observations,
    identity:{id:bundle.id,sourceDigest:bundle.source.digest,artifactDigest:bundle.artifact.digest,captureDigest:capture.artifact.digest,measurementDigest:bundle.measurements.digest}};
}

export function inspectPhysicalEvidence(indexPath,inventory) {
  const boundary={physicalGate:'missing',certified:false,authority:'local-byte-and-consistency-check-only',
    requiredReview:['Independently inspect the original sheet, camera provenance, instrument readings and scanner capture custody.','USB presence and authored JSON do not prove printing or scanning.']};
  if (!indexPath) return {...boundary,status:'missing',errors:[],missing:['EVIDENCE_BUNDLE_REQUIRED',...(inventory.prerequisites || []),...(inventory.errors || [])]};
  try {
    const absolute=path.resolve(indexPath),base=fs.realpathSync(path.dirname(absolute));
    const bytes=readRegular(path.join(base,path.basename(absolute)),128*1024),bundle=parsePhysicalJson(bytes);
    const result=inspectBundle(bundle,reader(base),inventory);
    return {...boundary,...result,evidenceDigest:physicalDigest(bytes),physicalGate:result.status==='supplied-for-independent-review'?'independent-review-required':'missing'};
  } catch (error) {
    return {...boundary,status:'invalid',errors:[error.code || 'INVALID_EVIDENCE'],missing:[]};
  }
}
