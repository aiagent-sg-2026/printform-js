import { describe, expect, it } from 'vitest';
import { adaptGlobe3ProgressClaim } from '../studio-v3/globe3-progress-claim-adapter.js';
import { createGlobe3RawProgressClaimProject } from '../studio-v3/globe3-progress-claim-project.js';
import { rawProgressClaimInput } from './fixtures/globe3-progress-claim.js';

const adapt = adaptGlobe3ProgressClaim;
describe('raw PCAR contract rejection boundaries', () => {
  it.each([
    ['wrong storage family', data => { data.header.cslsegm = 'entp_pcar'; }, 'GLOBE3_PCAR_TYPE'],
    ['wrong tab document', data => { data.workDoneRows[0].uniquenum_pri = 'another-claim'; }, 'GLOBE3_PCAR_SCOPE'],
    ['AP work-done panel', data => { data.workDoneRows[0].tag_tab_type = 'wd_detail'; }, 'GLOBE3_PCAR_TYPE'],
    ['foreign header company', data => { data.header.companyfn = 'another-company'; }, 'GLOBE3_PCAR_SCOPE'],
    ['foreign tab company', data => { data.workDoneRows[0].companyfn = 'another-company'; }, 'GLOBE3_PCAR_SCOPE'],
    ['foreign SO company', data => { data.salesHeaders[0].companyfn = 'another-company'; }, 'GLOBE3_PCAR_SCOPE'],
    ['foreign SO customer', data => { data.salesHeaders[0].party_unique = 'another-customer'; }, 'GLOBE3_PCAR_SCOPE'],
    ['foreign SO project', data => { data.salesLines[0].entprojfn = 'another-project'; }, 'GLOBE3_PCAR_SCOPE'],
    ['foreign certificate customer', data => { data.previousCertificates[0].header.party_unique = 'another-customer'; }, 'GLOBE3_PCAR_SCOPE'],
    ['different linked currency', data => { data.salesHeaders[0].curr_short_forex = 'USD'; }, 'GLOBE3_PCAR_CURRENCY'],
    ['different prior currency', data => { data.previousCertificates[0].header.curr_short_forex = 'USD'; }, 'GLOBE3_PCAR_CURRENCY'],
    ['different prior precision', data => { data.previousCertificates[0].header.curr_decimal = '2'; }, 'GLOBE3_PCAR_CURRENCY'],
    ['different prior measurement mode', data => { data.previousCertificates[0].workDoneMeasureKind = 'fraction'; }, 'GLOBE3_PCAR_PROFILE'],
    ['invalid source date', data => { data.header.date_trans = '2026-02-30'; }, 'GLOBE3_PCAR_DATE'],
    ['reversed period', data => { data.context.period.from = '2026-09-01'; }, 'GLOBE3_PCAR_DATE'],
    ['missing prior snapshot', data => { delete data.previousCertificates; }, 'GLOBE3_PCAR_ROWS'],
    ['unknown approval', data => { delete data.previousCertificates[0].header.tag_wflow_app_yn; }, 'GLOBE3_PCAR_APPROVAL'],
    ['inactive current claim', data => { data.header.tag_deleted_yn = 'de'; }, 'GLOBE3_PCAR_LIFECYCLE'],
    ['unknown lifecycle code', data => { data.workDoneRows[0].tag_deleted_yn = 'deleted'; }, 'GLOBE3_PCAR_LIFECYCLE'],
    ['unknown prior selector', data => { data.context.previousCertificateId = 'cert:missing'; }, 'GLOBE3_PCAR_BASELINE'],
    ['missing numeric profile', data => { delete data.context.numericSlotVariant; }, 'GLOBE3_PCAR_PROFILE'],
    ['unknown link profile', data => { data.context.linkProfile = 'auto'; }, 'GLOBE3_PCAR_PROFILE'],
    ['unknown measurement mode', data => { data.context.workDoneMeasureKind = 'auto'; }, 'GLOBE3_PCAR_PROFILE'],
    ['unknown Previous basis', data => { data.context.basisProfile = 'previous-application'; }, 'GLOBE3_PCAR_PROFILE'],
    ['absent selected slot', data => { delete data.workDoneRows[0].num_20_4_d0_002; data.workDoneRows[0].num_20_4_d_002 = '1250.1250'; }, 'GLOBE3_PCAR_SLOT'],
    ['duplicate work-done source', data => { data.workDoneRows.push(structuredClone(data.workDoneRows[0])); }, 'GLOBE3_PCAR_DUPLICATE'],
    ['duplicate line primary key', data => { data.salesLines.push(structuredClone(data.salesLines[0])); }, 'GLOBE3_PCAR_DUPLICATE'],
    ['missing exact SO header', data => { data.workDoneRows[0].var_50_001 = 'so:absent'; }, 'GLOBE3_PCAR_JOIN'],
    ['missing exact SO line', data => { data.workDoneRows[0].var_25_001 = 'line:absent'; }, 'GLOBE3_PCAR_JOIN'],
    ['ambiguous grouping key', data => { data.salesLines.push({ ...structuredClone(data.salesLines[0]), idcode: 103 }); }, 'GLOBE3_PCAR_JOIN'],
    ['nonfinite source figure', data => { data.workDoneRows[0].num_20_4_d0_002 = Infinity; }, 'GLOBE3_CLAIM_AMOUNT'],
    ['unsupported amount precision', data => { data.workDoneRows[0].num_20_4_d0_002 = '1.12345'; }, 'GLOBE3_CLAIM_AMOUNT_PRECISION'],
    ['unsafe source figure', data => { data.workDoneRows[0].num_20_4_d0_002 = '900719925474.0992'; }, 'GLOBE3_CLAIM_UNSAFE_AMOUNT'],
    ['too many work rows', data => { data.workDoneRows = Array.from({ length: 501 }, () => data.workDoneRows[0]); }, 'GLOBE3_PCAR_ROWS'],
    ['unused new-work assertion', data => { data.context.newWorkLines = [{ salesHeaderId: 'so:fictional-a', lineGroupKey: 'line:shared-group' }]; }, 'GLOBE3_PCAR_BASELINE']
  ])('rejects %s rather than guessing or certifying it', (_name, mutate, code) => {
    const data = rawProgressClaimInput(); mutate(data);
    expect(() => adapt(data)).toThrow(expect.objectContaining({ code }));
  });
  it('does not trust inherited/accessor/prototype keys in raw sources', () => {
    const inherited = rawProgressClaimInput(); inherited.workDoneRows[0] = Object.create(inherited.workDoneRows[0]);
    expect(() => adapt(inherited)).toThrow(expect.objectContaining({ code: 'GLOBE3_PCAR_JSON' }));
    const accessor = rawProgressClaimInput(); Object.defineProperty(accessor.context, 'company', { get: () => ({ id: 'company:fictional', name: 'Fake' }) });
    expect(() => adapt(accessor)).toThrow(expect.objectContaining({ code: 'GLOBE3_PCAR_JSON' }));
    const unsafe = rawProgressClaimInput(); unsafe.header = JSON.parse('{"__proto__":{"companyfn":"company:fictional"}}');
    expect(() => adapt(unsafe)).toThrow(expect.objectContaining({ code: 'GLOBE3_PCAR_JSON' }));
  });
  it('explicit zero source amounts remain a real line, not discarded as missing work', () => {
    const data = rawProgressClaimInput(); data.context.basisProfile = 'globe3-stored-last-claim';
    for (const key of Object.keys(data.workDoneRows[0]).filter(key => key.startsWith('num_'))) data.workDoneRows[0][key] = '0';
    const row = adapt(data).valuations[0];
    expect(row.no).toBe(1); expect(row.display.currentGross).toBe('SGD 0.0000');
    expect(row.source.linkedLinePrimaryKey).toBe(101);
  });
  it('raw header figures are not rounded or inferred from source work-done amounts', () => {
    const data = rawProgressClaimInput(); data.header.amount_forex = '271.4711';
    expect(() => adapt(data)).toThrow(expect.objectContaining({ code: 'GLOBE3_CLAIM_AMOUNT_PRECISION' }));
    delete data.header.amount_forex;
    expect(adapt(data).headerAmounts.some(row => row.column === 'amount_forex')).toBe(false);
  });
  it('normalizer can preserve other source currencies while Studio primary-currency limits stay explicit', () => {
    const data = rawProgressClaimInput(); data.header.curr_short_forex = 'AED';
    data.salesHeaders.forEach(row => { row.curr_short_forex = 'AED'; }); data.previousCertificates.forEach(cert => { cert.header.curr_short_forex = 'AED'; });
    expect(adapt(data).valuations[0].display.currentGross).toBe('AED 349.7500');
    expect(() => createGlobe3RawProgressClaimProject(data)).toThrow(expect.objectContaining({ code: 'GLOBE3_PCAR_CURRENCY' }));
  });
});
