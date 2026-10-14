// Fictional supplied facts and asset, never a printer or scanner certification.
export const CSS_PX_PER_MM = 96 / 25.4;
export const SPECIAL_PAPER_PROFILES = [
  { id: 'thermal58', name: '58mm bounded receipt', widthMm: 58, heightMm: 120, insetX: 5, insetY: 4, cjkRepeats: 18, rtlRepeats: 12 },
  { id: 'thermal80', name: '80mm bounded receipt', widthMm: 80, heightMm: 160, insetX: 5, insetY: 4, cjkRepeats: 24, rtlRepeats: 18 },
  { id: 'label', name: '100x70mm explicit labels', widthMm: 100, heightMm: 70, insetX: 5, insetY: 4, cjkRepeats: 3, rtlRepeats: 2 },
  { id: 'continuous', name: '210x140mm continuous stock / finite pages', widthMm: 210, heightMm: 140, insetX: 5, insetY: 4, cjkRepeats: 90, rtlRepeats: 65 }
];

// Authored 67x32 monochrome PNG, Code39 reference symbol *A* with quiet zones.
// Only byte/asset retention is asserted, not successful decoding or print quality.
export const SUPPLIED_BARCODE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEMAAAAgCAAAAABswZpbAAAALUlEQVR4nGP4DwcMYMzAAMUwEiGKJo+icdSMUTNGzRg1Y9SMUTNGzRg1g1gzACQS+z0IiM36AAAAAElFTkSuQmCC';
export const SPECIAL_PAPER_FIELDS = ['id', 'date', 'amount', 'cjk', 'rtl', 'barcode'];

export function specialPaperFixture(profile) {
  const width = (profile.widthMm - 2 * profile.insetX) * CSS_PX_PER_MM;
  const height = (profile.heightMm - 2 * profile.insetY) * CSS_PX_PER_MM;
  const label = profile.id === 'label';
  const rows = ['MYR 00123.4500', 'SGD -0007.0050', 'JPY 00042'].map((amount, index) => ({
    id: `${profile.id.toUpperCase()}-00${index + 1}`,
    date: `2026-10-${14 + index}`,
    amount,
    cjk: '虚构园区设备巡检：确认管线与维护说明。'.repeat(profile.cjkRepeats),
    rtl: 'مراجعة مرافق الحديقة الخيالية وتوثيق الصيانة. '.repeat(profile.rtlRepeats),
    barcode: label ? 'CODE39 A' : ''
  }));
  const config = {
    papersizeWidth: width, papersizeHeight: height, dpi: 96, nUp: 1,
    repeatRowheader: false,
    insertDummyRowItemWhileFormatTable: false, insertDummyRowWhileFormatTable: false,
    insertFooterSpacerWhileFormatTable: false, insertFooterSpacerWithDummyRowItemWhileFormatTable: false,
    fillPageHeightAfterFooter: true
  };
  const attributes = Object.entries(config).map(([key, value]) =>
    `data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}="${value}"`).join(' ');
  const templateHtml = `<section class="printform special-paper" lang="zh-CN" ${attributes}>
    <table class="prowitem" data-pf-each="/rows" data-pf-table-id="paper" style="width:100%;table-layout:fixed;border-collapse:collapse;${label ? `height:${height}px` : ''}">
      <tbody><tr><td style="padding:0;vertical-align:top">
        <div data-paper-field="id" data-pf-text="./id"></div>
        <div data-paper-field="date" data-pf-text="./date"></div>
        <div data-paper-field="amount" data-pf-text="./amount" class="supplied-money"></div>
        <div data-paper-field="cjk" data-pf-text="./cjk" lang="zh-CN"></div>
        <div data-paper-field="rtl" data-pf-text="./rtl" dir="rtl" lang="ar"></div>
        ${label ? `<img data-paper-asset src="${SUPPLIED_BARCODE_PNG}" alt="Supplied Code39 reference A" width="134" height="32">` : ''}
        <div data-paper-field="barcode" data-pf-text="./barcode"></div>
      </td></tr></tbody>
    </table>
  </section>`;
  // nUp=1 intentionally leaves physical media to the host. The logical budget
  // excludes explicitly authored margins; no zoom, clipping or font reduction.
  const themeCss = `
    * {box-sizing:border-box}
    html,body {margin:0;padding:0}
    #pf-mount,.special-paper {font:12px/18px Arial,sans-serif;color:#172d43}
    #pf-mount .printform_page {margin:0;padding:0;background:white}
    #pf-mount .physical_page_wrapper {
      width:${profile.widthMm}mm!important;height:${profile.heightMm}mm;
      padding:${profile.insetY}mm ${profile.insetX}mm;margin:0 0 12px;
      overflow:visible;
    }
    [data-paper-field] {margin:0;padding:0;overflow-wrap:break-word}
    .supplied-money {white-space:nowrap;overflow-wrap:normal}
    [data-paper-asset] {display:block;width:134px;height:32px;overflow:visible}
    @page paper_${profile.id} {size:${profile.widthMm}mm ${profile.heightMm}mm;margin:0}
    @media print {
      #pf-mount {page:paper_${profile.id}}
      #pf-mount .physical_page_wrapper {page:paper_${profile.id};margin:0;break-inside:avoid}
    }`;
  return { profile, width, height, config, templateHtml, themeCss, sampleData: { rows } };
}
