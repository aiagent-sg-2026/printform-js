// Independent test oracle: never imports encoder/vendor, reads labels or data attributes.
// CODE128 standard run widths cross-referenced with ZXing JS v0.21.3 Code128Reader:
// https://github.com/zxing-js/library/blob/v0.21.3/src/core/oned/Code128Reader.ts
// Copyright 2008 ZXing authors; Apache-2.0, see ZXING-LICENSE.txt.
const CODE_WIDTHS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112'
];
const codePatterns = CODE_WIDTHS.map(widths => [...widths].map((n,i) => (i % 2 ? '0' : '1').repeat(Number(n))).join(''));
const LEFT = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EVEN = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
const invert = bits => [...bits].map(bit => bit === '1' ? '0' : '1').join('');

function decodeCode128(bits) {
  if (!bits.endsWith(codePatterns[106]) || (bits.length - 13) % 11) throw new Error('Invalid CODE128 stop/length');
  const codes = [];
  for (let i = 0; i < bits.length - 13; i += 11) {
    const code = codePatterns.indexOf(bits.slice(i,i + 11));
    if (code < 0) throw new Error('Invalid CODE128 symbol');
    codes.push(code);
  }
  const start = codes.shift(), checksum = codes.pop();
  if (![103,104,105].includes(start)) throw new Error('Invalid CODE128 start');
  if ((start + codes.reduce((sum,code,i) => sum + code * (i + 1),0)) % 103 !== checksum) throw new Error('Invalid CODE128 checksum');
  let set = start - 103, text = '', shifted = false;
  for (const code of codes) {
    const active = shifted ? 1 - set : set;
    shifted = false;
    if (active === 2 && code < 100) text += String(code).padStart(2,'0');
    else if (active !== 2 && code < 96) text += String.fromCharCode(active === 0 && code >= 64 ? code - 64 : code + 32);
    else if (code === 99 && active !== 2) set = 2;
    else if (code === 100 && active !== 1) set = 1;
    else if (code === 101 && active !== 0) set = 0;
    else if (code === 98 && active !== 2) shifted = true;
    else throw new Error('Unsupported CODE128 function character');
  }
  if (shifted) throw new Error('Truncated CODE128 shift');
  return text;
}

function decodeEan13(bits) {
  if (bits.length !== 95 || bits.slice(0,3) !== '101' || bits.slice(45,50) !== '01010' || bits.slice(92) !== '101') throw new Error('Invalid EAN13 guards');
  let parity = '', left = '', right = '';
  for (let i = 0; i < 6; i++) {
    const symbol = bits.slice(3 + i * 7,10 + i * 7);
    let digit = LEFT.indexOf(symbol);
    if (digit >= 0) parity += 'L';
    else { digit = EVEN.indexOf(symbol); parity += 'G'; }
    if (digit < 0) throw new Error('Invalid EAN13 left digit');
    left += digit;
    const other = LEFT.indexOf(invert(bits.slice(50 + i * 7,57 + i * 7)));
    if (other < 0) throw new Error('Invalid EAN13 right digit');
    right += other;
  }
  const first = PARITY.indexOf(parity);
  if (first < 0) throw new Error('Invalid EAN13 parity');
  const text = String(first) + left + right;
  if ([...text].reduce((sum,n,i) => sum + Number(n) * (i % 2 ? 3 : 1),0) % 10) throw new Error('Invalid EAN13 checksum');
  return text;
}

// Supply a horizontal raster row as 0=white / 1=black samples. This intentionally
// handles clean axis-aligned fixtures only; it is not a camera/scanner decoder.
export function decodeBarcodeRow(row, format) {
  const samples = Array.from(row, bit => bit ? '1' : '0').join('');
  const first = samples.indexOf('1'), last = samples.lastIndexOf('1');
  if (first < 0) throw new Error('No barcode bars');
  const runs = samples.slice(first,last + 1).match(/1+|0+/g);
  const unit = Math.min(...runs.map(run => run.length));
  if (runs.some(run => run.length % unit)) throw new Error('Nonuniform barcode modules');
  const quiet = format === 'EAN13' ? [11,7] : [10,10];
  if (first < unit * quiet[0] || samples.length - 1 - last < unit * quiet[1]) throw new Error('Insufficient barcode quiet zones');
  const bits = runs.map(run => run[0].repeat(run.length / unit)).join('');
  if (format === 'EAN13') return decodeEan13(bits);
  if (format === 'CODE128') return decodeCode128(bits);
  throw new Error('Unsupported barcode format');
}

// Geometry-only unit oracle, separate from the raster path used by browser tests.
export function decodeBarcodeSvg(svg, format) {
  const width = Number(svg.getAttribute('width')), row = new Uint8Array(width);
  for (const rect of svg.querySelectorAll('g rect')) {
    const start = Number(rect.getAttribute('x')), end = start + Number(rect.getAttribute('width'));
    for (let x = start; x < end; x++) row[x] = 1;
  }
  return decodeBarcodeRow(row,format);
}
