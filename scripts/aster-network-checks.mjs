import assert from 'node:assert/strict';

export function watchNetwork(page) {
  const requests = [], failures = [], errors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('requestfailed', request => failures.push({url:request.url(), error:request.failure()?.errorText}));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  return {requests, failures, errors};
}

export async function checkFonts(page) {
  const fonts = await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 14px AsterSans', 'Review 123'),
      document.fonts.load('700 14px AsterSans', 'Review 123'),
      document.fonts.load('400 14px AsterCJK', '中文测试')
    ]);
    await document.fonts.ready;
    return [...document.fonts].map(font => ({family:font.family, weight:font.weight, status:font.status}));
  });
  assert.equal(fonts.length, 3, 'all three genuine faces must be present');
  assert.ok(fonts.every(font => font.status === 'loaded'), JSON.stringify(fonts));
  assert.deepEqual(fonts.map(font => font.family).sort(), ['AsterCJK', 'AsterSans', 'AsterSans']);
  return fonts;
}

export function checkNetwork(network, allowed) {
  assert.deepEqual(network.failures, [], 'no ignored font/network failures');
  assert.deepEqual(network.errors, [], 'no browser/console/HTTP errors');
  const actual = network.requests.filter(url => !url.startsWith('data:'));
  assert.deepEqual([...new Set(actual)].sort(), [...new Set(allowed)].sort(), 'exact local request allowlist');
}
