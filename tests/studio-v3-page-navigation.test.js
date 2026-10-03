import {beforeEach,describe,it,expect} from 'vitest';
import {syncPageControls,navigatePages} from '../studio-v3/page-navigation.js';
const button=direction=>document.querySelector(`[data-action=${direction}]`);
const pages=[{top:0},{top:1147},{top:2294}];
beforeEach(()=>{document.body.innerHTML='<button data-action="previous"></button><button data-action="next"></button><div id="paper-scroll"></div><span id="page-count"></span>'+pages.map((_,i)=>`<button data-page="${i}"></button>`).join('');});
describe('paper page navigation boundaries',()=>{
  it.each([[0,0,false],[0,1,true],[0,3,false],[1,3,false]])('disables both controls while rendering or blocked (%s/%s ready=%s)',(index,count,ready)=>{
    syncPageControls(document,index,count,ready);
    expect(button('previous').disabled).toBe(true);expect(button('next').disabled).toBe(true);
  });
  it('clamps first and last pages while keeping counts, thumbnails and disabled states aligned',()=>{
    expect(navigatePages(document,pages,-1)).toBe(0);expect(button('previous').disabled).toBe(true);expect(button('next').disabled).toBe(false);
    expect(navigatePages(document,pages,1,{zoom:.5})).toBe(1);expect(button('previous').disabled).toBe(false);expect(button('next').disabled).toBe(false);
    expect(document.querySelector('#paper-scroll').scrollTop).toBe(573.5);expect(document.querySelector('#page-count').textContent).toBe('Page 2 / 3');
    expect(document.querySelector('[data-page="1"]').getAttribute('aria-current')).toBe('page');
    expect(navigatePages(document,pages,99)).toBe(2);expect(button('previous').disabled).toBe(false);expect(button('next').disabled).toBe(true);
    expect(document.querySelector('#page-count').textContent).toBe('Page 3 / 3');
  });
  it('handles a smaller replacement document and non-scrolling selection',()=>{
    navigatePages(document,pages,2);const top=document.querySelector('#paper-scroll').scrollTop;
    expect(navigatePages(document,[pages[0]],2,{scroll:false})).toBe(0);
    expect(document.querySelector('#paper-scroll').scrollTop).toBe(top);expect(button('previous').disabled).toBe(true);expect(button('next').disabled).toBe(true);
    expect(navigatePages(document,[],0,{ready:false})).toBe(0);expect(button('previous').disabled).toBe(true);expect(button('next').disabled).toBe(true);
  });
});
