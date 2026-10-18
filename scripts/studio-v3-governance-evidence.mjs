import {createHash} from 'node:crypto';
import {canonical,digest} from './studio-v3-g8-corpus.mjs';
import {readUpstreamFile,parseUpstreamJson,verifyUpstreamSignature} from './studio-v3-upstream-evidence.mjs';

const same=(a,b)=>canonical(a)===canonical(b);
const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const known=value=>typeof value==='string' && value.length<=2000 && !!value.trim() && !/^(unknown|unavailable|auto|latest|default|none|null|unspecified|global|worldwide)(?:$|[-_ :])/i.test(value.trim());
const list=(value,max=32)=>Array.isArray(value) && value.length>0 && value.length<=max && value.every(known) && new Set(value).size===value.length;
const countries=new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '));
const countryList=value=>list(value) && value.every(code=>countries.has(code));
const day=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString().slice(0,10)===value;
const millis=value=>Number.isSafeInteger(value) && value>=0;
const kinds=['contract','disclosure-authority','route-configuration','privacy-controls','accountable-review'];
const scopeKeys=['operatorId','operatorLegalName','tenantId','tenantLegalName','route','provider','model','modelVersion'];
const https=value=>{
  try { const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname!=='/'; }
  catch { return false; }
};
const fail=code=>{throw Object.assign(new Error(code),{code});};

// Only explicit local artifacts; source URLs are locators, never network instructions.
export function readGovernanceArtifacts(bytes,base,readFile=readUpstreamFile) {
  const envelope=parseUpstreamJson(bytes),artifacts=[];
  const refs=envelope?.evidence?.statement?.artifacts;
  if (!Array.isArray(refs) || refs.length>8) fail('GOVERNANCE_ARTIFACT_COUNT');
  for (const ref of refs) {
    const item={id:ref?.id,errors:[]};
    if (!object(ref) || !/^sha256:[a-f0-9]{64}$/.test(ref.digest || '')) item.errors.push('source path/exact byte digest required');
    else {
      try {
        const content=readFile(base,ref.path);
        if (`sha256:${createHash('sha256').update(content).digest('hex')}`!==ref.digest) item.errors.push('source bytes/digest mismatch');
        else {
          try { item.text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(content); }
          catch { fail('INVALID_UTF8'); }
          if (item.text.includes('\0')) fail('GOVERNANCE_SOURCE_BINARY');
        }
      } catch (error) { item.errors.push(`source unreadable: ${error.code || 'INVALID_UTF8'}`); }
    }
    artifacts.push(item);
  }
  return {envelope,artifacts};
}

function leaves(value,prefix='',result=new Map()) {
  if (object(value) || Array.isArray(value)) for (const [key,next] of Object.entries(value)) leaves(next,`${prefix}/${key}`,result);
  else result.set(prefix,value);
  return result;
}
function sourceKinds(field) {
  if (field.startsWith('/scope/')) return ['/scope/route','/scope/provider','/scope/model','/scope/modelVersion'].includes(field)?['route-configuration']:['contract','disclosure-authority'];
  if (field==='/contract/disclosureAuthority') return ['disclosure-authority'];
  if (field.startsWith('/contract/')) return ['contract'];
  if (field.startsWith('/review/')) return ['accountable-review'];
  return ['privacy-controls','contract'];
}
function containsValue(quote,value) {
  const token=String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${token}($|[^A-Za-z0-9])`).test(quote);
}

// A signed, byte-backed dossier is reviewable, NOT proof of a lawful DPA or authority.
export function verifyGovernance({profile,inventory,profileValidation=[],now=Date.now()}) {
  const refs=inventory.prerequisites.filter(item=>item.id==='data-governance');
  const errors=profileValidation.map(()=> 'invalid frozen profile');
  for (const error of inventory.errors || []) errors.push(`invalid evidence inventory: ${error}`);
  const summary={status:refs.length || errors.length?'invalid':'missing',reviewable:false,productionQualified:false,authorityVerified:false,errors,sourceCount:0,checkedClaims:0};
  if (!refs.length) { errors.push('exactly one indexed data-governance declaration required');return summary; }
  if (refs.length!==1) errors.push('exactly one indexed data-governance declaration required');
  for (const ref of refs) errors.push(...(ref.errors || []));
  const loaded=refs[0]?.governance;
  if (!loaded) { errors.push('structured signed governance declaration and source bytes missing');return summary; }
  const {envelope,artifacts}=loaded,e=envelope?.evidence,s=e?.statement;
  if (!verifyUpstreamSignature(e,envelope?.signature,profile.collectorPublicKey)) errors.push('independent collector signature invalid/missing');
  if (e?.schema!=='studio-governance-evidence-v1' || s?.schema!=='studio-governance-statement-v1') errors.push('governance evidence/statement schema mismatch');
  if (e?.profileDigest!==digest(profile) || !same(e?.identity,profile.identity) || !same(e?.releaseIdentity,profile.releaseIdentity)) errors.push('exact frozen profile/release identity mismatch');
  if (!object(s) || !object(s.scope) || !object(s.controls) || !object(s.contract) || !object(s.review) || !Array.isArray(s.artifacts) || !Array.isArray(s.citations) || s.citations.length>200) {
    errors.push('malformed governance scope/controls/contract/review/artifacts/citations');return summary;
  }
  const {scope,controls,contract,review}=s,expected=inventory.governanceScope;
  if (!object(expected) || !same(scope,expected)) errors.push('explicit operator/tenant/route governanceScope absent or mismatched');
  if (Object.keys(scope).length!==scopeKeys.length || scopeKeys.some(key=>!known(scope[key]))) errors.push('concrete operator/tenant/provider/model scope required');
  if (!https(scope.route) || scope.route!==profile.identity?.provider_route || scope.modelVersion!==profile.identity?.model_version || !known(profile.identity?.model_version)) errors.push('route/modelVersion differs from exact frozen profile or is unknown');
  if (scope.provider===profile.modelAlias || scope.model===profile.modelAlias || /^demo[-_]/i.test(scope.provider)) errors.push('provider/model identity cannot be a demo route alias');
  if (!millis(now) || !millis(s.issuedAt) || !millis(s.expiresAt) || s.issuedAt>now || s.expiresAt<=now || s.expiresAt<=s.issuedAt) errors.push('declaration expired/future/invalid validity window');
  if (!day(contract.effectiveOn) || !day(contract.expiresOn) || Date.parse(contract.effectiveOn)>s.issuedAt || Date.parse(contract.expiresOn)<s.expiresAt) errors.push('contract validity does not cover declaration window');
  if (!known(contract.reference) || !known(contract.disclosureAuthority) || !list(contract.parties) || ![scope.operatorLegalName,scope.tenantLegalName,scope.provider].every(party=>contract.parties?.includes(party))) errors.push('applicable contract reference/parties/disclosure authority missing');
  if (!known(review.reviewerId) || !known(review.role) || review.decision!=='submitted-for-independent-review' || !millis(review.reviewedAt) || review.reviewedAt>s.issuedAt || review.reviewedAt<Date.parse(contract.effectiveOn)) errors.push('accountable review identity/decision/date invalid');
  if (!list(controls.dataClasses) || controls.dataClasses.some(value=>/^(all|any|everything|所有|全部)([-_ ]?data|资料|数据)?$/i.test(value.trim())) || !known(controls.purpose) || !known(controls.confidentiality)) errors.push('data classification/purpose/confidentiality missing');
  const training=controls.training;
  if (!object(training) || !['not-used','opt-in','used'].includes(training.operator) || !['not-used','opt-in','used'].includes(training.provider) || !known(training.conditions)) errors.push('explicit operator/provider training use and conditions required');
  if (!object(controls.countries) || !countryList(controls.countries.operator) || !countryList(controls.countries.provider)) errors.push('actual operator/provider ISO countries required; regions/global are insufficient');
  const retention=Array.isArray(controls.retention)?controls.retention:[],seen=new Set();
  for (const item of retention) {
    const key=`${item?.party}/${item?.system}`;
    if (!object(item) || !['operator','provider'].includes(item.party) || !['application-state','abuse-logs','backups'].includes(item.system) || seen.has(key) || !known(item.policy) || !known(item.deletionTrigger) || !millis(item.deleteWithinDays) || !known(item.exceptions)) errors.push('retention/deletion entry invalid, duplicate or incomplete');
    seen.add(key);
  }
  if (seen.size!==6 || retention.length!==6) errors.push('operator/provider application-state, abuse-logs and backups retention/deletion all required');
  const subs=controls.subprocessors,entries=Array.isArray(subs?.entries)?subs.entries:[];
  if (!object(subs) || !['listed','none'].includes(subs.mode) || !Array.isArray(subs.entries) || entries.length>32 || (subs.mode==='listed' && !entries.length) || (subs.mode==='none' && (entries.length || !known(subs.noneReason)))) errors.push('explicit subprocessor list or source-backed absence reason required');
  const subIds=new Set();
  for (const item of entries) {
    if (!object(item) || !known(item.id) || subIds.has(item.id) || !known(item.legalName) || !known(item.purpose) || !countryList(item.countries)) errors.push('subprocessor identity/purpose/actual countries invalid');
    subIds.add(item?.id);
  }
  const sources=new Map(),documents=new Map(),used=new Set();
  for (const item of artifacts) {
    for (const error of item.errors) errors.push(`source: ${error}`);
    documents.set(item.id,item.text);
  }
  for (const ref of s.artifacts) {
    if (!object(ref)) { errors.push('malformed source reference');continue; }
    if (!known(ref.id) || sources.has(ref.id) || !kinds.includes(ref.kind) || !https(ref.sourceUrl)) errors.push('duplicate/invalid source ID, kind or exact HTTPS locator');
    if (ref.scopeDigest!==digest(scope)) errors.push('source applicability scope digest mismatch');
    if (!millis(ref.capturedAt) || ref.capturedAt>review.reviewedAt || !day(ref.effectiveOn) || !day(ref.expiresOn) || Date.parse(ref.effectiveOn)>s.issuedAt || Date.parse(ref.expiresOn)<s.expiresAt || ref.capturedAt>Date.parse(ref.expiresOn)) errors.push('source capture/effective/expiry inconsistent with review/declaration');
    if (!documents.get(ref.id)) errors.push('referenced substantive source bytes missing');
    sources.set(ref.id,ref);
  }
  summary.sourceCount=sources.size;
  for (const kind of kinds) if (!s.artifacts.some(ref=>ref?.kind===kind)) errors.push(`required ${kind} source missing`);
  const fields=leaves({scope,controls,contract,review}),cited=new Set();
  for (const citation of s.citations) {
    const field=citation?.field,source=sources.get(citation?.source),text=documents.get(citation?.source),value=fields.get(field);
    if (!object(citation) || !fields.has(field) || cited.has(field) || !source || !sourceKinds(field).includes(source.kind) || !known(citation.quote) || !text?.includes(citation.quote) || !['string','number','boolean'].includes(typeof value) || !containsValue(citation.quote,value)) {
      errors.push('claim citation missing, duplicate, inapplicable or not present in actual source bytes');continue;
    }
    cited.add(field);used.add(source.id);
  }
  if (cited.size!==fields.size) errors.push('every scope/control/contract/accountable-review scalar requires an exact source quote');
  if (used.size!==sources.size) errors.push('every source must substantively support a declared claim');
  summary.checkedClaims=cited.size;
  summary.reviewable=errors.length===0;
  summary.status=summary.reviewable?'structured-for-independent-review':'invalid';
  return summary;
}
