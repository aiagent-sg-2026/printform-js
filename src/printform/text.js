export const ROW_SELECTOR = ".prowitem, .ptac-rowitem, .paddt-rowitem";
export const DEFAULT_READABILITY_WORD_LIMIT = 200;

// An optional readability ceiling, never a substitute for measured paper fit.
// Geometry can break a whitespace-free CJK/RTL token into many grapheme ranges.
export function wordCeilingEnd(points, start, maxWords) {
  maxWords = Math.floor(Number(maxWords));
  if (!Number.isFinite(maxWords) || maxWords <= 0) return points.length - 1;
  if (start >= points.length - 1) return start;
  const ceiling = points[start].wordCount - (points[start].inWord ? 1 : 0) + maxWords;
  let end = start + 1;
  while (end < points.length - 1 && points[end + 1].wordCount <= ceiling) end += 1;
  return end;
}
