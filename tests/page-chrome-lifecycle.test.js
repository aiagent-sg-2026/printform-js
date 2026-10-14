import { describe, it, expect, vi } from 'vitest';
import { attachRenderingMethods } from '../src/printform/formatter/rendering.js';
import { renderRows } from '../src/printform/formatter/pagination-render-rows.js';
import { DomHelpers } from '../src/printform/dom.js';

class Formatter {
  constructor() {
    this.config = { repeatHeader: true, repeatDocinfo: false, repeatRowheader: true };
    this.currentPage = 1;
  }
  getRowTableId() { return 'default'; }
  registerPageNumberClone() {}
}
attachRenderingMethods(Formatter);
function fixture() {
  const source = document.createElement('div');
  source.innerHTML = '<div class="pheader_processed">Company INVOICE</div><div class="pdocinfo_processed">First page only</div><div class="prowheader_processed"><table><tr><th>Item</th></tr></table></div><div class="prowitem">row 0</div><div class="prowitem">row 1</div>';
  return { header: source.children[0], docInfos: [{element:source.children[1],className:'pdocinfo',repeatFlag:'repeatDocinfo',key:'docinfo'}], rowHeader:source.children[2], rows:[...source.querySelectorAll('.prowitem')] };
}
describe('page chrome lifecycle', () => {
  it('does not reinitialize continuation chrome when measured body height clamps to zero', () => {
    const f = new Formatter(), sections = fixture(), output = document.createElement('div');
    output.innerHTML = '<section></section>';
    Object.assign(f, {
      initializePageContext:()=>({limit:100,repeatingHeight:0,tableId:'default',skipRowHeader:false}), refreshPageContextForRow:()=>{},
      getCurrentPageContainer:()=>output.lastElementChild,
      computeRepeatingHeightForPage:()=>200,
      // First row overflows; continuation body measurement legitimately clamps
      // to zero even after placement (e.g. a redesigned overlapping layout).
      measureContentHeight:vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(110).mockReturnValue(0),
      getRowBaseClass:()=> 'prowitem', isPtacRow:()=>false, isPaddtRow:()=>false,
      isSubtotalRow:()=>false, isFooterRow:()=>false,
      shouldSkipRowHeaderForRow:()=>false, shouldSkipDummyRowItemsForContext:()=>true,
      prepareNextPage:()=> {
        f.currentPage++; output.appendChild(document.createElement('section'));
        f.appendRepeatingSections(output.lastElementChild,sections,null,false);
        return 0;
      }
    });
    const spy = vi.spyOn(DomHelpers,'measureHeight').mockReturnValue(60);
    try { renderRows.call(f,output,sections,{header:200,docInfos:{}},{},100,null,null); }
    finally { spy.mockRestore(); }
    const continuation = output.lastElementChild;
    expect(continuation.querySelectorAll('.pheader_processed')).toHaveLength(1);
    expect(continuation.querySelectorAll('.prowheader_processed')).toHaveLength(1);
    expect(continuation.querySelectorAll('.pdocinfo_processed')).toHaveLength(0);
    expect([...continuation.querySelectorAll('.prowitem_processed')].map(n=>n.textContent)).toEqual(['row 0','row 1']);
  });
  it('makes repeated chrome insertion idempotent and reports only newly consumed height', () => {
    const f = new Formatter(), s = fixture(), container = document.createElement('section');
    expect(f.ensureFirstPageSections(container,s,{header:200,docInfos:{docinfo:23}},null,false)).toBe(23);
    expect(f.ensureFirstPageSections(container,s,{header:200,docInfos:{docinfo:23}},null,false)).toBe(0);
    f.appendRepeatingSections(container,s,null,false);
    expect(container.querySelectorAll('.pheader_processed')).toHaveLength(1);
    expect(container.querySelectorAll('.pdocinfo_processed')).toHaveLength(1);
    expect(container.querySelectorAll('.prowheader_processed')).toHaveLength(1);
  });
});
