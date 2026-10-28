import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function inspectDemoBank(page) {
  return page.evaluate(() => {
    const sheets = [...document.querySelectorAll('.demobank .printform_page')];
    return sheets.map((sheet,index) => {
      const b = sheet.getBoundingClientRect();
      const rect = n => {
        const r = n.getBoundingClientRect();
        return {x:(r.x-b.x)*.75,y:(r.y-b.y)*.75,width:r.width*.75,height:r.height*.75};
      };
      const elements = [...sheet.querySelectorAll('td,th,img,h1,h2,h3,.pfooter_processed,.logo,.site,.customer')];
      const outside = elements.filter(n => {
        const r = n.getBoundingClientRect();
        return r.x<b.x-.2 || r.right>b.right+.2 || r.y<b.y-.2 || r.bottom>b.bottom+.2 || n.scrollWidth>n.clientWidth+1;
      }).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent.slice(0,50)}));
      const children = [...sheet.children];
      const overlaps = children.slice(1).filter((n,i)=>n.getBoundingClientRect().top < children[i].getBoundingClientRect().bottom-.2).map(n=>n.className);
      const footer = sheet.querySelector('.pfooter_processed');
      const last = children.filter(n=>!n.classList.contains('pfooter_spacer') && n!==footer).at(-1);
      return {page:index+1,width:b.width,height:b.height,text:sheet.innerText, outside, overlaps,
        footerCollision:last.getBoundingClientRect().bottom > footer.getBoundingClientRect().top+.2,
        warning:footer.querySelector('strong').textContent,number:footer.querySelector('[data-document-page]').textContent,
        transactionIds:[...sheet.querySelectorAll('[data-transaction-id]')].map(n=>n.dataset.transactionId),
        headers:sheet.querySelectorAll('.tx-header').length,
        boxes:[...sheet.querySelectorAll('.dates,.account-summary table,.total-boxes strong,.promo,.payment-notice,.tx-header,.account-title,.opening,.subtotal,.notices h3,.rates,.repayment,.qr-line,.lower-terms')].map(n=>({kind:n.className || n.tagName,...rect(n)})),
        tableColumns:[...sheet.querySelectorAll('.tx-header td')].map(rect)};
    });
  });
}
export function assertDemoBank(report, data) {
  assert.equal(report.length,4,'Exactly four pages required');
  for (const p of report) {
    assert.ok(Math.abs(p.width-793.7007874)<.1); assert.ok(Math.abs(p.height-1122.519685)<.1);
    assert.deepEqual(p.outside,[],`Outside page ${p.page}`); assert.deepEqual(p.overlaps,[]);
    assert.equal(p.footerCollision,false); assert.equal(p.warning,data.warning); assert.equal(p.number,String(p.page));
    assert.equal(p.headers,p.page===2 || p.page===3 ? 1:0);
  }
  const expected=data.accounts.flatMap(a=>a.transactions.map(t=>t.id));
  assert.deepEqual(report.flatMap(p=>p.transactionIds),expected,'Exact ordered transaction coverage');
  assert.equal(report[1].transactionIds.includes('F01'),false);
  assert.deepEqual(report[2].transactionIds,['F01']);
  assert.ok(report[1].text.includes('DEMO FLEX'));
  assert.ok(report[2].text.includes('CONTINUED'));
  assert.ok(report[3].text.includes('END OF FICTIONAL SAMPLE'));
}
export async function inspectDemoBankPDF(bytes,data) {
  const loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
  const pdf=await loading.promise, pages=[];
  try {
    assert.equal(pdf.numPages,4);
    for(let i=1;i<=4;i++) {
      const p=await pdf.getPage(i), view=p.getViewport({scale:1});
      assert.ok(Math.abs(view.width-595.27559)<.5); assert.ok(Math.abs(view.height-841.88976)<.5);
      const content=await p.getTextContent();
      const items=content.items.filter(n=>n.str?.trim()).map(n=>({text:n.str,x:n.transform[4],y:view.height-n.transform[5],width:n.width,height:n.height,font:n.fontName}));
      const text=items.map(n=>n.text).join(' ');
      assert.ok(text.includes(data.warning),`Missing PDF warning ${i}`);
      assert.ok(text.includes(`Page ${i} / 4`));
      for(const t of items) {
        assert.ok(t.x>30 && t.x+t.width<565,`PDF horizontal overflow ${i}: ${t.text}`);
        assert.ok(t.y>10 && t.y<835,`PDF vertical overflow ${i}: ${t.text}`);
      }
      pages.push({page:i,width:view.width,height:view.height,text,items});
    }
    const transactions=pages.slice(1,3).flatMap(p=>p.items.filter(t=>t.y<390 || p.page===2)).map(t=>t.text).join(' ');
    for(const t of data.accounts.flatMap(a=>a.transactions)) {
      const token=`DEMO-${t.id}`;
      assert.equal(transactions.split(token).length-1,1,`PDF transaction ${token}`);
    }
    const full=pages.map(p=>p.text).join(' ');
    const urls=full.match(/(?:https?:\/\/|www\.)[^\s]+/g)||[];
    assert.ok(urls.every(url=>/^(?:https:\/\/|www\.)demobank\.example(?:\/demo)?\.?$/.test(url)));
    const metadata=await pdf.getMetadata();
    const attachments=await pdf.getAttachments();
    assert.equal(attachments,null,'No hidden PDF attachments');
    return {pages,metadata:metadata.info,attachments};
  } finally {await loading.destroy();}
}
