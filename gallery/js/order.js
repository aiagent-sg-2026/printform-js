// PF numbers are monotonically assigned additions, not fabricated creation dates.
// Unknown legacy numbers follow numbered entries in their original order.
export function newestFirst(designs) {
  const number = ({ no }) => {
    const match = /^PF-(\d+)$/.exec(no || "");
    const value = match ? Number(match[1]) : NaN;
    return Number.isSafeInteger(value) ? value : -1;
  };
  return designs.map((design, index) => ({ design, index, number: number(design) }))
    .sort((a, b) => b.number - a.number || a.index - b.index)
    .map(({ design }) => design);
}
