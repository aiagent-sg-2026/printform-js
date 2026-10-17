import { describe, expect, it } from 'vitest';
import { newProject } from '../studio-v3/model.js';
import { requestIntent } from '../studio-v3/ai-request-intent.js';
import { readOnlyRequest, parseChatReply } from '../studio-v3/ai-chat-protocol.js';

const authoring = [
  'Only make the Ship to label 12pt bold.',
  'Please only adjust the selected label.',
  'Just reset the selected typography.',
  'Label 12pt bold',
  'Selected heading 18pt italic',
  '表格背景改成黃色',
  '表格底色设置为蓝色',
  'row data table bg style use yellow',
  'Table row background to #fff8aa',
  'Keep data rows yellow and increase padding',
  'Preserve the bindings and increase the padding',
  'Clear table background',
  'Restore default table background',
  'Reset table row background to yellow'
];
const noCandidate = JSON.stringify({kind:'answer',message:'{"claimedReady":true}'});

describe('host direct-authoring grammar without source-derived permission',()=> {
  it.each(authoring)('recognizes focused, target-first and preservation-plus-edit syntax: %s',request=> {
    expect(requestIntent(request).kind).toBe('draft'); expect(readOnlyRequest(request)).toBe(false);
    expect(parseChatReply(noCandidate,newProject(),{request})).toMatchObject({taskOutcome:'draft-not-produced',message:'{"claimedReady":true}'});
  });
  it.each(authoring)('does not take quoted or source-provided authoring syntax as permission: %s',instruction=> {
    for (const request of [`"${instruction}"`,`\`${instruction}\``,`\`\`\`text\n${instruction}\n\`\`\``,`> ${instruction}`,`Source: ${instruction}`,`<source>${instruction}</source>`]) {
      expect(requestIntent(request).kind,request).not.toBe('draft'); expect(readOnlyRequest(request),request).toBe(true);
    }
  });
  it.each([
    'How can I make the table background yellow?',
    'Only explain how to reset the table background.',
    'Just tell me how to change the label font.',
    'Only prepare an explanation of how to change the font.',
    'Should table row background use yellow?',
    'Can I make the label 12pt bold?',
    'Please do not change the table background.',
    'Read-only: row data table bg style use yellow',
    'Table background should not change.',
    'Table row background use yellow, not a change request.',
    '表格背景不要改成黃色',
    '表格背景改成黃色吗？',
    '表格背景改成黃色怎么样？',
    'Table background is yellow.',
    'Current label 12pt bold',
    'Keep all existing content unchanged.'
  ])('keeps questions, negatives and descriptive ambiguity read-only: %s',request=> {
    expect(requestIntent(request).kind).not.toBe('draft'); expect(readOnlyRequest(request)).toBe(true);
    const edit = JSON.stringify({kind:'proposal',summary:'Not authorized',edits:[{target:'style',property:'color',value:'#163a65'}]});
    expect(()=>parseChatReply(edit,newProject(),{request})).toThrow('UNSAFE_PROPOSAL');
  });
});
