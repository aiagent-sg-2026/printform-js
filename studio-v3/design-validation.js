import { BLOCKS, FIELD_STYLE_KEYS, FIELD_KINDS, PAPERS, ORIENTATIONS, ALIGNMENTS, FORMATS, validPointer, fieldKind, sectionOrder } from './design-authoring.js';
import { A4_PRESET_IDS } from './a4-presets.js';
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const number = (value,min,max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const identifier = value => typeof value === 'string' && /^[a-z0-9-]{1,60}$/.test(value);
const text = (value,max) => typeof value === 'string' && value.length <= max;
const fail = message => { throw new Error(message); };
export function exactDesignKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail(`Unsupported ${label} property.`);
}
export function validateFieldStyle(style) {
  exactDesignKeys(style,FIELD_STYLE_KEYS,'field style');
  if (style.fontSize !== undefined && !number(style.fontSize,6,72)) fail('Field font size must be between 6 and 72pt.');
  if (style.bold !== undefined && typeof style.bold !== 'boolean') fail('Field bold must be a boolean.');
  if (style.color !== undefined && !color(style.color)) fail('Field color must be a six-digit hex color.');
  if (style.align !== undefined && !ALIGNMENTS.includes(style.align)) fail('Unsupported field alignment.');
  return style;
}
function image(value,assets,label) {
  if (!identifier(value.assetId) || !assets.has(value.assetId)) fail(`${label} must reference an existing embedded raster asset.`);
  if (!number(value.width,8,400) || !number(value.height,8,200)) fail(`${label} dimensions must be 8–400px wide and 8–200px high.`);
  if (value.fit !== undefined && !['contain','cover'].includes(value.fit)) fail('Unsupported image fit.');
}
function validateAssets(d) {
  const assets = new Set();
  if (d.assets !== undefined) {
    if (!Array.isArray(d.assets) || d.assets.length > 10) fail('Use at most ten embedded images.');
    let bytes = 0;
    d.assets.forEach(a => {
      exactDesignKeys(a,['id','src','alt'],'asset');
      if (!identifier(a.id) || assets.has(a.id) || !text(a.alt,200)) fail('Invalid or duplicate asset id or alt text.');
      if (typeof a.src !== 'string' || !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.src)) fail('Images must be embedded PNG, JPEG, GIF or WebP data URLs.');
      const data = a.src.slice(a.src.indexOf(',')+1);
      if (data.length % 4 !== 0 || data.length > 1398104) fail('Embedded image exceeds the 1 MB limit or has invalid base64.');
      const prefix = data.slice(0,16);
      const mime = a.src.slice(11,a.src.indexOf(';'));
      if (!({png:prefix.startsWith('iVBORw0KGgo'),jpeg:prefix.startsWith('/9j/'),gif:prefix.startsWith('R0lGOD'),webp:prefix.startsWith('UklGR')}[mime])) fail('Image bytes do not match the declared raster type.');
      bytes += data.length; assets.add(a.id);
    });
    if (bytes > 5592408) fail('Embedded assets exceed the 4 MB total limit.');
  }
  if (d.logo !== undefined && d.logo !== null) {
    exactDesignKeys(d.logo,['assetId','width','height','fit'],'logo'); image(d.logo,assets,'Logo');
  }
  const references = [d.logo,...BLOCKS.filter(id=>id !== 'items').flatMap(id=>Array.isArray(d[id]) ? d[id].filter(f=>f?.kind === 'image') : [])].filter(Boolean);
  const projectedBytes = (d.assets || []).reduce((sum,a)=>sum+a.src.length,0)+references.reduce((sum,ref)=>sum+(d.assets?.find(a=>a.id===ref.assetId)?.src.length || 0),0);
  if (projectedBytes > 5592408) fail('Repeated embedded images exceed the 4 MB portable asset budget.');
  return assets;
}
function validatePage(page) {
  exactDesignKeys(page,['paper','orientation','margins'],'page');
  if (page.paper !== undefined && !PAPERS.includes(page.paper)) fail('Unsupported paper size.');
  if (page.orientation !== undefined && !ORIENTATIONS.includes(page.orientation)) fail('Unsupported paper orientation.');
  if (page.margins !== undefined) {
    exactDesignKeys(page.margins,['top','right','bottom','left'],'page margin');
    if (Object.values(page.margins).some(v => !number(v,0,72))) fail('Page margins must be between 0 and 72px.');
  }
}
function validateBlock(block,id) {
  exactDesignKeys(block,['enabled','label','layout','breakBefore','keepTogether'],`${id} block`);
  if (typeof block.enabled !== 'boolean' || !text(block.label,100)) fail(`Invalid ${id} block.`);
  for (const key of ['breakBefore','keepTogether']) if (block[key] !== undefined && typeof block[key] !== 'boolean') fail(`Invalid ${key} setting.`);
  if (block.layout !== undefined) {
    exactDesignKeys(block.layout,['columns','gap'],'section layout');
    if (block.layout.columns !== undefined && (!Number.isInteger(block.layout.columns) || !number(block.layout.columns,1,4))) fail('Section layout needs one to four columns.');
    if (block.layout.gap !== undefined && !number(block.layout.gap,0,48)) fail('Section gap must be between 0 and 48px.');
    if (id === 'items') fail('Table layout uses column widths, not section grid columns.');
  }
}
function validateField(f,id,assets,ids) {
  exactDesignKeys(f,['id','label','pointer','lastPointer','format','text','width','kind','labelStyle','valueStyle','showLabel','assetId','height','fit'],`${id} field`);
  if (!identifier(f.id) || ids.has(`${id}-${f.id}`) || ['header-title','header-logo','items-header','page-number'].includes(`${id}-${f.id}`)) fail('Invalid or duplicate field id.');
  ids.add(`${id}-${f.id}`);
  if (!text(f.label,100) || !FORMATS.includes(f.format ?? '') || (f.text !== undefined && !text(f.text,10000))) fail('Invalid field label, text or format.');
  if (f.kind !== undefined && !FIELD_KINDS.includes(f.kind)) fail('Unsupported field kind.');
  if (f.pointer !== undefined && (typeof f.pointer !== 'string' || (f.pointer && !validPointer(f.pointer,id === 'items')))) fail('Use /field for document bindings and ./field for item bindings. Wildcards and prototype paths are not supported.');
  if (f.lastPointer !== undefined && (typeof f.lastPointer !== 'string' || (f.lastPointer && !validPointer(f.lastPointer,id === 'items')))) fail('Invalid saved binding pointer.');
  if (fieldKind(f) === 'bound' && !f.pointer) fail('A bound field needs a JSON pointer.');
  if (fieldKind(f) !== 'bound' && f.pointer) fail('Static text and images cannot have data bindings.');
  if (f.showLabel !== undefined && typeof f.showLabel !== 'boolean') fail('showLabel must be a boolean.');
  for (const key of ['labelStyle','valueStyle']) if (f[key] !== undefined) validateFieldStyle(f[key]);
  if (fieldKind(f) === 'image') {
    if (id === 'items') fail('Table columns support bound values or static text.');
    image(f,assets,'Image field');
    if (f.format || f.text) fail('Image fields cannot contain text or numeric formatting.');
  } else if (['assetId','height','fit'].some(key => f[key] !== undefined) || (id !== 'items' && f.width !== undefined)) fail('Image dimensions belong to image fields.');
  if (id === 'items' && !number(f.width,1,100)) fail('Column width must be between 1 and 100%.');
}
export function validateDesign(d) {
  exactDesignKeys(d,['version','title','type','color','font','padding','striped','borders','repeatHeader','repeatTable','pageNumbers','breakBefore','blocks','header','customer','collection','columns','totals','footer','sectionOrder','page','assets','logo','titleStyle','pageNumberStyle','tableStyle','layoutPreset'],'design');
  if (d.layoutPreset !== undefined && !A4_PRESET_IDS.includes(d.layoutPreset)) fail('Unsupported document layout preset.');
  if (d.version !== 1 || !['invoice','purchase','delivery'].includes(d.type)) fail('Unsupported v3 template version or document type.');
  if (!text(d.title,100)) fail('Document heading must contain at most 100 characters.');
  if (!color(d.color) || !number(d.font,6,14) || !number(d.padding,2,16)) fail('Invalid print style settings.');
  if (d.tableStyle !== undefined) {
    exactDesignKeys(d.tableStyle,['rowBackground'],'table style');
    if (d.tableStyle.rowBackground !== undefined && !color(d.tableStyle.rowBackground)) fail('Table row background must be a six-digit hex color.');
  }
  exactDesignKeys(d.blocks,BLOCKS,'blocks');
  const assets = validateAssets(d), ids = new Set();
  BLOCKS.forEach(id => {
    validateBlock(d.blocks[id],id);
    const fields = id === 'items' ? d.columns : d[id];
    if (!Array.isArray(fields) || fields.length > 30) fail('A block supports at most 30 fields.');
    fields.forEach(f => validateField(f,id,assets,ids));
  });
  if (!validPointer(d.collection)) fail('Collection must be an absolute JSON pointer such as /items.');
  for (const key of ['striped','borders','repeatHeader','repeatTable','pageNumbers','breakBefore']) if (typeof d[key] !== 'boolean') fail(`Invalid ${key} setting.`);
  if (d.columns.reduce((sum,c) => sum+c.width,0) > 100.01) fail('Column widths must total 100% or less.');
  if (d.sectionOrder !== undefined && (!Array.isArray(d.sectionOrder) || d.sectionOrder.length !== BLOCKS.length || new Set(d.sectionOrder).size !== BLOCKS.length || d.sectionOrder.some(id => !BLOCKS.includes(id)))) fail('Section order must contain every section exactly once.');
  if (d.repeatHeader && sectionOrder(d)[0] !== 'header') fail('A repeating document header must be the first section.');
  if (d.blocks.header.breakBefore) fail('Use section ordering or body section page breaks; document header cannot break before itself.');
  if (d.blocks.items.keepTogether) fail('The items table paginates per row and cannot keep the whole collection together.');
  if (d.page !== undefined) validatePage(d.page);
  for (const key of ['titleStyle','pageNumberStyle']) if (d[key] !== undefined) validateFieldStyle(d[key]);
  return d;
}
