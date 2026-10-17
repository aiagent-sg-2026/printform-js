import { describe,it,expect } from 'vitest';
import { cleanMessages } from '../studio-v3/ai-conversation.js';

const message = diff => [{role:'assistant',text:'Historical human-review draft',time:1,status:'ready',diff}];
const barcode = {format:'EAN13',moduleWidth:2,height:48,displayValue:true};

describe('capability proposal history recovery',()=> {
  it('retains typed barcode settings and existing extra-table field diffs only as expired history',()=> {
    const diff = [
      {target:'footer-code',property:'kind',before:'bound',after:'barcode'},
      {target:'footer-code',property:'barcode',before:'(unset)',after:JSON.stringify(barcode)},
      {target:'table-operations-code',property:'label',before:'Source code',after:'Supplied code'},
      {target:'table-operations-code',property:'width',before:20,after:25}
    ];
    const restored=cleanMessages(message(diff));
    expect(restored[0].status).toBe('expired'); expect(restored[0].diff).toEqual(diff);
  });
  it.each([
    {format:'QR'}, {moduleWidth:1.5}, {moduleWidth:5}, {height:19}, {height:161},
    {height:'48'}, {displayValue:'true'}, {fetch:'https://example.invalid'}
  ])('rejects malformed barcode recovery instead of replaying arbitrary config %j',patch=> {
    const after=JSON.stringify({...barcode,...patch});
    expect(()=>cleanMessages(message([{target:'footer-code',property:'barcode',before:'(unset)',after}]))).toThrow('INVALID_CHAT_RECOVERY');
  });
  it.each([-1,0,101,'25',Infinity])('applies the existing column width boundary to extra-table history %j',after=> {
    expect(()=>cleanMessages(message([{target:'table-operations-code',property:'width',before:20,after}]))).toThrow('INVALID_CHAT_RECOVERY');
  });
  it('rejects prototype/injected targets and raw barcode objects',()=> {
    for (const target of ['table-operations/__proto__','table-operations-code<script>','table-'+'a'.repeat(80)]) {
      expect(()=>cleanMessages(message([{target,property:'barcode',before:'(unset)',after:JSON.stringify(barcode)}]))).toThrow('INVALID_CHAT_RECOVERY');
    }
    expect(()=>cleanMessages(message([{target:'footer-code',property:'barcode',before:'(unset)',after:barcode}]))).toThrow('INVALID_CHAT_RECOVERY');
  });
});
