export async function loadManifest(url = "../manifest.json") {
  const response = await fetch(new URL(url, import.meta.url));
  if (!response.ok) throw new Error(`Gallery manifest request failed: ${response.status}`);
  const entries = await response.json();
  if (!Array.isArray(entries)) throw new TypeError("Gallery manifest must be an array");
  return entries;
}
