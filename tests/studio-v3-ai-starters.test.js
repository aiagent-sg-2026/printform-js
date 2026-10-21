import {describe,it,expect} from 'vitest';
import { AIPanel } from '../studio-v3/ai-panel.js';

describe('AI-first panel grants',()=> {
  it.each(['What is the current heading font size?','Give the items table header row a light blue background','Improve the font sizes','Tighten the table spacing'])('grants design independent of wording: %s',request=> {
    expect(AIPanel.prototype.grantProfile({request,conversation:[]})).toBe('design');
  });
});
