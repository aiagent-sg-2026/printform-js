function validEntry(entry) {
  const localized = (value) => value && typeof value.en === "string" && typeof value.zh === "string";
  return entry && typeof entry.id === "string" && /^PF-\d{3}$/.test(entry.no)
    && localized(entry.title) && localized(entry.style)
    && typeof entry.type === "string" && typeof entry.paper === "string"
    && Array.isArray(entry.tags) && entry.tags.every((tag) => typeof tag === "string")
    && /^designs\/[\w-]+\.html$/.test(entry.file) && /^thumbs\/[\w-]+\.png$/.test(entry.thumb)
    && [entry.pages, entry.width, entry.height].every((value) => Number.isFinite(value) && value > 0);
}
export async function loadManifest(url = "../manifest.json") {
  const response = await fetch(new URL(url, import.meta.url), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Gallery manifest request failed: ${response.status}`);
  const entries = await response.json();
  if (!Array.isArray(entries) || !entries.every(validEntry)) throw new TypeError("Gallery manifest has invalid entries");
  return entries;
}
