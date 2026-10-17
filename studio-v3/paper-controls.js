import { PAPERS, PAPER_SIZES_MM, PAGE_SIDES, pageSettings, paperMillimeters, printerStatus, validatePrinterProfile } from './paper-settings.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const input = (label,name,value,extra='') => `<label>${escape(label)}<input name="${name}" value="${escape(value)}" ${extra}></label>`;
const select = (label,name,value,options) => `<label>${escape(label)}<select name="${name}">${options.map(([id,label])=>`<option value="${id}" ${id === value ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>`;
const mmInput = (label,name,value,min=1,max=2000) => input(label,name,value,`type="number" min="${min}" max="${max}" step="any" placeholder="Unknown"`);
export function paperControls(design) {
  const page = pageSettings(design), profile = page.printerProfile || {}, size = paperMillimeters(page), status = printerStatus(design);
  const orientation = profile.orientations?.length === 2 ? 'both' : profile.orientations?.[0] || '';
  return `<details open><summary>Paper & margins</summary><div class="form-stack" data-paper-controls>
    ${select('Paper size','paper',page.paper,PAPERS.map(id=>[id,id === 'CUSTOM' ? 'Custom dimensions (mm)' : PAPER_SIZES_MM[id].label]))}
    <div data-custom-paper ${page.paper === 'CUSTOM' ? '' : 'hidden'}>${mmInput('Custom width (mm, before orientation)','paper-width-mm',page.customSizeMm?.width,20,1000)}${mmInput('Custom height (mm, before orientation)','paper-height-mm',page.customSizeMm?.height,20,1000)}</div>
    ${select('Orientation','orientation',page.orientation,[['portrait','Portrait'],['landscape','Landscape (swap width / height)']])}
    <p class="hint" data-paper-measurement>Applied sheet: ${escape(size.width)} × ${escape(size.height)} mm. Custom bounds: 20–1000 mm. Receipts and continuous stock use finite pages, not infinite rolls.</p>
    ${PAGE_SIDES.map(side=>input(`${side} margin (px)`,`margin-${side}`,page.margins[side],'type="number" min="0" max="72" step="any"')).join('')}
    <p class="hint">Page margins use CSS px at 96px/in; paper dimensions use mm. Orientation swaps the entered dimensions once. Actual content must fit; nothing is scaled down or clamped automatically.</p>
    <details><summary>User-supplied printer capabilities</summary><div class="form-stack">
      <label class="checkbox"><input name="printer-enabled" type="checkbox" ${page.printerProfile ? 'checked' : ''}>Use this user-supplied profile</label>
      <div data-printer-fields ${page.printerProfile ? '' : 'hidden'}>
      ${input('Profile name','printer-name',profile.name,'type="text" maxlength="100" placeholder="Your device / stock profile"')}
      ${['Width','Height'].map(axis=>['min','max'].map(bound=>mmInput(`${bound} ${axis.toLowerCase()} after orientation (mm)`,`printer-${bound}${axis}Mm`,profile[`${bound}${axis}Mm`])).join('')).join('')}
      ${select('Supported orientations','printer-orientations',orientation,[['','Unknown'],['both','Portrait and landscape'],['portrait','Portrait only'],['landscape','Landscape only']])}
      ${PAGE_SIDES.map(side=>mmInput(`${side} nonprintable margin (mm)`,`printer-margin-${side}`,profile.nonPrintableMm?.[side],0,100)).join('')}
      ${input('DPI (informational only)','printer-dpi',profile.dpi,'type="number" min="72" max="9600" step="1" placeholder="Unknown"')}
      ${select('Cutter (informational only)','printer-cutter',profile.cutter === undefined ? '' : String(profile.cutter),[['','Unknown'],['true','User reports available'],['false','User reports unavailable']])}
      <p class="hint">Blank means unknown, not zero or supported. Dimensions are physical sheet axes after orientation; margins are the selected orientation’s sheet edges. Uncheck to remove the active profile on Apply.</p></div>
      <label>Import local profile JSON<input type="file" accept="application/json,.json" data-printer-profile-file></label>
      <button type="button" data-printer-profile-export>Download profile JSON</button>
      <p class="hint" role="status" data-printer-profile-status></p>
      <p class="hint">Import fills this form only. Review and Apply; Undo/Redo reverts applied paper and profile together. Profiles are embedded in saved projects and portable HTML, never uploaded.</p>
    </div></details>
    <p class="hint" data-physical-status="blocked">${escape(status.message)}</p>
    <p class="hint">Unknown: ${escape(status.unknown.join(', ') || 'none declared; all declarations remain physically unverified')}.</p>
  </div></details>`;
}
export function profileFromForm(values) {
  const get = name => String(values.get(name) ?? '').trim();
  const profile = {version:1,source:'user-supplied',name:get('printer-name')};
  for (const key of ['minWidthMm','maxWidthMm','minHeightMm','maxHeightMm','dpi']) if (get(`printer-${key}`)) profile[key] = Number(get(`printer-${key}`));
  const orientation = get('printer-orientations');
  if (orientation) profile.orientations = orientation === 'both' ? ['portrait','landscape'] : [orientation];
  const margins = Object.fromEntries(PAGE_SIDES.filter(side=>get(`printer-margin-${side}`)).map(side=>[side,Number(get(`printer-margin-${side}`))]));
  if (Object.keys(margins).length) profile.nonPrintableMm = margins;
  const cutter = get('printer-cutter');
  if (cutter) { if (!['true','false'].includes(cutter)) throw new Error('Unsupported cutter declaration.'); profile.cutter = cutter === 'true'; }
  return validatePrinterProfile(profile);
}
export function pageFromForm(values) {
  const page = {paper:String(values.get('paper') ?? ''),orientation:String(values.get('orientation') ?? ''),margins:Object.fromEntries(PAGE_SIDES.map(side=>[side,Number(values.get(`margin-${side}`))]))};
  if (page.paper === 'CUSTOM') page.customSizeMm = {width:Number(values.get('paper-width-mm')),height:Number(values.get('paper-height-mm'))};
  if (values.has('printer-enabled')) page.printerProfile = profileFromForm(values);
  return page;
}
export function syncPaperForm(form) {
  const custom = form.querySelector('[data-custom-paper]'), fields = form.querySelector('[data-printer-fields]');
  if (!custom || !fields) return;
  custom.hidden = form.elements.paper.value !== 'CUSTOM';
  fields.hidden = !form.elements['printer-enabled'].checked;
  custom.querySelectorAll('input,select').forEach(node=> { node.disabled = custom.hidden; });
  fields.querySelectorAll('input,select').forEach(node=> { node.disabled = fields.hidden; });
}
function fillProfile(form,profile) {
  form.elements['printer-enabled'].checked = true;
  form.elements['printer-name'].value = profile.name;
  for (const key of ['minWidthMm','maxWidthMm','minHeightMm','maxHeightMm','dpi']) form.elements[`printer-${key}`].value = profile[key] ?? '';
  form.elements['printer-orientations'].value = profile.orientations?.length === 2 ? 'both' : profile.orientations?.[0] || '';
  for (const side of PAGE_SIDES) form.elements[`printer-margin-${side}`].value = profile.nonPrintableMm?.[side] ?? '';
  form.elements['printer-cutter'].value = profile.cutter === undefined ? '' : String(profile.cutter);
  syncPaperForm(form); form.elements['printer-name'].dispatchEvent(new Event('input',{bubbles:true}));
}
export function installPaperControls(report) {
  document.addEventListener('change',async event=> {
    const form = event.target.closest('form[data-form="style"]');
    if (!form?.querySelector('[data-paper-controls]')) return;
    syncPaperForm(form);
    if (!event.target.matches('[data-printer-profile-file]')) return;
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 16384) throw new Error('Choose a profile JSON file under 16 KB.');
      const profile = validatePrinterProfile(JSON.parse(await file.text()));
      if (!form.isConnected) throw new Error('The form changed. Import the profile again.');
      fillProfile(form,profile);
      form.querySelector('[data-printer-profile-status]').textContent = 'Imported user declarations into the pending form. Review, then Apply; no device has been verified.';
    } catch (error) { report(error.message); }
  });
  document.addEventListener('click',event=> {
    const button = event.target.closest('[data-printer-profile-export]'); if (!button) return;
    try {
      const profile = profileFromForm(new FormData(button.form));
      const url = URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)],{type:'application/json'}));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'user-printer-profile.json'; anchor.click();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
      button.form.querySelector('[data-printer-profile-status]').textContent = 'Downloaded user declarations, not a printer certification.';
    } catch (error) { report(error.message); }
  });
}
