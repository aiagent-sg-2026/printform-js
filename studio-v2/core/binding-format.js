function formatter(format, manifest, options) {
  const {locale: configuredLocale, ...intlOptions} = options;
  const locale = configuredLocale || manifest.locale || 'en-MY';
  if (['currency','number','percent'].includes(format)) {
    const defaults = format === 'currency' ? {style:'currency',currency:manifest.currency || 'MYR'} : format === 'percent' ? {style:'percent'} : {};
    return new Intl.NumberFormat(locale, {...defaults, ...intlOptions});
  }
  if (['date','datetime'].includes(format)) {
    const defaults = format === 'datetime' ? {dateStyle:'medium',timeStyle:'short'} : {};
    return new Intl.DateTimeFormat(locale, {...defaults,timeZone:manifest.timeZone || 'Asia/Kuala_Lumpur',...intlOptions});
  }
  return null;
}

function parseOptions(element) {
  const raw = element.getAttribute('data-pf-format-options');
  if (!raw) return {};
  const options = JSON.parse(raw);
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Format options must be a JSON object');
  return options;
}

export function formatBindingValue(element, value, manifest) {
  const format = element.getAttribute('data-pf-format');
  const options = parseOptions(element);
  const configured = formatter(format, manifest, options);
  if (value === undefined || value === null) return '';
  if (['date','datetime'].includes(format)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return configured.format(date);
  }
  return configured ? configured.format(value) : String(value);
}

export function formatIssue(element, error) {
  return {code:'FORMAT_CONFIG',path:element.getAttribute('data-pf-text') || '/',
    component:element.getAttribute('data-pf-component-id') || element.getAttribute('data-pf-table-id') || element.id || null,
    message:error.message,severity:'error'};
}

export function inspectTemplateFormats(template, manifest = {}) {
  let nodes = template?.content?.querySelectorAll?.('[data-pf-format],[data-pf-format-options]') || template?.querySelectorAll?.('[data-pf-format],[data-pf-format-options]');
  if (!nodes) {
    const source = typeof template === 'string' ? template : template?.innerHTML || '';
    nodes = Array.from(source.matchAll(/<[A-Za-z](?:[^"'<>]|"[^"]*"|'[^']*')*>/g), match => ({
      getAttribute(name) {
        const value = new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i').exec(match[0])?.[2];
        return value == null ? null : value.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&');
      }
    })).filter(node => node.getAttribute('data-pf-format') !== null || node.getAttribute('data-pf-format-options') !== null);
  }
  const errors = [];
  for (const element of nodes) {
    try { formatter(element.getAttribute('data-pf-format'), manifest, parseOptions(element)); }
    catch (error) { errors.push(formatIssue(element, error)); }
  }
  return errors;
}
