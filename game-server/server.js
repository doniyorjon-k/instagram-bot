// Otbozor Poyga leaderboard service. Plain Node.js (18+), no dependencies.
// Env: BOT_TOKEN (required, token of @otbozor_game), PORT (8787), DATA_FILE (./data.json),
//      ALLOWED_ORIGINS (comma list, default https://doniyorjon-k.github.io), TZ_OFFSET_MIN (300 = Tashkent).
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const PORT = +process.env.PORT || 8787;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://doniyorjon-k.github.io').split(',').map((s) => s.trim()).filter(Boolean);
const TZ = (+process.env.TZ_OFFSET_MIN || 300) * 60000;
const MAX_AGE = 24 * 3600; // initData older than this is rejected

if (!BOT_TOKEN && require.main === module) { console.error('BOT_TOKEN is required'); process.exit(1); }

/* ---------- storage ---------- */
let db = { boards: {} }; // boards[key][userId] = { name, value, at }
try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
let dirty = false;
setInterval(() => {
  if (!dirty) return; dirty = false;
  const tmp = DATA_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(db), (e) => { if (!e) fs.rename(tmp, DATA_FILE, () => {}); });
}, 3000).unref();

/* ---------- helpers ---------- */
function verifyInitData(initData, token = BOT_TOKEN, now = Date.now() / 1000) {
  if (!initData || typeof initData !== 'string' || initData.length > 4096) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash'); if (!hash) return null;
  p.delete('hash');
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calc = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = +p.get('auth_date');
  if (!authDate || now - authDate > MAX_AGE) return null;
  try { const u = JSON.parse(p.get('user')); if (!u || !u.id) return null; return u; } catch { return null; }
}
function periodKeys(ts = Date.now()) {
  const d = new Date(ts + TZ);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  // ISO week
  const t = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const wy = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(wy, 0, 1)) / 86400000 + 1) / 7);
  return { week: `${wy}-W${String(w).padStart(2, '0')}`, month: `${y}-${String(m).padStart(2, '0')}` };
}
const RULES = {
  race: { better: (a, b) => a < b, ok: (v) => typeof v === 'number' && v >= 30 && v <= 180, fmt: (v) => Math.round(v * 100) / 100 },
  kopkari: { better: (a, b) => a > b, ok: (v) => Number.isInteger(v) && v >= 0 && v <= 40, fmt: (v) => v },
};
const displayName = (u) => String(u.first_name || u.username || 'Chavandoz').replace(/[\u0000-\u001f<>]/g, '').slice(0, 24) + (u.last_name ? ' ' + String(u.last_name)[0] + '.' : '');
const lastPost = new Map();

function submit(user, kind, value) {
  const rule = RULES[kind];
  if (!rule || !rule.ok(value)) return { ok: false, error: 'bad value' };
  const now = Date.now(), prev = lastPost.get(user.id) || 0;
  if (now - prev < 8000) return { ok: false, error: 'slow down' };
  lastPost.set(user.id, now);
  const keys = periodKeys(now);
  const out = {};
  for (const per of ['week', 'month']) {
    const key = `${kind}:${per}:${keys[per]}`;
    const b = db.boards[key] || (db.boards[key] = {});
    const cur = b[user.id];
    if (!cur || rule.better(value, cur.value)) { b[user.id] = { name: displayName(user), value: rule.fmt(value), at: now }; dirty = true; out[per] = true; }
  }
  return { ok: true, improved: out };
}
function top(kind, per, meId, limit = 20) {
  const rule = RULES[kind]; if (!rule || !['week', 'month'].includes(per)) return null;
  const key = `${kind}:${per}:${periodKeys()[per]}`;
  const rows = Object.entries(db.boards[key] || {}).map(([id, r]) => ({ id, ...r }));
  rows.sort((a, b) => (rule.better(a.value, b.value) ? -1 : rule.better(b.value, a.value) ? 1 : a.at - b.at));
  const meIdx = meId ? rows.findIndex((r) => r.id === String(meId)) : -1;
  return {
    period: key,
    top: rows.slice(0, limit).map((r) => ({ name: r.name, value: r.value, me: r.id === String(meId) })),
    me: meIdx >= 0 ? { rank: meIdx + 1, value: rows[meIdx].value } : null,
    total: rows.length,
  };
}

/* ---------- http ---------- */
function send(res, code, obj, origin) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && ORIGINS.includes(origin)) { h['Access-Control-Allow-Origin'] = origin; h['Vary'] = 'Origin'; h['Access-Control-Allow-Headers'] = 'Content-Type'; h['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'; }
  res.writeHead(code, h); res.end(obj === null ? '' : JSON.stringify(obj));
}
const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  const url = new URL(req.url, 'http://x');
  const route = url.pathname.replace(/^\/game-api/, '');
  if (req.method === 'OPTIONS') return send(res, 204, null, origin);
  if (req.method === 'GET' && route === '/health') return send(res, 200, { ok: true }, origin);
  if (req.method === 'GET' && route === '/top') {
    const r = top(url.searchParams.get('kind') || 'race', url.searchParams.get('period') || 'week', url.searchParams.get('me'));
    return r ? send(res, 200, r, origin) : send(res, 400, { error: 'bad query' }, origin);
  }
  if (req.method === 'POST' && route === '/score') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 8192) req.destroy(); });
    req.on('end', () => {
      let j; try { j = JSON.parse(body); } catch { return send(res, 400, { error: 'bad json' }, origin); }
      const user = verifyInitData(j.initData);
      if (!user) return send(res, 401, { error: 'bad initData' }, origin);
      const r = submit(user, j.kind, j.value);
      send(res, r.ok ? 200 : 400, r, origin);
    });
    return;
  }
  send(res, 404, { error: 'not found' }, origin);
});
if (require.main === module) server.listen(PORT, '127.0.0.1', () => console.log(`otbozor-game-api on 127.0.0.1:${PORT}`));
module.exports = { verifyInitData, periodKeys, submit, top, server, _db: () => db };
