import {describe,it,expect} from 'vitest';
import {barcodeOptions,validateBarcode,encodeBarcode,renderBarcode} from '../studio-v2/core/barcode.js';
import {decodeBarcodeSvg,decodeBarcodeRow} from './support/barcode-decode.js';

describe('offline string-preserving barcode encoding',()=> {
  it.each(['00001234','Abc-001',' A a 0 ','<>&"\'','123456789012345678901234567890'])('independently decodes CODE128 exactly: %s',value=> {
    const svg = renderBarcode(document,value,{format:'CODE128'});
    expect(decodeBarcodeSvg(svg,'CODE128')).toBe(value);
    expect(svg.querySelector('text').textContent).toBe(value);
    expect(svg.getAttribute('data-pf-barcode-source')).toBe(value);
    expect(svg.querySelector('script,img,foreignObject')).toBeNull();
    expect(svg.querySelector('g').getAttribute('fill')).toBe('#000');
  });
  it('preserves the full maximum-length CODE128 source rather than truncating it',()=> {
    const value = 'A'.repeat(128);
    expect(decodeBarcodeSvg(renderBarcode(document,value,{moduleWidth:1,displayValue:false}),'CODE128')).toBe(value);
  });
  it.each(['0001234567895','4006381333931','5901234123457','0000000000000'])('independently decodes EAN13 supplied digits: %s',value=> {
    const encoded = encodeBarcode(value,'EAN13');
    expect(encoded.bits).toHaveLength(95);
    expect(encoded.quietLeft).toBe(11); expect(encoded.quietRight).toBe(7);
    expect(decodeBarcodeSvg(renderBarcode(document,value,{format:'EAN13'}),'EAN13')).toBe(value);
  });
  it.each([1234567890123,1234,null,{},[],false,undefined])('never coerces source %o',value=> {
    expect(()=>validateBarcode(value,{format:'CODE128'})).toThrow('nonempty string');
    expect(()=>validateBarcode(value,{format:'EAN13'})).toThrow('nonempty string');
  });
  it.each(['','中文','é','\n','A\tB','A\x7f','\u00cf'])('rejects unsupported CODE128 source %j',value=> {
    expect(()=>validateBarcode(value)).toThrow();
  });
  it.each(['400638133393','4006381333930','04006381333931',' 4006381333931','4006381333931 ','４００６３８１３３３９３１','40063813339x1'])('rejects EAN13 without normalization %j',value=> {
    expect(()=>validateBarcode(value,{format:'EAN13'})).toThrow();
  });
  it('reports invalid EAN checksum separately from source length',()=> {
    try { validateBarcode('4006381333930',{format:'EAN13'}); throw new Error('accepted invalid check digit'); }
    catch (error) { expect(error.code).toBe('BARCODE_CHECKSUM'); }
  });
  it.each([{format:'EAN-13'},{format:'code128'},{moduleWidth:0},{moduleWidth:5},{moduleWidth:1.5},{moduleWidth:'2'},
    {height:15},{height:201},{height:NaN},{height:Infinity},{height:'48'},{displayValue:'false'},{text:'substitution'},null,[]])('rejects unsafe/invalid config %o',options=> {
    expect(()=>barcodeOptions(options)).toThrow();
  });
  it('retains strict options and allows hiding human-readable text',()=> {
    expect(barcodeOptions()).toEqual({format:'CODE128',moduleWidth:2,height:48,displayValue:true});
    const svg = renderBarcode(document,'00001',{moduleWidth:1,height:16,displayValue:false});
    expect(svg.querySelector('text')).toBeNull();
    expect(Number(svg.getAttribute('height'))).toBe(36);
    expect(decodeBarcodeSvg(svg,'CODE128')).toBe('00001');
  });
  it('allocates human-text width for dense numeric CODE128 without shrinking bars',()=> {
    const value = '00001234567890123456789012345678901234567890';
    const visible = renderBarcode(document,value,{moduleWidth:1});
    const hidden = renderBarcode(document,value,{moduleWidth:1,displayValue:false});
    expect(Number(visible.getAttribute('width'))).toBeGreaterThan(Number(hidden.getAttribute('width')));
    expect(Number(visible.querySelector('text').getAttribute('textLength'))).toBeLessThan(Number(visible.getAttribute('width')));
    expect([...visible.querySelectorAll('g rect')].map(rect=>rect.getAttribute('width'))).toEqual([...hidden.querySelectorAll('g rect')].map(rect=>rect.getAttribute('width')));
    expect(decodeBarcodeSvg(visible,'CODE128')).toBe(value);
  });
  it('escapes text and accessible source without HTML interpolation',()=> {
    const value = '<script>"&\'<>', svg = renderBarcode(document,value);
    expect(svg.querySelector('text').textContent).toBe(value);
    expect(svg.getAttribute('aria-label')).toBe(`CODE128: ${value}`);
    expect(svg.querySelector('script')).toBeNull();
    expect(svg.outerHTML).toContain('&lt;script&gt;');
  });
  it('independent oracle rejects missing quiet zones and corrupted geometry',()=> {
    expect(()=>decodeBarcodeRow([1,0,1],'EAN13')).toThrow('quiet zones');
    const svg = renderBarcode(document,'A');
    svg.querySelector('g rect').remove();
    expect(()=>decodeBarcodeSvg(svg,'CODE128')).toThrow();
  });
});
