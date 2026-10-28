(() => {
  'use strict';
  const d = window.PF057_DATA, m = window.PF057Math, icon = window.PF057Icon;
  m.validate(d);
  const asset = file => window.PF057_ASSETS?.[file] || `assets/pf057/${file}`;
  const make = (tag, cls, html) => {
    const node = document.createElement(tag); node.className = cls; node.innerHTML = html; return node;
  };
  const warning = 'SAMPLE — FICTIONAL FINANCING DEMONSTRATION';
  const best = Math.min(...d.withRebate.flatMap(g => g.tiers.map(t => m.resultingBp(g.baseBp, t.rebateBp))));
  const brand = () => `<span class="pf057-brand"><img src="${asset('mark.svg')}" alt=""><b>DemoBank</b></span>`;
  function income(tier, t) {
    return tier.incomeMaxRM === null ? `${m.number(tier.incomeMinRM)} ${t.above}` :
      `${m.number(tier.incomeMinRM)} – ${m.number(tier.incomeMaxRM)}`;
  }
  function withRebate(t) {
    const keys = ['account', 'income', 'rate', 'time', 'result'];
    const rows = d.withRebate.map((group, gi) => `<tbody data-group="${group.destination}">${group.tiers.map((tier, i) => {
      const span = group.tiers.length;
      return `<tr data-tier="${gi}-${i}">${i ? '' : `<th scope="rowgroup" rowspan="${span}">${t[group.destination]}</th>`}
        <td class="pf057-income">${income(tier, t)}</td>
        ${i ? '' : `<td class="pf057-base" rowspan="${span}">${m.percent(group.baseBp)}<small>${t.perYear}</small></td>`}
        <td class="pf057-rebate">${m.rebatePercent(tier.rebateBp)}</td>
        <td class="pf057-outcome" data-result-bp="${m.resultingBp(group.baseBp, tier.rebateBp)}">${m.percent(m.resultingBp(group.baseBp, tier.rebateBp))} <small>${t.perYear}</small></td></tr>`;
    }).join('')}</tbody>`).join('');
    return `<table class="pf057-tiers"><caption>${t.with}</caption>
      <colgroup><col style="width:19%"><col style="width:27%"><col style="width:16%"><col style="width:18%"><col style="width:20%"></colgroup>
      <thead><tr>${t.headers.map((label, i) => `<th scope="col">${icon(keys[i])}<span>${label}</span>${i === 1 ? `<small>${t.incomeUnit}</small>` : i === 3 ? `<small>${t.rebateUnit}</small>` : ''}</th>`).join('')}</tr></thead>${rows}</table>`;
  }
  function withoutRebate(t) {
    return `<table class="pf057-no-rebate"><caption>${t.without}</caption>
      <colgroup><col style="width:46%"><col style="width:54%"></colgroup>
      <thead><tr><th scope="col">${t.headers[1]} · ${t.incomeUnit}</th><th scope="col">${t.noRebateHead}</th></tr></thead>
      <tbody>${d.withoutRebate.map(tier => `<tr><td>${income(tier, t)}</td><td class="pf057-outcome" data-no-rebate-bp="${tier.rateBp}">${m.percent(tier.rateBp)}</td></tr>`).join('')}</tbody></table><p class="pf057-mini">${t.noRebate}</p>`;
  }
  const root = document.querySelector('#pf057-root');
  for (const [lang, t] of Object.entries(d.translations)) {
    const form = make('article', 'printform pf057', '');
    form.lang = lang;
    Object.assign(form.dataset, { paperSize: 'A4', orientation: 'portrait', dpi: '96',
      papersizeWidth: String(210 / 25.4 * 96), papersizeHeight: String(297 / 25.4 * 96),
      repeatHeader: 'n', repeatDocinfo: 'n', repeatRowheader: 'n', repeatFooter: 'y',
      insertDummyRowItemWhileFormatTable: 'n', insertPtacDummyRowItems: 'n',
      insertDummyRowWhileFormatTable: 'n', insertFooterSpacerWhileFormatTable: 'n' });
    form.append(make('header', 'pheader pf057-hero', `
      <img class="pf057-art" src="${asset('hero.svg')}" alt="${lang === 'en' ? 'Original illustration of two fictional people planning together' : 'Ilustrasi asli dua individu rekaan merancang bersama'}">
      <div class="pf057-shade"></div><div class="pf057-identity">${brand()}<span>${t.language} / ${d.id}</span></div>
      <div class="pf057-pitch"><p class="pf057-eyebrow">${t.eyebrow}</p><h1>${t.headline}</h1><p class="pf057-intro">${t.intro}</p></div>
      <div class="pf057-rate"><p>${t.rateLabel}</p><div><strong data-hero-bp="${best}">${m.percent(best).replace('%', '')}</strong><span><b>%</b><small>${t.perYear}</small></span></div><small>${t.rateNote}</small></div>
      <div class="pf057-date"><span>${t.periodLabel} <b>${d.period[lang]}</b></span><span>${d.website} · DESIGN LAB</span></div>`));
    const benefitValues = [t.benefitTitle, `RM${m.number(d.ceilingRM)}`, `${d.termYears[0]} ${t.rangeJoin} ${d.termYears[1]} ${t.years}`];
    form.append(make('section', 'pdocinfo pf057-benefits', t.benefits.map((label, i) => `<div>${icon(['compare', 'income', 'calendar'][i])}<section><p>${label}</p><h2>${benefitValues[i]}</h2><small>${t.benefitDetails[i]}</small></section></div>`).join('')));
    form.append(make('section', 'prowitem pf057-guide', `<div class="pf057-card">
      <div class="pf057-guide-heading"><div><p class="pf057-eyebrow">${t.guideLabel}</p><h2>${t.guideTitle}</h2></div><span>01 / 02</span></div>
      ${withRebate(t)}<p class="pf057-table-note">${t.tableNote}</p>${withoutRebate(t)}
      <div class="pf057-notes"><h3>${t.mathTitle}</h3><p>${t.math}</p><p>${t.flat}</p><p>${t.condition}</p></div>
      </div>`));
    form.append(make('footer', 'pfooter pf057-footer', `<div class="pf057-footer-top"><div>${brand()}<small>${t.footerLine}</small></div><div>${d.website}<br>${d.email}<br><b>${t.offerWarning}</b></div></div>
      <div class="pf057-warning"><strong>${warning}</strong><span>${t.localWarning}</span></div>`));
    root.append(form);
  }
  window.addEventListener('load', async () => {
    try {
      await document.fonts.ready;
      // Explicit engine invocation, not screenshot-based or custom pagination.
      window.PF057_FORMAT_REPORT = await window.PrintForm.formatAll();
      document.querySelectorAll('.pf057 .printform_page').forEach((page, i) => {
        page.lang = i === 0 ? 'en' : 'ms';
        page.querySelector('.pf057-guide-heading > span').textContent = `${String(i + 1).padStart(2, '0')} / 02`;
      });
      document.body.classList.add('pf057-ready');
      window.PF057_READY = true;
    } catch (error) {
      window.PF057_ERROR = error.message;
      console.error(error);
    }
  });
})();
