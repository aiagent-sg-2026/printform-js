/* Shared by browser and unit tests. Monetary values are integer minor units. */
(function (root) {
  const integer = value => {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Nonnegative safe integer required');
    return value;
  };
  const roundRatio = (a, b, divisor, up = false) => {
    [a, b, divisor].forEach(integer);
    if (!divisor) throw new RangeError('Zero divisor');
    const numerator = BigInt(a) * BigInt(b), d = BigInt(divisor);
    const result = Number((numerator + (up ? d - 1n : d / 2n)) / d);
    return integer(result);
  };
  const account = (source, data) => {
    const sums = { charge: 0, payment: 0, credit: 0 };
    source.transactions.forEach(t => {
      if (!(t.kind in sums)) throw new TypeError('Unknown transaction kind');
      sums[t.kind] += integer(t.minor);
    });
    const closing = integer(source.openingMinor) + sums.charge - sums.payment - sums.credit;
    integer(closing);
    const minimum = Math.min(closing, Math.max(data.minimumFloorMinor,
      roundRatio(closing, data.minimumBasisPoints, 10000, true)));
    return { opening: source.openingMinor, charges: sums.charge, payments: sums.payment,
      credits: sums.credit, closing, minimum };
  };
  const statement = data => {
    const accounts = data.accounts.map(a => account(a, data));
    const total = key => accounts.reduce((sum, a) => sum + a[key], 0);
    return { accounts, closing: total('closing'), minimum: total('minimum'), limit: data.accounts.reduce((s,a) => s + a.limitMinor, 0) };
  };
  const repayment = (config, months) => {
    integer(months);
    if (!months) throw new RangeError('Positive period required');
    const interest = roundRatio(config.principalMinor, config.annualBasisPoints * months, 120000);
    const total = config.principalMinor + interest;
    const regular = Math.floor(total / months);
    return { months, principal: config.principalMinor, interest, total, regular,
      final: total - regular * (months - 1) };
  };
  const money = value => {
    integer(value);
    return `${Math.floor(value / 100).toLocaleString('en-US')}.${String(value % 100).padStart(2, '0')}`;
  };
  root.DemoMoney = { roundRatio, account, statement, repayment, money };
})(typeof window === 'undefined' ? globalThis : window);
