(() => {
  const d = window.DEMOBANK_DATA, m = window.DemoMoney, totals = m.statement(d);
  const root = document.querySelector('#demobank-root');
  const asset = file => window.DEMOBANK_ASSETS?.[file] || `assets/demobank/${file}`;
  const node = (tag, cls, html = '') => {
    const n = document.createElement(tag); n.className = cls; n.innerHTML = html; return n;
  };
  const money = value => m.money(value);
  const bilingual = (en, ms) => `<b>${en}</b><i lang="ms">${ms}</i>`;
  const date = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {day:'2-digit',month:'short',timeZone:'UTC'}).toUpperCase();
  const cols = widths => `<colgroup>${widths.map(w => `<col style="width:${w}pt">`).join('')}</colgroup>`;
  const widths = [51.12, 51.36, 184.32, 76.56, 73.68, 72.6];
  const table = (cls, cells, id = 'transactions', heights = '') => {
    const t = node('table', cls, `${cols(widths)}<tbody><tr>${cells.map((v,i) => `<td class="c${i}" ${heights}>${v}</td>`).join('')}</tr></tbody>`);
    t.dataset.pfTableId = id; return t;
  };
  const form = (kind, headerHeight) => {
    const f = node('main', `printform paper_width demobank ${kind}`);
    Object.assign(f.dataset, { papersizeWidth:'793.7007874', papersizeHeight:'1122.519685',
      repeatHeader:'y', repeatRowheader:'y', repeatPtacRowheader:'n', repeatDocinfo:'n', repeatFooter:'y',
      repeatFooterPagenum:'n', insertDummyRowItemWhileFormatTable:'n', insertPtacDummyRowItems:'n',
      insertDummyRowWhileFormatTable:'n' });
    const header = node('header', 'pheader', kind === 'information' ? '' :
      `<img class="logo" src="${asset('logo.svg')}" alt="DemoBank fictional brand"><span class="site">${d.website}<br>FICTIONAL UI / UX DEMONSTRATION</span>`);
    header.style.height = `${headerHeight}pt`; f.append(header);
    f.append(node('footer','pfooter', `<strong>${d.warning}</strong><span>DemoBank · Fictional information only</span><span class="page-number">Page <b data-document-page></b> / 4</span>`));
    root.append(f); return f;
  };
  const summary = form('summary', 100);
  const top = node('section', 'ptac summary-top');
  top.innerHTML = `<div class="customer"><small>DEMO REFERENCE ${d.customer.reference}</small><img class="barcode" src="${asset('barcode.svg')}" alt="Dummy reference barcode DEMO-0042"><b>${d.customer.name}</b>${d.customer.address.join('<br>')}</div>
    <table class="dates"><tbody><tr><th>${bilingual('Statement Date','Tarikh Penyata')}</th><td>${date(d.statementDate)} 2027</td></tr><tr><th>${bilingual('Payment Due Date','Bayar Sebelum')}</th><td>${date(d.dueDate)} 2027</td></tr><tr><th>${bilingual('Combined Limit (RM)','Had Kredit Gabungan (RM)')}</th><td>${money(totals.limit)}</td></tr></tbody></table>`;
  summary.append(top);
  const summaryWidths = [85.2,70.56,127.92,70.56,79.44,75.96];
  const heads = [bilingual('Credit Card Number','Nombor Kad Kredit'), bilingual('Credit Limit','Had Kredit')+'(RM)',
    bilingual('Card Type','Jenis Kad'), bilingual('Current Balance','Jumlah Terkini')+'(RM)',
    bilingual('Overdue/Limit','Tunggakan/Lebih-Had')+'(RM) [A]', bilingual('Minimum Payment','Bayaran Minimum')+'(RM) [B]'];
  const accountSummary = node('section','ptac account-summary', `<table>${cols(summaryWidths)}<thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${d.accounts.map((a,i)=>`<tr><td class="identifier">${a.masked}</td><td>${money(a.limitMinor)}</td><td class="card-type">${a.label}</td><td>${money(totals.accounts[i].closing)}</td><td>0.00</td><td>${money(totals.accounts[i].minimum)}</td></tr>`).join('')}</tbody></table>`);
  summary.append(accountSummary);
  summary.append(node('section','ptac total-boxes', `<div>${bilingual('Total Current Balance','Jumlah Terkini')}<strong>${money(totals.closing)}</strong></div><div>${bilingual('TOTAL Minimum Payment','Jumlah Bayaran Minimum')}<small>Total / Jumlah [A] + [B]</small><strong>${money(totals.minimum)}</strong></div>`));
  summary.append(node('section','ptac promo-space', `<div class="promo"><img src="${asset('banner.svg')}" alt="Original abstract illustration"><div><small>IMAGINE • EXPLORE • TEST</small><h1>A clearer view.<br>A fictional balance.</h1><p>Designed for better document experiences.<br>No offer. No rewards. No banking service.</p><b>DemoBank / Design Lab</b></div></div>`));
  summary.append(node('section','ptac payment-notice', `<h2>DEMO PAYMENT NOTICE / NOTIS BAYARAN DEMO</h2><p>This document is a fictional interface test. Do not make a payment. All balances, dates and identifiers are synthetic and cannot be used for banking.</p><p>The sample total minimum is <b>RM${money(totals.minimum)}</b>, due on the fictional date <b>21 MAY 2027</b>. See page 3 for the calculation rule and page 4 for illustrative repayment examples.</p><p lang="ms">Dokumen ini ialah ujian antara muka rekaan. Jangan membuat bayaran. Semua baki, tarikh dan pengenal adalah sintetik dan tidak sah untuk urusan perbankan.</p><p lang="ms">Jumlah minimum contoh ialah <b>RM${money(totals.minimum)}</b>. Tarikh akhir rekaan ialah <b>21 MEI 2027</b>. Contoh ini bukan nasihat kewangan atau penyata bank yang sah.</p>`));

  const tx = form('transactions', 104);
  const header = table('prowheader tx-header', [
    bilingual('Transaction<br>Date','Tarikh<br>Transaksi'), bilingual('Posting<br>Date','Tarikh Bil<br>Diterima'),
    bilingual('Transaction Description','Deskripsi Transaksi'), bilingual('Categories','Kategori'),
    bilingual('Foreign Amount','Amaun Wang Asing'), bilingual('Local Amount','Amaun Tempatan')+'(RM)']);
  const caption = header.createCaption(); caption.innerHTML = `<b>${d.customer.name}</b><h2>YOUR TRANSACTION DETAILS / <i lang="ms">TRANSAKSI TERPERINCI ANDA</i></h2>`;
  header.dataset.pfKeepWithNext = 'true'; tx.append(header);
  const row = (description, amount, cls = '', height = 11.3) => {
    const n = table(`prowitem tx-row ${cls}`, ['', '', description, '', '', amount], 'transactions', `style="height:${height}pt"`);
    tx.append(n); return n;
  };
  const transaction = (t, detailed = false) => {
    const foreign = t.foreign ? `${t.foreign.currency} ${money(t.foreign.minor)}` : '';
    const cr = t.kind === 'charge' ? '' : ' CR';
    const n = table('prowitem tx-row transaction', [date(t.date),date(t.posted),
      `${t.description}${detailed ? `<small>DEMO-${t.id} · SYNTHETIC REFERENCE<br>No payment was made.<br>Fictional test entry only.</small>` : ''}`,
      t.category,foreign,`${money(t.minor)}${cr}`]);
    n.dataset.transactionId = t.id;
    tx.append(n); return n;
  };
  d.accounts.forEach((a,i) => {
    const title = node('section','prowitem account-title', `${a.label} · ${a.masked}`);
    title.dataset.pfTableId = 'transactions'; title.dataset.pfKeepWithNext = 'true'; tx.append(title);
    row('<b>PREVIOUS BALANCE FROM LAST STATEMENT</b>', `<b>${money(a.openingMinor)}</b>`, 'opening', i === 2 ? 25.5 : 19);
    if (i === 2) {
      // One semantic payment block: naturally overflows page 2, not a manual page break.
      const block = node('section','prowitem continuation-payment'); block.dataset.pfTableId = 'transactions';
      block.innerHTML = `<div class="continued-label">${a.label} · ${a.masked} · CONTINUED</div>`;
      tx.append(block);
      const originalParent = tx;
      const payment = transaction(a.transactions[0], true); block.append(payment); payment.classList.remove('prowitem');
      const detail = row('<b>DEMO FLEX REVIEW</b><br>Opening balance less payment only.<br>No new spending or interest in this cycle.', '', 'review', 50.2); block.append(detail); detail.classList.remove('prowitem');
      const sub = row('<b>SUB TOTAL</b>', `<b>${money(totals.accounts[i].closing)}</b>`, 'subtotal', 18); block.append(sub); sub.classList.remove('prowitem');
      if (block.parentNode !== originalParent) throw new Error('Lost payment block');
    } else {
      row('<b>NEW TRANSACTION / CHARGES</b>', '', '', 11.3);
      a.transactions.forEach(t => {
        if (t.kind === 'payment') row('<b>PAYMENT RECEIVED - THANK YOU</b>', '', 'payment-label', 13);
        transaction(t, t.kind === 'payment');
      });
      if (i === 1) row('<b>DEMO PLAN NOTE</b><br>RM2,400.00 + RM12.00 − RM400.00<br>= RM2,012.00; no interest this cycle.', '', 'review', 36.8);
      row('<b>SUB TOTAL</b>', `<b>${money(totals.accounts[i].closing)}</b>`, 'subtotal', i === 0 ? 25.5 : 18);
    }
  });
  row('<b>TOTAL BALANCE</b>', `<b>${money(totals.closing)}</b>`, 'combined-total', 23);
  const notices = node('section','prowitem notices'); notices.dataset.pfTableId = 'notices';
  notices.innerHTML = `<h2>PLEASE NOTE / <i lang="ms">SILA AMBIL PERHATIAN</i></h2>${d.notices.map(n=>`<section><h3>${n.title}</h3>${n.compact ? `<p>${n.en} <span lang="ms">${n.ms}</span></p>` : `<p>${n.en}</p><p lang="ms">${n.ms}</p>`}</section>`).join('')}`;
  tx.append(notices);
  const info = form('information', 17);
  const important = node('div','important');
  important.innerHTML = window.DemoInformation(d, m);
  [...important.children].forEach(child => {
    child.classList.add('prowitem', 'important');
    child.dataset.pfTableId = 'information';
    info.append(child);
  });
  window.DEMOBANK_TOTALS = totals;
  window.addEventListener('load', async () => {
    await document.fonts.ready;
    await window.PrintForm.formatAll();
    document.querySelectorAll('.demobank .printform_page').forEach((p,i) => {
      p.querySelector('[data-document-page]').textContent = i + 1;
    });
    document.body.classList.add('demobank-ready');
    window.DEMOBANK_READY = true;
  });
})();
