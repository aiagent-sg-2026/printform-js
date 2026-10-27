import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';
const dir = path.resolve(import.meta.dirname, '../../gallery/designs/assets/demobank');
const d = JSON.parse(fs.readFileSync(path.join(dir,'data.json'),'utf8'));
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(dir,'money.js'),'utf8'), context);
const m = context.DemoMoney;

describe('PF-056 fictional DemoBank integer arithmetic', () => {
  it('derives every account independently, including CR signs, opening balances and minimum rounding', () => {
    const results = d.accounts.map(a => {
      let charges = 0, payments = 0, credits = 0;
      for (const t of a.transactions) {
        expect(Number.isSafeInteger(t.minor) && t.minor > 0).toBe(true);
        if (t.kind === 'charge') charges += t.minor;
        else if (t.kind === 'payment') payments += t.minor;
        else if (t.kind === 'credit') credits += t.minor;
        else throw new Error('Unknown transaction kind');
      }
      const closing = a.openingMinor + charges - payments - credits;
      const minimum = Math.min(closing, Math.max(2500, Math.ceil(closing / 20)));
      expect(a.openingMinor).not.toBe(charges);
      return {opening:a.openingMinor,charges,payments,credits,closing,minimum};
    });
    expect(results).toEqual([
      {opening:125000,charges:67050,payments:100000,credits:4200,closing:87850,minimum:4393},
      {opening:240000,charges:1200,payments:40000,credits:0,closing:201200,minimum:10060},
      {opening:86000,charges:0,payments:16000,credits:0,closing:70000,minimum:3500}
    ]);
    const actual = m.statement(d);
    expect(actual.accounts).toEqual(results);
    expect(actual.closing).toBe(359050); expect(actual.minimum).toBe(17953); expect(actual.limit).toBe(1600000);
    expect(results.reduce((n,a)=>n+a.closing,0)).toBe(actual.closing);
    expect(results.reduce((n,a)=>n+a.minimum,0)).toBe(actual.minimum);
  });
  it('checks dates, foreign conversion and the one posted fee', () => {
    const all = d.accounts.flatMap(a=>a.transactions);
    expect(all).toHaveLength(17); expect(new Set(all.map(t=>t.id)).size).toBe(17);
    for (const t of all) {
      expect(t.date <= t.posted && t.posted <= d.statementDate).toBe(true);
      expect(t.date).toMatch(/^2027-04-\d\d$/);
      if (t.foreign) {
        const f = t.foreign;
        expect(t.minor).toBe(Math.round(f.minor * f.rateNumerator / f.rateDenominator));
        expect(t.minor).toBe(9200); expect(f.currency).toBe('USD');
      }
    }
    expect(d.dueDate > d.statementDate).toBe(true);
    expect(all.filter(t=>t.category === 'Fee').map(t=>t.minor)).toEqual([1200]);
  });
  it('independently reconciles every synthetic repayment column to the cent', () => {
    const expected = [[6,3600,123600,20600,20600],[12,7200,127200,10600,10600],[18,10800,130800,7266,7278]];
    for (const [months,interest,total,regular,final] of expected) {
      const result = m.repayment(d.repayment, months);
      expect(result).toEqual({months,principal:120000,interest,total,regular,final});
      expect(interest).toBe(120000 * .06 * months / 12);
      expect(regular * (months - 1) + final).toBe(total);
      expect(total - interest).toBe(120000);
    }
  });
  it('handles minimum floor/cap, fractional cents, invalid values and integer range', () => {
    const a = {openingMinor:1000,transactions:[]};
    expect(m.account(a,d).minimum).toBe(1000);
    expect(m.account({...a,openingMinor:30000},d).minimum).toBe(2500);
    expect(m.roundRatio(87850,500,10000,true)).toBe(4393);
    expect(m.roundRatio(1,1,2)).toBe(1);
    for (const n of [-1,1.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) expect(()=>m.money(n)).toThrow();
    expect(()=>m.roundRatio(1,1,0)).toThrow(); expect(()=>m.repayment(d.repayment,0)).toThrow();
    expect(()=>m.account({openingMinor:0,transactions:[{kind:'invalid',minor:1}]},d)).toThrow();
  });
  it('ships synchronized reusable JSON and only original sample assets', () => {
    const generated = fs.readFileSync(path.join(dir,'data.js'),'utf8');
    const browser = vm.createContext({window:{}}); vm.runInContext(generated,browser);
    expect(JSON.stringify(browser.window.DEMOBANK_DATA)).toBe(JSON.stringify(d));
    expect(d.warning).toBe('SAMPLE DOCUMENT — NOT VALID FOR BANKING USE');
    expect(d.qrPayload).toBe('https://demobank.example/demo');
    expect(d.accounts.every(a=>/^XXXX XXXX XXXX D00[123]$/.test(a.masked))).toBe(true);
    for (const file of ['logo.svg','banner.svg','qr.svg','barcode.svg']) {
      const svg = fs.readFileSync(path.join(dir,file),'utf8');
      expect(svg).not.toMatch(/<image|<script|<foreignObject|xlink:href|https?:\/\/(?!www\.w3\.org)/);
    }
  });
});
