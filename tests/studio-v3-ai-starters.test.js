import {describe,it,expect} from 'vitest';
import {readOnlyRequest} from '../studio-v3/ai-chat-protocol.js';

describe('starting actions',()=> {
  it('still treats a genuine font question as read-only',()=> {
    expect(readOnlyRequest('What are the current font sizes?')).toBe(true);
  });
  it.each(['Improve the font sizes','Tighten the table spacing','Enhance the title font','Can you improve the font sizes?'])('%s is an edit',request=> {
    expect(readOnlyRequest(request)).toBe(false);
  });
});
