export const ZOOM_KEY = 'printform-studio-v3:zoom';
export function validZoom(value) {
  if (value === 'fit' || value === 'width') return value;
  if (typeof value !== 'string' || !/^(?:0|1|2)(?:\.\d{1,2})?$/.test(value)) return 'fit';
  const number = Number(value); return number >= .15 && number <= 2 ? String(number) : 'fit';
}
export function restoreZoom(select,storage = null) {
  let value = 'fit'; try { value = validZoom((storage || globalThis.localStorage).getItem(ZOOM_KEY)); } catch { /* View remains usable without storage. */ }
  selectZoom(select,value); return value;
}
export function selectZoom(select,value) {
  value = validZoom(value);
  if (![...select.options].some(option=>option.value === value)) {
    const option = document.createElement('option'); option.value = value; option.textContent = `${Math.round(Number(value)*100)}%`; option.dataset.customZoom = 'true'; select.append(option);
  }
  select.value = value;
}
export function persistZoom(select,storage = null) {
  try { (storage || globalThis.localStorage).setItem(ZOOM_KEY,validZoom(select.value)); } catch { /* Preference storage is optional. */ }
}
