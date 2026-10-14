// CSS layout is quantized (Firefox 1/60px, Blink/WebKit 1/64px).
// Preserve measured fractions; whole-pixel ceil creates false blank sheets.
const LAYOUT_UNIT_PX = 1 / 60;

export function fitsWithinHeight(height, limit) {
  return height <= limit + LAYOUT_UNIT_PX;
}
