export function smartScrollDecision({ previousY, currentY, accumulated = 0, forced = false, threshold = 8 }) {
  if (forced || currentY <= 48) return { visible: true, accumulated: 0 };
  const delta = currentY - previousY;
  if (Math.sign(delta) !== Math.sign(accumulated) && delta !== 0) accumulated = 0;
  accumulated += delta;
  if (Math.abs(accumulated) < threshold) return { visible: null, accumulated };
  return { visible: accumulated < 0, accumulated: 0 };
}
