/* PF-057: integer basis-point arithmetic; no currency savings claims. */
(function (root) {
  'use strict';
  const integer = value => {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Expected non-negative safe integer');
    return value;
  };
  function resultingBp(baseBp, rebateBp) {
    integer(baseBp); integer(rebateBp);
    if (rebateBp > 10000) throw new RangeError('Rebate exceeds 100%');
    const product = baseBp * (10000 - rebateBp);
    if (!Number.isSafeInteger(product) || product % 10000) throw new RangeError('Fractional or unsafe basis-point result');
    return product / 10000;
  }
  const percent = bp => `${(integer(bp) / 100).toFixed(2)}%`;
  const rebatePercent = bp => `${Number((integer(bp) / 100).toFixed(2))}%`;
  const number = value => integer(value).toLocaleString('en-GB');
  function validate(data) {
    for (const group of data.withRebate) {
      if (!['demo', 'other'].includes(group.destination) || !group.tiers.length) throw new Error('Invalid group');
      let next = group.tiers[0].incomeMinRM;
      for (const tier of group.tiers) {
        integer(tier.incomeMinRM);
        if (tier.incomeMinRM !== next) throw new Error('Non-contiguous income bands');
        resultingBp(group.baseBp, tier.rebateBp);
        if (tier.incomeMaxRM !== null) {
          integer(tier.incomeMaxRM);
          if (tier.incomeMaxRM < tier.incomeMinRM) throw new Error('Invalid income band');
          next = tier.incomeMaxRM + 1;
        } else next = null;
      }
      if (next !== null) throw new Error('Final tier must be open-ended');
    }
    data.withoutRebate.forEach(tier => integer(tier.rateBp));
    return true;
  }
  const api = { resultingBp, percent, rebatePercent, number, validate };
  root.PF057Math = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
