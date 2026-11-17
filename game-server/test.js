// node test.js  — self-check for initData validation and boards
'use strict';
process.env.DATA_FILE = require('path').join(require('os').tmpdir(), 'otbz-test-' + process.pid + '.json');
const crypto = require('crypto');
const assert = require('assert');
const { verifyInitData, submit, top, periodKeys } = require('./server');
const TOKEN = '123456:TEST';
function sign(fields, token = TOKEN) {
  const p = new URLSearchParams(fields);
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const now = Math.floor(Date.now() / 1000);
const good = sign({ auth_date: String(now), query_id: 'AA', user: JSON.stringify({ id: 42, first_name: 'Aziz' }) });
assert.strictEqual(verifyInitData(good, TOKEN).id, 42, 'valid initData accepted');
assert.strictEqual(verifyInitData(good, 'other:token'), null, 'wrong token rejected');
assert.strictEqual(verifyInitData(good.replace('Aziz', 'Bobur'), TOKEN), null, 'tampered rejected');
const old = sign({ auth_date: String(now - 3 * 86400), user: JSON.stringify({ id: 1 }) });
assert.strictEqual(verifyInitData(old, TOKEN), null, 'stale rejected');
assert.ok(submit({ id: 42, first_name: 'Aziz' }, 'race', 41.2).ok);
assert.ok(!submit({ id: 42, first_name: 'Aziz' }, 'race', 39).ok, 'rate limited');
assert.ok(!submit({ id: 7, first_name: 'X' }, 'race', 5).ok, 'impossible time rejected');
assert.ok(submit({ id: 7, first_name: 'Sardor' }, 'race', 40.1).ok);
const t = top('race', 'week', 42);
assert.deepStrictEqual(t.top.map((r) => r.name), ['Sardor', 'Aziz']);
assert.strictEqual(t.me.rank, 2);
assert.ok(submit({ id: 9, first_name: 'Jasur' }, 'kopkari', 5).ok);
assert.strictEqual(top('kopkari', 'week').top[0].value, 5);
assert.match(periodKeys(Date.UTC(2026, 10, 17)).week, /^2026-W47$/);
console.log('all tests passed');
process.exit(0);
