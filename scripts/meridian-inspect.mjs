// Independent DOM/PDF/pixel acceptance; never chooses or adjusts page boundaries.
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {decodeBarcodeRow} from '../tests/support/barcode-decode.js';
import {calculate, money} from '../gallery/designs/assets/meridian/model.mjs';
const compact = s => s.replace(/\s/gu,'');
const near = (a,b,label,tolerance=.9) => assert.ok(Math.abs(a-b)<tolerance, `${label}: ${a} != ${b}`);
export async function inspectDom(page, data) {
  const result = await page.evaluate(() => {
    const rect = n => { const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    return [...document.querySelectorAll('.printform_page')].map(p => {
      const children = [...p.children].filter(n => !n.matches('.dummy_spacer,.pfooter_spacer'));
      return {rect:rect(p), number:p.querySelector('[data-page-number]').textContent,
        total:p.querySelector('[data-page-total]').textContent,
        header:p.querySelectorAll('.po-header').length, headings:p.querySelectorAll('.headings').length,
        ids:[...p.querySelectorAll('[data-item-id]')].map(n=>n.dataset.itemId),
        descriptions:[...p.querySelectorAll('.description')].map(n=>n.textContent),
        totals:p.querySelectorAll('.grand-total').length, terms:p.querySelectorAll('.terms').length,
        body:p.querySelectorAll('.item-row,.order-summary,.closing,.terms,.empty-items').length,
        font:[...p.querySelectorAll('.item-row,.description')].map(n=>getComputedStyle(n).fontSize),
        children:children.map(n=>({class:n.className,rect:rect(n)})),
        split:p.querySelectorAll('[data-pf-fragment-count]').length,
        overflow:[...p.querySelectorAll('.line-grid>div,.identity,.remarks,svg,img')].filter(n=>{
          const r=rect(n),b=rect(p); return r.x<b.x-.2||r.right>b.right+.2||r.y<b.y-.2||r.bottom>b.bottom+.2||n.scrollWidth>n.clientWidth+1;
        }).map(n=>n.className.baseVal||n.className),
        barcodeTextGroups:[...p.querySelectorAll('.identity,.item-code')].map(container=>{
          const po=container.matches('.identity');
          const parts=po?[container.querySelector('.po-id'),container.querySelector('.po-barcode svg')]:
            [container.querySelector('b'),container.querySelector('svg'),container.querySelector('.barcode-value')];
          return {kind:po?'PO':'item',container:rect(container),parts:parts.map((n,i)=>{
            const role=i===1?'SVG':i===0?'label':'human-readable';
            const range=document.createRange();range.selectNodeContents(n);
            return {role,rect:rect(n),text:i===1?null:n.textContent,
              textRect:i===1?null:rect(range),font:i===1?null:getComputedStyle(n).fontSize};
          })};
        }),
        svgPaintOutside:[...p.querySelectorAll('svg')].some(svg=>{
          const s=rect(svg);return [...svg.querySelectorAll('rect')].some(n=>{const r=rect(n);
            return r.x<s.x-.2||r.y<s.y-.2||r.right>s.right+.2||r.bottom>s.bottom+.2;});
        }),
        scaled:[p,...p.querySelectorAll('*')].some(n=>{const s=getComputedStyle(n);return s.transform!=='none'||Number(s.zoom||1)!==1;})};
    });
  });
  assert.ok(result.length>=2 && result.length<=30);
  assert.deepEqual(result.flatMap(p=>p.ids),data.items.map(i=>i.code));
  assert.deepEqual(result.flatMap(p=>p.descriptions),data.items.map(i=>i.description));
  assert.equal(result.reduce((n,p)=>n+p.totals,0),1);
  assert.equal(result.reduce((n,p)=>n+p.terms,0),1);
  const termsPage=result.findIndex(p=>p.terms), totalPage=result.findIndex(p=>p.totals);
  const lastItem=Math.max(0,...result.flatMap((p,i)=>p.ids.length?[i]:[]));
  assert.ok(termsPage>lastItem && termsPage>totalPage,'terms start after items and totals on a separate page');
  for (const [i,p] of result.entries()) {
    assert.equal(p.number,String(i+1)); assert.equal(p.total,String(result.length));
    assert.equal(p.header,1); assert.ok(p.body>0,'no blank body pages');
    if (p.ids.length) assert.equal(p.headings,1);
    if (p.terms) {assert.equal(p.headings,0);assert.equal(p.ids.length,0);}
    assert.equal(p.barcodeTextGroups.filter(g=>g.kind==='PO').length,1);
    assert.equal(p.barcodeTextGroups.filter(g=>g.kind==='item').length,p.ids.length);
    let itemIndex=0;
    for (const group of p.barcodeTextGroups) {
      const expected=group.kind==='PO'?data.poNumber:p.ids[itemIndex++];
      assert.equal(group.parts[0].text,expected,'barcode label text retained');
      if(group.kind==='item') assert.equal(group.parts[2].text,data.items.find(item=>item.code===expected).barcode);
      const inside=(r,b)=>r.x>=b.x-.2&&r.right<=b.right+.2&&r.y>=b.y-.2&&r.bottom<=b.bottom+.2;
      for(const part of group.parts) {
        assert.ok(part.rect.width>0&&part.rect.height>0,`${group.kind} ${part.role} has a visible box`);
        assert.ok(inside(part.rect,group.container),`${group.kind} ${part.role} inside its own container`);
        if(part.textRect) {
          assert.equal(part.font,'12px','barcode labels and human-readable values remain 9pt');
          assert.ok(inside(part.textRect,part.rect),`${group.kind} ${part.role} text fits its label box`);
        }
      }
      for(let n=1;n<group.parts.length;n++) assert.ok(group.parts[n-1].rect.bottom<=group.parts[n].rect.y+.2,
        `${group.kind} ${group.parts[n-1].role}/${group.parts[n].role} sibling boxes must not overlap`);
    }
    assert.deepEqual(p.overflow,[]); assert.equal(p.split,0); assert.equal(p.scaled,false); assert.equal(p.svgPaintOutside,false,'barcode paint must not obscure adjacent text');
    assert.ok(p.font.every(s=>s==='12px'),'base item typography is 9pt');
    near(p.rect.width,190*96/25.4,'content width',.1);
    near(p.rect.height,277*96/25.4,'content height',.2);
    let end=p.rect.y;
    for (const child of p.children) {
      assert.ok(child.rect.y>=end-.2,`no vertical overlap: ${child.class}`);
      assert.ok(child.rect.bottom<=p.rect.bottom+.2,`inside page: ${child.class}`);
      end=child.rect.bottom;
    }
  }
  return result;
}
export async function inspectPdf(bytes, dom, data) {
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
  try {
    const pdf=await task.promise, results=[];
    assert.equal(pdf.numPages,dom.length,'PDF physical pages equal formatter pages');
    const media=[...bytes.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map(m=>m[1].trim().split(/\s+/).map(Number));
    assert.equal(media.length,pdf.numPages);
    for(let i=1;i<=pdf.numPages;i++) {
      const p=await pdf.getPage(i), v=p.getViewport({scale:1}), tc=await p.getTextContent();
      near(v.width,210*72/25.4,'A4 MediaBox width'); near(v.height,297*72/25.4,'A4 MediaBox height');
      near(media[i-1][2],v.width,'raw MediaBox width',.01); near(media[i-1][3],v.height,'raw MediaBox height',.01);
      const items=tc.items.filter(t=>t.str?.trim()), plain=compact(items.map(t=>t.str).join(''));
      assert.ok(plain.includes(`Page${i}of${pdf.numPages}`),'global PDF page numbers');
      const ids=data.items.map(item=>item.code).filter(id=>plain.includes(id));
      assert.deepEqual(ids,dom[i-1].ids,'PDF item IDs exactly on expected page');
      for(const id of ids) assert.equal(plain.split(id).length-1,1,'each item printed once');
      assert.equal(plain.split('GrandTotal(SGD)').length-1,dom[i-1].totals);
      assert.equal(plain.includes('TERMSANDCONDITIONSOFPURCHASE'),Boolean(dom[i-1].terms));
      if(dom[i-1].ids.length) assert.ok(plain.includes('ItemCode/Barcode')&&plain.includes('UnitPrice(SGD)'));
      for(const t of items) {
        if (/^DEMO-\d+$/.test(t.str) || /^880000\d{6}$/.test(t.str)) near(t.height,9,'PDF unscaled 9pt text',.15);
        assert.ok(t.transform[4]>=27 && t.transform[4]+t.width<=v.width-27,'PDF horizontal margins');
        assert.ok(t.transform[5]>=27 && t.transform[5]<=v.height-27,'PDF vertical margins');
      }
      results.push({page:i,widthPt:v.width,heightPt:v.height,mediaBox:media[i-1],ids,text:items.map(t=>t.str).join(' ')});
    }
    const text=compact(results.map(p=>p.text).join(''));
    const total=calculate(data);
    assert.ok(text.includes(money(total.grand)),'PDF contains the computed grand total');
    assert.ok(text.includes(money(total.tax)),'PDF contains the computed GST');
    for(const amount of total.amounts) assert.ok(text.includes(money(amount)),'PDF retains each line amount');
    for(const item of data.items) {
      assert.equal(text.split(item.code).length-1,1);
      assert.equal(text.split(item.barcode).length-1,1);
    }
    return results;
  } finally {await task.destroy();}
}
export async function barcodePixels(page, locator, expected, file) {
  const png=await locator.screenshot({path:file,scale:'css'});
  const row=await page.evaluate(async bytes=>{
    const img=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);img.close();
    const pixels=ctx.getImageData(0,Math.floor(canvas.height/2),canvas.width,1).data;
    return Array.from({length:canvas.width},(_,i)=>pixels[i*4]+pixels[i*4+1]+pixels[i*4+2]<384?1:0);
  },[...png]);
  const decoded=decodeBarcodeRow(row,'CODE128'); assert.equal(decoded,expected);
  return {file,decoded,pixelWidth:row.length,checksumAndQuietZones:true,method:'PNG pixels -> independent decodeBarcodeRow',physicalCertified:false};
}
