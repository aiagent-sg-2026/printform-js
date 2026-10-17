import { describe, expect, it } from 'vitest';
import { cleanMessages } from '../studio-v3/ai-conversation.js';

const profile = {version:1,source:'user-supplied',name:'Fictional local printer',maxWidthMm:220,dpi:203};
const recover = diff => cleanMessages([{role:'assistant',text:'Candidate history only',time:1,status:'ready',taskOutcome:'draft-ready',diff:[diff]}])[0];

describe('expired private paper draft history preserves typed page properties',()=> {
  it.each([
    ['page.customSizeMm','(unset)',JSON.stringify({width:188.5,height:244.2})],
    ['page.customSizeMm',JSON.stringify({width:188.5,height:244.2}),'(unset)'],
    ['page.printerProfile','(unset)',JSON.stringify(profile)],
    ['page.printerProfile',JSON.stringify(profile),'(unset)']
  ])('recovers %s only as expired, never as an active Apply grant', (property,before,after)=> {
    const diff = {target:'document',property,before,after}, restored = recover(diff);
    expect(restored.status).toBe('expired'); expect(restored.diff).toEqual([diff]);
  });
  it.each([
    {property:'page.customSizeMm',after:'{"width":188.5,"height":244.2,"execute":"script"}'},
    {property:'page.customSizeMm',after:'{"width":0,"height":244.2}'},
    {property:'page.customSizeMm',after:'{"width":"188.5","height":244.2}'},
    {property:'page.customSizeMm',after:'null'},
    {property:'page.printerProfile',after:JSON.stringify({...profile,source:'discovered'})},
    {property:'page.printerProfile',after:JSON.stringify({...profile,dpi:0})},
    {property:'page.printerProfile',after:JSON.stringify({...profile,execute:'script'})}
  ])('rejects malformed typed page history: %j',({property,after})=> {
    expect(()=>recover({target:'document',property,before:'(unset)',after})).toThrow('INVALID_CHAT_RECOVERY');
  });
  it('does not grant a field permission to author page settings through recovery',()=> {
    expect(()=>recover({target:'customer-name',property:'page.customSizeMm',before:'(unset)',after:JSON.stringify({width:188.5,height:244.2})})).toThrow('INVALID_CHAT_RECOVERY');
  });
});
