window.DemoInformation = (d, m) => {
  const plans = d.repayment.months.map(n => m.repayment(d.repayment, n));
  const values = key => plans.map(p => `<td colspan="2">${key === 'months' ? p[key] + ' months' : 'RM' + m.money(p[key])}</td>`).join('');
  const instalments = plans.map(p => `<td>RM${m.money(p.regular)}</td><td>RM${m.money(p.final)}</td>`).join('');
  return `<h1>IMPORTANT INFORMATION <span>ILLUSTRATIVE TERMS / NOT FINANCIAL ADVICE</span></h1>
  <section class="finance-terms"><h2>1. Finance Charges — fictional teaching assumptions</h2>
  <p>DemoBank is not a bank. The figures below are synthetic examples for testing document layout and arithmetic. They are not an offer, a lending policy, an official rate or a recommendation. No finance charge is posted to the supplied statement.</p>
  <h3>Cash Advance Transactions</h3>
  <p>No advances occur. Separate example only: 2% × RM100.00 = RM2.00 fee; principal plus fee RM102.00. Neither is posted to the statement.</p>
  <h3>Retail Transactions</h3>
  <p>All retail purchases in this sample carry zero interest for this statement cycle.<br>The hypothetical annual flat rates below exist solely to test a compact table, not to describe an actual account.<br>Repayment examples use 6% annual flat interest. No compounding, new spending or real payment obligation is implied.</p>
  <table class="rates"><thead><tr><th>Cardholder's Payment Behaviour (illustrative scenario)</th><th>Retail Interest Rate (%) per annum</th></tr></thead><tbody>
  <tr><td>Scenario A — synthetic flat-rate teaching example only</td><td>6.00% (flat)</td></tr>
  <tr><td>Scenario B — unused alternative for interface testing</td><td>7.20% (flat)</td></tr>
  <tr><td>Scenario C — unused alternative for interface testing</td><td>8.40% (flat)</td></tr></tbody></table>
  <h3>Balance Transfer</h3>
  <p>The DEMO BALANCE TRANSFER account begins at RM2,400.00. Its RM12.00 plan fee is a fixed fictional fee, posted once as DEMO-B01. A RM400.00 payment reduces its closing balance to RM2,012.00. No transfer principal is newly charged this cycle.</p>
  <p>Reconciliation rule: opening balance + new charges − payments − credits = closing balance. All amounts use integer cents. CR marks a payment or credit that reduces the amount owed; a positive unmarked amount is a charge or balance.</p>
  <p>Combined limit: RM16,000.00. Overdue/over-limit amounts: RM0.00 for every account. Minimums are computed separately by account and then added; a combined percentage alone can give a different rounded result.</p></section>
  <section class="repayment-terms"><h2>2. Notice on Monthly Payment — separate illustrative examples</h2>
  <p>Assume RM1,200.00 principal, 6% annual flat simple interest on the original principal, no compounding, no new spending and no fees. Interest = principal × 0.06 × months ÷ 12. These examples are independent of the statement balance.</p>
  <table class="repayment"><colgroup><col style="width:116.64pt"></colgroup>${plans.map(()=>'<colgroup><col style="width:96.24pt"><col style="width:39.6pt"></colgroup>').join('')}<thead>
  <tr><th scope="col" rowspan="2">Principal / scenario</th>${plans.map((p,i)=>`<th scope="colgroup" colspan="2">Scenario ${String.fromCharCode(65+i)} — RM${m.money(p.principal)}</th>`).join('')}</tr>
  <tr>${plans.map(()=>'<th scope="col">Regular (n−1)</th><th scope="col">Final</th>').join('')}</tr></thead><tbody>
  <tr><th scope="row">Monthly instalment</th>${instalments}</tr>
  <tr><th scope="row">Repayment Period</th>${values('months')}</tr>
  <tr><th scope="row">Total Interest Incurred</th>${values('interest')}</tr>
  <tr><th scope="row">Total Amount to be settled</th>${values('total')}</tr></tbody></table>
  <p>Regular instalments are rounded down to cents; the final instalment absorbs the remainder. In each pair: (months − 1) × regular + final = principal + interest. Flat interest is not an effective annual percentage rate.</p>
  <p><b>Statement minimum:</b> RM${m.money(m.statement(d).minimum)} (page 3 rule). This is not a table instalment; no real payment is due.</p></section>
  <section class="qr-terms"><h2>3. Demo reference / non-payment QR</h2><div class="qr-line"><img src="${window.DEMOBANK_ASSETS?.['qr.svg'] || 'assets/demobank/qr.svg'}" alt="Demo QR for the reserved demobank.example domain"><p>This QR encodes only <b>https://demobank.example/demo</b>.<br>It is a non-payment example domain. It does not authorize a transfer, sign in to a bank or collect information.<br><span lang="ms">Kod QR ini bukan untuk pembayaran. Jangan hantar maklumat peribadi.</span></p></div></section>
  <section class="lower-terms"><h2>4. Usage of Credit Card for unlawful activities — simulation safety</h2>
  <p>No card exists and no service is provided. Do not present this document as identification, proof of funds or evidence of an actual transaction. Use synthetic data only when testing your own interface.</p>
  <h2>5. Statement Accuracy</h2><p>For testing, compare the summary to each account subtotal. The demo purchase reversal reduces the daily account by RM42.00; it is not a second purchase. Dates are fictional April 2027 transaction and posting dates.</p>
  <h2>6. Lost or Stolen Cards — no live assistance</h2><p>There is no card to block. For a real account concern, use your own verified provider independently. Do not send real card details, passwords or one-time codes to this demonstration.</p>
  <h2>7. Fictional Customer Service</h2><p>DemoBank Design Lab · 18 Sample Lane, 00000 Example City, Fictional Region. Contact label: help@demobank.example. No telephone line, branch, emergency service or real support endpoint is operated by this sample.</p>
  <p>Website label: www.demobank.example. All example-domain references are reserved placeholders and the document requires no external network. This demonstration has no affiliation with a financial institution or regulator.</p>
  <h2>8. Sample fees and data handling / Fi contoh dan pengendalian data</h2><p>The only fee in this statement is the RM12.00 fictional transfer-plan charge. There are no late fees, conversion fees, annual fees, cash-advance fees or taxes. The separate RM2.00 example in section 1 is not posted and must not be added to the balance.</p>
  <p lang="ms">Semua nama peniaga, nombor rujukan, akaun, amaun, kadar dan tarikh ialah rekaan. Fi pelan contoh RM12.00 telah dimasukkan sekali sahaja. Tiada fi lain atau cukai dikenakan dalam penyata contoh ini.</p>
  <h2>9. About this test document</h2><p>This four-page fictional statement tests selectable text, repeated table headers, page continuation, compact typography, bilingual notices and offline export using PrintForm-JS. The symbol and geometric illustration are original code-generated artwork, not a copied bank mark or advertisement.</p>
  <p>Arithmetic is exact in integer minor units; these examples deliberately avoid actual underwriting, interest accrual and regulatory rules. Do not rely on them for decisions about borrowing, repayment or consumer rights.</p>
  <p lang="ms">Dokumen ini untuk ujian reka bentuk sahaja dan bukan nasihat kewangan. Jangan membuat bayaran berdasarkan contoh ini. Semua empat halaman mesti disertakan apabila menyemak susun atur dan pengiraan.</p>
  <p class="end-mark">END OF FICTIONAL SAMPLE · DEMO-2027-0042 · Generated entirely from synthetic data</p></section>`;
};
