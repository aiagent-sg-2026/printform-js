import { describe, expect, it } from 'vitest';
import { adaptGlobe3CertifiedClaim } from '../studio-v3/globe3-claim-adapter.js';
import { parseClaimAmount } from '../studio-v3/globe3-claim-money.js';
import { financialBlock, globe3ClaimInput } from './fixtures/globe3-certified-claim.js';

function reject(input, code, path) {
  let caught;
  try { adaptGlobe3CertifiedClaim(input); } catch (error) { caught = error; }
  expect(caught, 'Expected fail-closed adaptation').toBeInstanceOf(Error);
  expect(caught.code).toBe(`GLOBE3_CLAIM_${code}`);
  expect(caught.path).toBe(path);
  expect(caught.message).toContain(path);
}

describe('Globe3 identity and required reference checks', () => {
  it.each(['entp_pbill', 'PCAR', 'CCAR', 'entp_pcap'])('rejects unsupported header code %s rather than interpreting its abbreviation', code => {
    const input = globe3ClaimInput();
    input.header.tag_table_usage = code;
    reject(input, 'TYPE', 'header.tag_table_usage');
  });

  it('rejects mixed header and tab transaction types', () => {
    const input = globe3ClaimInput();
    input.header.cslsegm = 'entp_pbill';
    reject(input, 'TYPE', 'header.cslsegm');
    input.header.cslsegm = 'entp_pcar';
    input.tabData[0].tag_table_usage = 'entp_pbill';
    reject(input, 'TYPE', 'tabData[0].tag_table_usage');
  });

  it.each([
    ['uniquenum_pri', 'MISSING_REFERENCE'], ['dnum_auto', 'MISSING_REFERENCE'],
    ['dnum_master', 'MISSING_REFERENCE'], ['dnum_reference', 'MISSING_REFERENCE'],
    ['date_trans', 'MISSING_REFERENCE'], ['curr_short_forex', 'MISSING_REFERENCE'], ['curr_decimal', 'PRECISION']
  ])('fails with the missing header field path %s', (key, code) => {
    const input = globe3ClaimInput();
    delete input.header[key];
    reject(input, code, `header.${key}`);
  });

  it('preserves explicitly blank reference and terms without manufacturing a due date', () => {
    const input = globe3ClaimInput();
    input.header.dnum_reference = '';
    input.header.creditterm_desc = '';
    const data = adaptGlobe3CertifiedClaim(input);
    expect(data.document.reference).toBe('');
    expect(data.document.creditTerms).toBe('');
    expect(data.document).not.toHaveProperty('dueDate');
  });

  it.each(['company', 'customer', 'project'])('requires explicit %s master identity and name', key => {
    const input = globe3ClaimInput();
    delete input.context[key];
    reject(input, 'INPUT', `context.${key}`);
    input.context[key] = { name: 'Fictional master' };
    reject(input, 'MISSING_REFERENCE', `context.${key}.id`);
    input.context[key] = { id: 'fictional:id' };
    reject(input, 'MISSING_REFERENCE', `context.${key}.name`);
  });

  it('requires a supplied period and rejects invalid calendar dates or reversed periods', () => {
    const input = globe3ClaimInput();
    delete input.context.period;
    reject(input, 'INPUT', 'context.period');
    input.context.period = { from: '2026-02-30', to: '2026-08-15' };
    reject(input, 'DATE', 'context.period.from');
    input.context.period = { from: '2026-08-16', to: '2026-08-15' };
    reject(input, 'DATE', 'context.period');
  });

  it.each([
    ['companyfn', 'another-company'], ['documentId', 'another-document'],
    ['party_unique', 'another-customer'], ['entprojfn', 'another-project']
  ])('rejects conflicting supplied header identity %s', (key, value) => {
    const input = globe3ClaimInput();
    input.header[key] = value;
    reject(input, 'IDENTITY', `header.${key}`);
  });

  it.each(['companyfn', 'documentId', 'uniquenum_pri'])('rejects cross-company or mixed-document tab records using %s', key => {
    const input = globe3ClaimInput();
    input.tabData[3][key] = 'other:fictional';
    reject(input, 'IDENTITY', `tabData[3].${key}`);
  });

  it('accepts upstream-scoped rows without optional envelope identities, without claiming authorization', () => {
    const input = globe3ClaimInput();
    delete input.header.companyfn;
    for (const row of input.tabData) { delete row.companyfn; delete row.documentId; }
    expect(adaptGlobe3CertifiedClaim(input).financialRows).toHaveLength(17);
  });

  it('rejects incomplete certification and a parent application mismatch', () => {
    const input = globe3ClaimInput();
    input.context.certification = { applicationId: 'application:fictional' };
    reject(input, 'MISSING_REFERENCE', 'context.certification.applicationNumber');
    Object.assign(input.context.certification, { applicationNumber: 'PCAR-FICTIONAL', date: '2026-08-17', certifiedBy: 'Fictional QS', status: 'Certified' });
    input.header.uniquenum_sec = 'another-application';
    reject(input, 'IDENTITY', 'context.certification.applicationId');
    input.header.uniquenum_sec = 'application:fictional';
    input.header.tag_datasource = 'sal_inv';
    reject(input, 'TYPE', 'header.tag_datasource');
  });

  it('rejects unsupported receivable currency and null rather than defaulting to zero', () => {
    const input = globe3ClaimInput();
    input.context.receivable = { currency: 'USD', paidAmount: '5.00' };
    reject(input, 'IDENTITY', 'context.receivable.currency');
    input.context.receivable = { paidAmount: null };
    reject(input, 'AMOUNT', 'context.receivable.paidAmount');
  });
});

describe('Globe3 main and additional block failures are locatable', () => {
  it('rejects absent and ambiguous main blocks', () => {
    const input = globe3ClaimInput();
    const main = input.tabData.shift();
    reject(input, 'MAIN_BLOCK', 'tabData');
    input.tabData.unshift(main, { ...main });
    reject(input, 'MAIN_BLOCK', 'tabData');
  });

  it.each(['entp_pcar_ma', 'entp_pcar_ms', 'wd_detail_soc', 'addr_ext', 'entp_pbill'])('does not fabricate support for %s', section => {
    const input = globe3ClaimInput();
    input.tabData.push(financialBlock(section, [['Unknown source semantics', '0.00']]));
    reject(input, 'UNSUPPORTED_RECORD', 'tabData[7].tag_tab_type');
  });

  it('rejects missing main labels, amounts and document FK reference', () => {
    const input = globe3ClaimInput();
    delete input.tabData[0].var_100_005;
    reject(input, 'MISSING_REFERENCE', 'tabData[0].var_100_005');
    input.tabData[0].var_100_005 = 'Retention';
    delete input.tabData[0].num_20_2_d0_005;
    reject(input, 'MISSING_AMOUNT_COLUMN', 'tabData[0].num_20_2_d0_005');
    input.tabData[0].num_20_2_d0_005 = 0;
    delete input.tabData[0].uniquenum_pri;
    reject(input, 'MISSING_REFERENCE', 'tabData[0].uniquenum_pri');
  });

  it('accepts shared document FK values but rejects undocumented active financial slots', () => {
    const input = globe3ClaimInput();
    const data = adaptGlobe3CertifiedClaim(input);
    expect(new Set(data.financialRows.map(row => row.sourceDocumentId))).toEqual(new Set([input.header.uniquenum_pri]));
    expect(new Set(data.financialRows.map(row => row.id)).size).toBe(17);
    input.tabData[0].num_20_2_d0_011 = '2.00';
    reject(input, 'UNSUPPORTED_RECORD', 'tabData[0].num_20_2_d0_011');
    delete input.tabData[0].num_20_2_d0_011;
    input.tabData[3].var_100_002 = 'Unknown second omission';
    input.tabData[3].num_20_2_d0_002 = '2.00';
    reject(input, 'UNSUPPORTED_RECORD', 'tabData[3].var_100_002');
  });

  it('handles unused zero slots but rejects unlabeled nonzero amounts and empty blocks', () => {
    const input = globe3ClaimInput();
    input.tabData[1].num_20_2_d0_010 = '0.00';
    expect(adaptGlobe3CertifiedClaim(input).financialRows).toHaveLength(17);
    input.tabData[1].num_20_2_d0_010 = '1.00';
    reject(input, 'MISSING_REFERENCE', 'tabData[1].var_100_010');
    input.tabData[1] = financialBlock('entp_pcar_mb', []);
    reject(input, 'EMPTY_BLOCK', 'tabData[1]');
  });
});

describe('Globe3 supplied money precision and numeric safety', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])('preserves currency precision %s rather than imposing ISO defaults', precision => {
    const input = globe3ClaimInput();
    input.header.curr_decimal = precision;
    input.tabData = [input.tabData[0]];
    const amount = precision ? `1.${'2'.repeat(precision)}` : '12.00';
    for (let slot = 1; slot <= 10; slot++) input.tabData[0][`num_20_2_d0_${String(slot).padStart(3, '0')}`] = amount;
    const data = adaptGlobe3CertifiedClaim(input);
    expect(data.summary.total).toBe(Number(amount));
    expect(data.document.sourcePrecision).toBe(precision);
    expect(data.summary.displayAmounts.total).toBe(`SGD ${precision ? amount : '12'}`);
  });

  it.each([-1, 7, 15, 2.5, null, '', '02', '2.0', 'n/a', true])('rejects invalid or unsupported precision %s', precision => {
    const input = globe3ClaimInput();
    input.header.curr_decimal = precision;
    reject(input, 'PRECISION', 'header.curr_decimal');
  });

  it('accepts finite decimal numbers, grouped strings and insignificant trailing zeroes without rounding', () => {
    expect(parseClaimAmount(0.1, 2, 'amount')).toEqual({ amount: 0.1, amountMinor: 10, amountRaw: '0.1' });
    expect(parseClaimAmount(' 1,234.5600 ', 2, 'amount')).toEqual({ amount: 1234.56, amountMinor: 123456, amountRaw: ' 1,234.5600 ' });
    expect(parseClaimAmount('-0.00', 2, 'amount')).toMatchObject({ amountRaw: '-0.00', amountMinor: 0 });
    expect(parseClaimAmount('9007199254740991', 0, 'amount').amountMinor).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseClaimAmount('0.000001', 6, 'amount').amountMinor).toBe(1);
  });

  it.each(['12.345', 0.1 + 0.2, '1.005', '-0.001'])('rejects extra nonzero decimals instead of silently losing %s', amount => {
    const input = globe3ClaimInput();
    input.tabData[0].num_20_2_d0_001 = amount;
    reject(input, 'AMOUNT_PRECISION', 'tabData[0].num_20_2_d0_001');
  });

  it.each(['9007199254740992', '90071992547409.91', '-90071992547409.91', '999999999999999.99'])('rejects unsafe integer units or lossy binding numbers for %s', amount => {
    const input = globe3ClaimInput();
    input.tabData[0].num_20_2_d0_001 = amount;
    reject(input, 'UNSAFE_AMOUNT', 'tabData[0].num_20_2_d0_001');
  });

  it.each(['1e2', '12,34.56', 'NaN', 'Infinity', '', '12.30x', Infinity, NaN, null, {}, true])('rejects malformed or missing amount %s', amount => {
    const input = globe3ClaimInput();
    input.tabData[0].num_20_2_d0_001 = amount;
    reject(input, 'AMOUNT', 'tabData[0].num_20_2_d0_001');
  });
});

describe('Globe3 explicit cross-tenant numeric profiles and own fields', () => {
  function alternate(input) {
    input.context.numericSlotPrefix = 'num_20_2_d_';
    for (const row of input.tabData) {
      for (const key of Object.keys(row)) {
        if (!key.startsWith('num_20_2_d0_')) continue;
        row[key.replace('num_20_2_d0_', 'num_20_2_d_')] = row[key];
        delete row[key];
      }
    }
    return input;
  }

  it('uses a complete explicitly selected alternate profile without a d0 fallback', () => {
    const input = alternate(globe3ClaimInput()), data = adaptGlobe3CertifiedClaim(input);
    expect(data.summary.numericSlotPrefix).toBe('num_20_2_d_');
    expect(data.summary.total).toBe(3790.47);
    expect(data.financialRows[0].column).toBe('num_20_2_d_001');
    expect(data.financialRows).toHaveLength(17);
    delete input.context.numericSlotPrefix;
    reject(input, 'MISSING_AMOUNT_COLUMN', 'tabData[0].num_20_2_d0_001');
  });

  it('fails explicitly when a four-slot tenant cannot supply the ten-slot main contract', () => {
    const input = alternate(globe3ClaimInput());
    for (let slot = 5; slot <= 10; slot++) delete input.tabData[0][`num_20_2_d_${String(slot).padStart(3, '0')}`];
    reject(input, 'MISSING_AMOUNT_COLUMN', 'tabData[0].num_20_2_d_005');
  });

  it('rejects conflicting values across both profiles even when the prefix is explicit', () => {
    const input = globe3ClaimInput();
    input.tabData[0].num_20_2_d_001 = '13.00';
    reject(input, 'AMBIGUOUS_AMOUNT', 'tabData[0].num_20_2_d_001');
    input.context.numericSlotPrefix = 'num_20_2_d0_';
    reject(input, 'AMBIGUOUS_AMOUNT', 'tabData[0].num_20_2_d_001');
    input.tabData[0].num_20_2_d_001 = input.tabData[0].num_20_2_d0_001;
    expect(adaptGlobe3CertifiedClaim(input).summary.contractValue).toBe(12345.67);
  });

  it.each(['num_20_4_d_', 'num_20_2_', '', null, {}])('rejects unsupported profile %s', prefix => {
    const input = globe3ClaimInput();
    input.context.numericSlotPrefix = prefix;
    reject(input, 'NUMERIC_PROFILE', 'context.numericSlotPrefix');
  });

  it('does not accept inherited reference or numeric fields as supplied raw columns', () => {
    const input = globe3ClaimInput();
    const inheritedHeader = Object.create({ dnum_reference: input.header.dnum_reference });
    Object.assign(inheritedHeader, input.header);
    delete inheritedHeader.dnum_reference;
    input.header = inheritedHeader;
    reject(input, 'MISSING_REFERENCE', 'header.dnum_reference');
    input.header = globe3ClaimInput().header;
    const inheritedRow = Object.create({ num_20_2_d0_001: input.tabData[0].num_20_2_d0_001 });
    Object.assign(inheritedRow, input.tabData[0]);
    delete inheritedRow.num_20_2_d0_001;
    input.tabData[0] = inheritedRow;
    reject(input, 'MISSING_AMOUNT_COLUMN', 'tabData[0].num_20_2_d0_001');
  });
});
