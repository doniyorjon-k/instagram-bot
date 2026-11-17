import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone as skClone } from './vendor/SkeletonUtils.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { createKopkari } from './kopkari.js';

/* ================= CONFIG ================= */
const RACE = 800;            // metres
const LANES = [-4.4, -2.2, 0, 2.2, 4.4];
const PLAYER_LANE = 2;
const BOT_URL = 'https://t.me/otbozor_bot';
const SITE_URL = 'https://otbozor.uz';
const GAME_URL = 'https://t.me/otbozor_game';

const HORSES = [
  { id: 'qora', name: 'Qorabayir', desc: 'Shamoldek tez', coat: 0x1d1a1a, mane: 0x050505, speed: 9, stamina: 6, control: 6, price: 0 },
  { id: 'oqboz', name: "Oqbo'z", desc: 'Charchashni bilmaydi', coat: 0xe9e6e1, mane: 0x9a958e, speed: 7, stamina: 9, control: 7, price: 0 },
  { id: 'jiyron', name: 'Jiyron', desc: 'Itoatkor va aniq', coat: 0xa0522d, mane: 0x5a2a12, speed: 8, stamina: 7, control: 9, price: 0, blaze: true },
  { id: 'lokay', name: 'Lokay', desc: "Tog' oti, temirdek chidamli", coat: 0x7a4a2a, mane: 0x1a0f08, speed: 8, stamina: 10, control: 8, price: 300 },
  { id: 'axal', name: 'Axalteke', desc: 'Oltin tusli, chaqmoqdek', coat: 0xd1a054, mane: 0xa8742f, speed: 10, stamina: 7, control: 8, price: 600 },
  { id: 'arab', name: 'Arab oti', desc: 'Afsonaviy, hamma narsada kuchli', coat: 0xc9c4bd, mane: 0x6b6762, speed: 10, stamina: 9, control: 10, price: 1200, blaze: true },
];
const SILKS = [
  { c: 0x16a34a, cap: 0xffffff, name: 'Otbozor yashil', price: 0 },
  { c: 0xdc2626, cap: 0xffffff, name: 'Qizil', price: 100 },
  { c: 0x2563eb, cap: 0xfacc15, name: "Ko'k", price: 100 },
  { c: 0xdb2777, cap: 0xffffff, name: 'Pushti', price: 150 },
  { c: 0x0f172a, cap: 0xf59e0b, name: 'Qora-oltin', price: 250 },
  { c: 0xeab308, cap: 0x15803d, name: 'Oltin', price: 400 },
];
const THEMES = {
  dala: { name: 'Dala', sub: "Yashil dala, quyoshli kun", sky: ['#5fb3e8', '#bfe3f7', '#f2f8f2'], fog: 0xdcefe9, fogNear: 90, fogFar: 420, grass: ['#7cbf4a', 'rgba(40,110,30,.22)', 'rgba(200,240,140,.18)'], dirt: '#c99a6b', hemi: 1.0, sun: 2.6, sunC: 0xffe9c4, crown: [0.28, 0.45, 0.32], mtnZ: 0, hurdles: false },
  tog: { name: "Tog'", sub: "Tog' etagi, to'siqlar bilan", sky: ['#4f9fd8', '#a9d6f0', '#eef4ea'], fog: 0xd5e6e6, fogNear: 70, fogFar: 360, grass: ['#93a85a', 'rgba(90,100,40,.25)', 'rgba(220,220,150,.18)'], dirt: '#b98d62', hemi: 1.0, sun: 2.8, sunC: 0xfff0d0, crown: [0.22, 0.4, 0.27], mtnZ: 170, hurdles: true },
  qor: { name: 'Qor', sub: 'Qorli dala, sovuq havo', sky: ['#9fb4c8', '#d6e0ea', '#f4f6f8'], fog: 0xe6ecf2, fogNear: 40, fogFar: 260, grass: ['#f3f6f9', 'rgba(170,190,210,.25)', 'rgba(255,255,255,.5)'], dirt: '#cbbfb2', hemi: 1.15, sun: 1.6, sunC: 0xf3f6ff, crown: [0.3, 0.12, 0.82], mtnZ: 60, hurdles: false, snow: true },
  kech: { name: 'Kechki', sub: 'Chiroqlar ostida tungi poyga', sky: ['#070d24', '#1c2f5e', '#c2410c'], fog: 0x121a33, fogNear: 50, fogFar: 300, grass: ['#2f5a2a', 'rgba(10,40,10,.3)', 'rgba(120,170,90,.12)'], dirt: '#8a6a4c', hemi: 0.45, sun: 0.7, sunC: 0x9bb4ff, crown: [0.3, 0.4, 0.16], mtnZ: 0, hurdles: false, night: true },
};
const THEME_KEYS = Object.keys(THEMES);
const HURDLES_AT = [180, 330, 480, 630];
const API = (window.OTBOZOR_GAME_API || '').replace(/\/$/, '');
const TOURNAMENT_PRIZE = window.OTBOZOR_PRIZE || "Otbozor'dan maxsus sovg'a";
const RIVALS = [
  { name: "To'riq",  coat: 0x6b3a1e, mane: 0x1c1009, silk: 0xef4444, cap: 0xffffff },
  { name: 'Saman',   coat: 0xc9a46a, mane: 0xf1e3c4, silk: 0x2563eb, cap: 0xfacc15 },
  { name: "Ko'kqashqa", coat: 0x8a8f95, mane: 0x3b3f44, silk: 0xf59e0b, cap: 0x0f172a },
  { name: 'Chavkar', coat: 0x4a2a18, mane: 0x120a05, silk: 0x9333ea, cap: 0xffffff },
];
const PLAYER_SILK = 0x16a34a, PLAYER_CAP = 0xffffff;

/* ================= STATE / STORAGE ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('otbz_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('otbz_' + k, JSON.stringify(v)); } catch {} },
};
let sel = Math.min(store.get('horse', 0), HORSES.length - 1);
const owned = () => store.get('owned', ['qora', 'oqboz', 'jiyron']);
const ownedSilk = () => store.get('ownedSilk', [0]);
let silkSel = store.get('silk', 0);
let themeSel = store.get('theme', 'dala');
const coins = () => store.get('coins', 0);
const addCoins = (n) => store.set('coins', Math.max(0, coins() + n));
function dayKey(d = new Date()) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let muted = store.get('muted', false);

/* ================= TELEGRAM ================= */
const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined ? window.Telegram.WebApp : null;
if (tg) {
  try {
    tg.ready(); tg.expand();
    tg.disableVerticalSwipes && tg.disableVerticalSwipes();
    tg.setHeaderColor && tg.setHeaderColor('#ffffff');
    tg.setBackgroundColor && tg.setBackgroundColor('#eaf6ff');
  } catch {}
}
const haptic = (kind, style) => {
  try {
    const h = tg && tg.HapticFeedback; if (!h) { if (navigator.vibrate && kind === 'impact') navigator.vibrate(style === 'heavy' ? 25 : 10); return; }
    if (kind === 'impact') h.impactOccurred(style); else if (kind === 'notify') h.notificationOccurred(style); else h.selectionChanged();
  } catch {}
};
const openTg = (url) => { try { if (tg && tg.openTelegramLink) return tg.openTelegramLink(url); } catch {} window.open(url, '_blank'); };
const openLink = (url) => { try { if (tg && tg.openLink) return tg.openLink(url); } catch {} window.open(url, '_blank'); };

/* ================= AUDIO (synth, no files) ================= */
const Audio = (() => {
  let ctx = null, master = null, noiseBuf = null, crowd = null;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; }
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slide = 0) {
    if (!ctx) return; const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, freq, vol, q = 1, when = 0) {
    if (!ctx) return; const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  return {
    init,
    setMuted(m) { if (master) master.gain.value = m ? 0 : 0.8; },
    hoof(v = 1) { noise(0.07, 180 + Math.random() * 60, 0.35 * v, 2); tone(70 + Math.random() * 20, 0.06, 'sine', 0.25 * v); },
    perfect(combo) { const b = 660 * Math.pow(1.06, Math.min(combo, 8)); tone(b, 0.12, 'triangle', 0.25); tone(b * 1.5, 0.18, 'triangle', 0.18, 0.05); },
    good() { tone(520, 0.1, 'triangle', 0.2); },
    miss() { tone(180, 0.18, 'sawtooth', 0.12, 0, 0.6); },
    beep(hi) { tone(hi ? 880 : 440, hi ? 0.45 : 0.18, 'square', 0.12); },
    whoosh() { noise(0.35, 900, 0.15, 0.6); },
    click() { tone(900, 0.04, 'triangle', 0.12); },
    cheer(on) {
      if (!ctx) return;
      if (on && !crowd) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.5;
        const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 1.2);
        s.connect(f); f.connect(g); g.connect(master); s.start(); crowd = { s, g };
      } else if (!on && crowd) {
        const c = crowd; crowd = null; c.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5); c.s.stop(ctx.currentTime + 1.6);
      }
    },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, i * 0.12)); },
  };
})();

/* ================= RENDERER / SCENE ================= */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.4, 900);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// sky gradient
scene.background = canvasTex(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#5fb3e8'); gr.addColorStop(0.55, '#bfe3f7'); gr.addColorStop(1, '#f2f8f2');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
scene.fog = new THREE.Fog(0xdcefe9, 90, 420);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const hemi = new THREE.HemisphereLight(0xe8f6ff, 0x8a6b4a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe9c4, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

/* ---------- ground & track ---------- */
const TRACK_START = 40, TRACK_END = -RACE - 220, TRACK_LEN = TRACK_START - TRACK_END;
function drawDirt(g, w, h, col) {
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random(); g.fillStyle = v > .5 ? 'rgba(255,240,220,.18)' : 'rgba(90,55,25,.16)';
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 3);
  }
  for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(110,70,35,.10)'; g.fillRect(x + Math.random() * 4, 0, 2, h); }
}
const dirtTex = canvasTex(256, 256, (g, w, h) => drawDirt(g, w, h, '#c99a6b'), [4, TRACK_LEN / 8]);
const track = new THREE.Mesh(new THREE.PlaneGeometry(14, TRACK_LEN), new THREE.MeshLambertMaterial({ map: dirtTex }));
track.rotation.x = -Math.PI / 2; track.position.set(0, 0.04, (TRACK_START + TRACK_END) / 2); track.receiveShadow = true;
scene.add(track);

function drawGrass(g, w, h, c) {
  g.fillStyle = c[0]; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = Math.random() > .5 ? c[1] : c[2];
    g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3);
  }
}
const grassTex = canvasTex(256, 256, (g, w, h) => drawGrass(g, w, h, THEMES.dala.grass), [40, 160]);
const grass = new THREE.Mesh(new THREE.PlaneGeometry(600, 1400), new THREE.MeshLambertMaterial({ map: grassTex }));
grass.rotation.x = -Math.PI / 2; grass.position.z = -400; grass.receiveShadow = true;
scene.add(grass);

// rails
const railMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
for (const x of [-7.2, 7.2]) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, TRACK_LEN), railMat);
  rail.position.set(x, 1.05, (TRACK_START + TRACK_END) / 2); rail.castShadow = true; scene.add(rail);
  const n = Math.floor(TRACK_LEN / 4);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.05, 0.1), railMat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m.makeTranslation(x, 0.52, TRACK_START - i * 4); posts.setMatrixAt(i, m); }
  posts.castShadow = true; scene.add(posts);
}
// green running stripe outside rails
for (const x of [-7.9, 7.9]) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, TRACK_LEN), new THREE.MeshLambertMaterial({ color: 0x15803d }));
  s.rotation.x = -Math.PI / 2; s.position.set(x, 0.05, (TRACK_START + TRACK_END) / 2); s.receiveShadow = true; scene.add(s);
}

// lane lines (subtle)
for (let i = 0; i < LANES.length - 1; i++) {
  const x = (LANES[i] + LANES[i + 1]) / 2;
  const l = new THREE.Mesh(new THREE.PlaneGeometry(0.05, TRACK_LEN), new THREE.MeshBasicMaterial({ color: 0xe8cfb0, transparent: true, opacity: .45 }));
  l.rotation.x = -Math.PI / 2; l.position.set(x, 0.06, (TRACK_START + TRACK_END) / 2); scene.add(l);
}

// start & finish lines
function lineAt(z, tex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.2), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.07, z); m.receiveShadow = true; scene.add(m);
}
const checker = canvasTex(256, 24, (g, w, h) => {
  const s = 12; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { g.fillStyle = ((x + y) / s) % 2 ? '#0f172a' : '#ffffff'; g.fillRect(x, y, s, s); }
});
lineAt(-RACE, checker);
lineAt(-1.9, canvasTex(8, 8, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); }));

// signs / banners
function textTex(w, h, bg, lines) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (const L of lines) {
      g.fillStyle = L.color; g.font = `${L.weight || 900} ${L.size}px Inter, Arial, sans-serif`;
      g.textAlign = L.align || 'center'; g.textBaseline = 'middle'; g.fillText(L.text, L.x ?? w / 2, L.y);
    }
  });
}
const logoImg = new Image(); logoImg.src = 'logo.png';
function boardTex(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const draw = () => {
    const g = c.getContext('2d');
    if (kind === 0) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 128);
      if (logoImg.complete && logoImg.naturalWidth) g.drawImage(logoImg, 14, 10, 160, 109);
      g.fillStyle = '#0f172a'; g.font = '900 64px Inter, Arial'; g.textBaseline = 'middle'; g.fillText('Ot', 190, 66);
      g.fillStyle = '#16a34a'; g.fillText('bozor', 190 + g.measureText('Ot').width, 66);
    } else if (kind === 1) {
      g.fillStyle = '#16a34a'; g.fillRect(0, 0, 512, 128);
      g.fillStyle = '#fff'; g.font = '900 58px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('@otbozor_bot', 256, 66);
    } else {
      g.fillStyle = '#0f172a'; g.fillRect(0, 0, 512, 128);
      g.fillStyle = '#fff'; g.font = '900 60px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('otbozor.uz', 256, 66);
    }
    t.needsUpdate = true;
  };
  draw(); logoImg.addEventListener('load', draw);
  return t;
}
const boardTexs = [boardTex(0), boardTex(1), boardTex(2)];
const boardGeo = new THREE.PlaneGeometry(4, 1);
const legGeo = new THREE.BoxGeometry(0.08, 1.2, 0.08);
const darkMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
let bi = 0;
for (let z = -30; z > -RACE - 100; z -= 34) {
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(boardGeo, new THREE.MeshLambertMaterial({ map: boardTexs[bi++ % 3] }));
    b.position.y = 1.7; b.castShadow = true; g.add(b);
    for (const dx of [-1.6, 1.6]) { const l = new THREE.Mesh(legGeo, darkMat); l.position.set(dx, 0.6, -0.05); g.add(l); }
    g.position.set(side * 9.4, 0, z + (side > 0 ? 17 : 0));
    g.rotation.y = side * -0.35;
    scene.add(g);
  }
}
// distance markers (metres to go)
for (let d = 700; d >= 100; d -= 100) {
  const tex = textTex(128, 128, '#ffffff', [{ text: String(d), size: 54, y: 66, color: '#15803d' }]);
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2), new THREE.MeshLambertMaterial({ color: 0xffffff })); p.position.y = 1.1; g.add(p);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); s.position.y = 2.4; g.add(s);
  g.position.set(-7.2, 0, -(RACE - d)); g.rotation.y = 0.5; scene.add(g);
}

// finish arch
{
  const g = new THREE.Group();
  const pm = new THREE.MeshLambertMaterial({ color: 0x15803d });
  for (const x of [-7.6, 7.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), pm); p.position.set(x, 3, 0); p.castShadow = true; g.add(p); }
  const tex = textTex(1024, 128, '#16a34a', [
    { text: 'MARRA', size: 84, y: 68, color: '#ffffff', x: 512 },
  ]);
  const ban = new THREE.Mesh(new THREE.BoxGeometry(15.7, 1.4, 0.3), [pm, pm, pm, pm, new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ map: tex })]);
  ban.position.y = 6.2; ban.castShadow = true; g.add(ban);
  g.position.z = -RACE; scene.add(g);
}
// start gate
{
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i <= LANES.length; i++) {
    const x = -5.5 + i * 2.2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3, 2.6), m); p.position.set(x, 1.5, 0); p.castShadow = true; g.add(p);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.5, 2.6), new THREE.MeshLambertMaterial({ color: 0x16a34a })); top.position.y = 3.2; g.add(top);
  g.position.z = 3.7; scene.add(g);
}

// grandstand with crowd near finish (left)
{
  const g = new THREE.Group();
  const base = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
  for (let r = 0; r < 6; r++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 120), base);
    step.position.set(-r * 2.4, 0.4 + r * 0.8, 0); step.receiveShadow = true; step.castShadow = true; g.add(step);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 0.3, 122), new THREE.MeshLambertMaterial({ color: 0x15803d }));
  roof.position.set(-6, 9.2, 0); roof.rotation.z = -0.12; g.add(roof);
  const cols = [0xef4444, 0x3b82f6, 0xfacc15, 0xffffff, 0x16a34a, 0xf97316, 0x0f172a, 0xa855f7];
  const n = 6 * 70;
  const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.9, 0.5), new THREE.MeshLambertMaterial(), n);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  let k = 0;
  for (let r = 0; r < 6; r++) for (let i = 0; i < 70; i++) {
    m.makeTranslation(-r * 2.4 + (Math.random() - .5), 1.25 + r * 0.8, -58 + i * 1.66 + Math.random() * .4);
    crowd.setMatrixAt(k, m); crowd.setColorAt(k, c.setHex(cols[(Math.random() * cols.length) | 0])); k++;
  }
  g.add(crowd);
  g.position.set(-13.5, 0, -RACE + 30);
  scene.add(g);
  window.__crowd = crowd;
}

// trees & mountains
const world = {};
{
  const n = 260;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0x6b4423 }), n);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshLambertMaterial({ color: 0x3f8f3a, flatShading: true }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    let x = side * (14 + Math.random() * 70);
    const z = 40 - Math.random() * (RACE + 300);
    if (side < 0 && z < -RACE + 95 && z > -RACE - 35 && x > -32) x -= 22; // keep stand clear
    const sc = 0.8 + Math.random() * 1.1;
    m.compose(p.set(x, 0.8 * sc, z), q.identity(), s.set(sc, sc, sc)); trunk.setMatrixAt(i, m);
    q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6, 0));
    m.compose(p.set(x, 2.4 * sc, z), q, s.set(sc, sc * 1.25, sc)); crown.setMatrixAt(i, m);
    crown.setColorAt(i, c.setHSL(0.28 + Math.random() * 0.06, 0.45, 0.32 + Math.random() * 0.12));
  }
  trunk.castShadow = crown.castShadow = true;
  scene.add(trunk, crown);
  world.crown = crown;
  const mtn = new THREE.Group(); scene.add(mtn); world.mtn = mtn;
  const mm = new THREE.MeshLambertMaterial({ color: 0x9fb7c9, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const h = 40 + Math.random() * 60;
    const mt = new THREE.Mesh(new THREE.ConeGeometry(50 + Math.random() * 40, h, 5), mm);
    mt.position.set(-260 + i * 36 + Math.random() * 20, h / 2 - 2, -RACE - 260 - Math.random() * 60);
    mt.rotation.y = Math.random() * 3; mtn.add(mt);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(mt.geometry.parameters.radius * 0.28, h * 0.28, 5), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    snow.position.set(mt.position.x, h - 2 - h * 0.14, mt.position.z); snow.rotation.y = mt.rotation.y; mtn.add(snow);
  }
}

/* ---------- clouds ---------- */
const cloudsGroup = new THREE.Group(); scene.add(cloudsGroup);
{
  const tex = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176, y = 50 + Math.random() * 36, r = 22 + Math.random() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
  const mat = new THREE.SpriteMaterial({ map: tex, fog: false, transparent: true, depthWrite: false });
  for (let i = 0; i < 22; i++) {
    const sp = new THREE.Sprite(mat); cloudsGroup.add(sp);
    const s = 50 + Math.random() * 70;
    sp.scale.set(s, s / 2, 1);
    sp.position.set(-300 + Math.random() * 600, 70 + Math.random() * 70, -200 - Math.random() * 900);
  }
}
/* ---------- flags ---------- */
const flags = [];
{
  const fg = new THREE.PlaneGeometry(0.9, 0.55); fg.translate(0.45, 0, 0);
  const mats = [new THREE.MeshLambertMaterial({ color: 0x16a34a, side: THREE.DoubleSide }), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })];
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), pm = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
  const spots = [];
  for (let z = -RACE + 60; z > -RACE - 40; z -= 8) spots.push([-8.6, z], [8.6, z]);
  spots.push([-7.6, -RACE + 0.4], [7.6, -RACE + 0.4]);
  spots.forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const p = new THREE.Mesh(pole, pm); p.position.y = 1.6; g.add(p);
    const f = new THREE.Mesh(fg, mats[i % 2]); f.position.y = 2.9; f.castShadow = true; g.add(f);
    f.rotation.y = x < 0 ? 0 : Math.PI; flags.push(f); scene.add(g);
    if (Math.abs(z + RACE) < 1) { g.position.y = 6.2; }
  });
}
/* ---------- night lamps, stars, snow, hurdles ---------- */
{
  const lamps = new THREE.Group(); lamps.visible = false; scene.add(lamps); world.lamps = lamps;
  const pole = new THREE.CylinderGeometry(0.08, 0.1, 9, 6), pm = new THREE.MeshLambertMaterial({ color: 0x334155 });
  const head = new THREE.BoxGeometry(1.4, 0.35, 0.6), hm = new THREE.MeshBasicMaterial({ color: 0xfff4c2 });
  for (let z = 10; z > -RACE - 60; z -= 45) for (const x of [-9.2, 9.2]) {
    const p = new THREE.Mesh(pole, pm); p.position.set(x, 4.5, z); lamps.add(p);
    const hd = new THREE.Mesh(head, hm); hd.position.set(x * 0.93, 9, z); lamps.add(hd);
  }
  const glowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,190,.9)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const gm = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  lamps.children.filter((c) => c.geometry === head).forEach((hd) => { const sp = new THREE.Sprite(gm); sp.scale.set(5, 5, 1); sp.position.copy(hd.position); lamps.add(sp); });
  const spot = new THREE.SpotLight(0xfff1cf, 0, 60, 0.7, 0.5, 1.2); spot.position.set(0, 18, 0); scene.add(spot, spot.target); world.spot = spot;
  // stars
  const sg = new THREE.BufferGeometry(); const sp = [];
  for (let i = 0; i < 700; i++) { const a = Math.random() * Math.PI * 2, e = 0.08 + Math.random() * 1.2, r = 600; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
  stars.visible = false; scene.add(stars); world.stars = stars;
  // snowfall around the camera
  const SN = 900, pos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { pos[i * 3] = (Math.random() - .5) * 40; pos[i * 3 + 1] = Math.random() * 18; pos[i * 3 + 2] = (Math.random() - .5) * 40; }
  const snowG = new THREE.BufferGeometry(); snowG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flake = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const snow = new THREE.Points(snowG, new THREE.PointsMaterial({ map: flake, size: 0.18, transparent: true, depthWrite: false }));
  snow.visible = false; snow.frustumCulled = false; scene.add(snow); world.snow = snow;
  // hurdles
  const hurdles = new THREE.Group(); hurdles.visible = false; scene.add(hurdles); world.hurdles = hurdles;
  const barTex = canvasTex(256, 16, (g) => { for (let x = 0; x < 256; x += 32) { g.fillStyle = (x / 32) % 2 ? '#ffffff' : '#16a34a'; g.fillRect(x, 0, 32, 16); } });
  const barM = new THREE.MeshLambertMaterial({ map: barTex }), postM = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const brushM = new THREE.MeshLambertMaterial({ color: 0x3f6b2a, flatShading: true });
  for (const d of HURDLES_AT) {
    const g = new THREE.Group(); g.position.z = -d;
    for (const y of [0.55, 0.95]) { const b = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.1, 0.1), barM); b.position.y = y; b.castShadow = true; g.add(b); }
    const brush = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.5, 0.45), brushM); brush.position.y = 0.25; brush.castShadow = true; g.add(brush);
    for (let x = -6.8; x <= 6.81; x += 2.2667) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), postM); p.position.set(x, 0.6, 0); g.add(p); }
    hurdles.add(g);
  }
}
function updateSnow(dt) {
  const s = world.snow; if (!s.visible) return;
  s.position.set(camera.position.x, 0, camera.position.z - 8);
  const a = s.geometry.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    a[i + 1] -= dt * (1.2 + (i % 7) * 0.12); a[i] += Math.sin(T + i) * dt * 0.3;
    if (a[i + 1] < 0) a[i + 1] += 18;
  }
  s.geometry.attributes.position.needsUpdate = true;
}
let curTheme = null, hurdlesOn = false;
function applyTheme(key, hurdles) {
  const th = THEMES[key] || THEMES.dala;
  hurdlesOn = hurdles ?? th.hurdles;
  world.hurdles.visible = hurdlesOn;
  if (curTheme === key) return;
  curTheme = key;
  scene.background = canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.55, th.sky[1]); gr.addColorStop(1, th.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog.color.setHex(th.fog); scene.fog.near = th.fogNear; scene.fog.far = th.fogFar;
  const dg = dirtTex.image.getContext('2d'); drawDirt(dg, 256, 256, th.dirt); dirtTex.needsUpdate = true;
  const gg = grassTex.image.getContext('2d'); drawGrass(gg, 256, 256, th.grass); grassTex.needsUpdate = true;
  hemi.intensity = th.hemi; sun.intensity = th.sun; sun.color.setHex(th.sunC);
  hemi.color.setHex(th.night ? 0x6b7fb8 : 0xe8f6ff); hemi.groundColor.setHex(th.night ? 0x2a2a3a : 0x8a6b4a);
  scene.environmentIntensity = th.night ? 0.25 : 0.5;
  const c = new THREE.Color(), r = rng(7);
  for (let i = 0; i < world.crown.count; i++) world.crown.setColorAt(i, c.setHSL(th.crown[0] + r() * 0.06, th.crown[1], th.crown[2] + r() * 0.1));
  world.crown.instanceColor.needsUpdate = true;
  world.mtn.position.z = th.mtnZ; world.mtn.scale.setScalar(th.mtnZ > 100 ? 1.25 : 1);
  world.lamps.visible = world.stars.visible = !!th.night;
  world.spot.intensity = th.night ? 260 : 0;
  world.snow.visible = !!th.snow;
  cloudsGroup.visible = !th.night;
}

/* ---------- confetti ---------- */
const CONF_N = 260;
const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONF_N);
confetti.frustumCulled = false; confetti.visible = false; scene.add(confetti);
const confP = [];
{
  const cols = [0x16a34a, 0x22c55e, 0xffffff, 0xfacc15, 0xf59e0b, 0x15803d];
  const c = new THREE.Color();
  for (let i = 0; i < CONF_N; i++) { confetti.setColorAt(i, c.setHex(cols[i % cols.length])); confP.push({}); }
}
function burstConfetti(x, z) {
  confetti.visible = true;
  for (const p of confP) {
    p.x = x + (Math.random() - .5) * 6; p.y = 4 + Math.random() * 4; p.z = z + (Math.random() - .5) * 6;
    p.vx = (Math.random() - .5) * 2; p.vy = Math.random() * 3; p.vz = (Math.random() - .5) * 2;
    p.r = Math.random() * 6; p.vr = (Math.random() - .5) * 10;
  }
}
const _e = new THREE.Euler(), _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _cv = new THREE.Vector3(), _cs = new THREE.Vector3();
function updateConfetti(dt) {
  if (!confetti.visible) return;
  confP.forEach((p, i) => {
    p.vy -= 3.5 * dt; p.vy = Math.max(p.vy, -1.6);
    p.x += (p.vx + Math.sin(p.r) * 0.6) * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += p.vr * dt;
    _cm.compose(_cv.set(p.x, Math.max(0.05, p.y), p.z), _cq.setFromEuler(_e.set(p.r, p.r * 0.7, 0)), _cs.set(1, 1, 1));
    confetti.setMatrixAt(i, _cm);
  });
  confetti.instanceMatrix.needsUpdate = true;
}

/* ---------- horse model (Quaternius "Horse", CC0, rigged + animated) ---------- */
const horseGltf = await new GLTFLoader().loadAsync('models/horse.glb');
const HCLIP = Object.fromEntries(horseGltf.animations.map((a) => [a.name, a]));
const HS = 0.56;
const WHITE = new THREE.Color(0xffffff);
function shade(hex, f) { const c = new THREE.Color(hex); return f < 1 ? c.multiplyScalar(f) : c.lerp(WHITE, f - 1); }

const geoCache = {
  jTorso: new THREE.BoxGeometry(0.34, 0.48, 0.24),
  jHead: new THREE.SphereGeometry(0.14, 14, 10),
  jUpperArm: new THREE.CapsuleGeometry(0.055, 0.22, 4, 8),
  jThigh: new THREE.CapsuleGeometry(0.075, 0.28, 4, 8),
  jShin: new THREE.CapsuleGeometry(0.06, 0.24, 4, 8),
  cloth: new THREE.BoxGeometry(0.62, 0.04, 0.62),
  saddle: new THREE.BoxGeometry(0.34, 0.08, 0.42),
  clothSide: new THREE.PlaneGeometry(0.5, 0.36),
  whip: new THREE.CylinderGeometry(0.01, 0.014, 0.6, 5),
};
function numTex(n, silk) {
  return canvasTex(128, 96, (g, w, h) => {
    g.fillStyle = '#' + new THREE.Color(silk).getHexString(); g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(28, 12, 72, 72);
    g.fillStyle = '#0f172a'; g.font = '900 60px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 50);
  });
}

function makeHorse(o) {
  const root = new THREE.Group();
  const model = skClone(horseGltf.scene);
  model.scale.setScalar(HS); model.rotation.y = Math.PI;
  root.add(model);
  const light = new THREE.Color(o.coat).getHSL({}).l > 0.5;
  const recolor = {
    Main: shade(o.coat, 1), Main_Dark: shade(o.coat, light ? 0.8 : 0.62), Main_Light: shade(o.coat, light ? 1.15 : 1.3),
    Hair: new THREE.Color(o.mane), Muzzle: light ? shade(0x8a8580, 1) : shade(o.coat, 0.42),
  };
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.frustumCulled = false;
    const mt = m.material.clone();
    const c = recolor[mt.name.replace(/\.\d+$/, '')];
    if (c) mt.color.copy(c);
    mt.roughness = mt.name.startsWith('Hair') ? 0.95 : 0.62; mt.metalness = 0;
    if (o.blaze && mt.name.startsWith('Muzzle')) mt.color.set(0xf3efe9);
    if (o.ghost) { mt.transparent = true; mt.opacity = 0.42; mt.depthWrite = false; m.castShadow = false; }
    m.material = mt;
  });
  const bone = model.getObjectByName('Torso2') || model.getObjectByName('Torso');

  // rider + tack
  const M = (c, r = 0.5) => new THREE.MeshStandardMaterial({ color: c, roughness: r, transparent: !!o.ghost, opacity: o.ghost ? 0.42 : 1, depthWrite: !o.ghost });
  const silk = M(o.silk, 0.4), cap = M(o.cap, 0.35), white = M(0xf8fafc, 0.6), skin = M(0xd6a57c, 0.7), boots = M(0x111827, 0.45), leather = M(0x3b2314, 0.6);
  const rider = new THREE.Group(); root.add(rider);
  const add = (geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m;
  };
  const clothTex = new THREE.MeshStandardMaterial({ map: numTex(o.num, o.silk), roughness: 0.6 });
  add(geoCache.cloth, silk, rider, 0, 0.0, 0.05);
  add(geoCache.saddle, leather, rider, 0, 0.06, 0.02);
  add(geoCache.clothSide, clothTex, rider, 0.33, -0.17, 0.05, 0, Math.PI / 2, -0.12);
  add(geoCache.clothSide, clothTex, rider, -0.33, -0.17, 0.05, 0, -Math.PI / 2, 0.12);
  const jockey = new THREE.Group(); jockey.position.set(0, 0.32, 0.05); rider.add(jockey);
  // crouched racing posture
  add(geoCache.jTorso, silk, jockey, 0, 0.12, -0.12, -1.15);
  add(geoCache.jHead, skin, jockey, 0, 0.3, -0.4);
  add(new THREE.SphereGeometry(0.155, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap, jockey, 0, 0.32, -0.4, -0.35).scale.set(1, 1.05, 1.15);
  add(new THREE.BoxGeometry(0.2, 0.02, 0.1), cap, jockey, 0, 0.3, -0.56, -0.2); // visor
  const armL = new THREE.Group(); armL.position.set(0.19, 0.2, -0.3); jockey.add(armL);
  const armR = new THREE.Group(); armR.position.set(-0.19, 0.2, -0.3); jockey.add(armR);
  for (const a of [armL, armR]) { add(geoCache.jUpperArm, silk, a, 0, -0.14, -0.05, -0.9); add(new THREE.SphereGeometry(0.045, 8, 6), skin, a, 0, -0.24, -0.2); }
  const whip = add(geoCache.whip, leather, armR, 0, -0.1, -0.15, 0.6);
  for (const s of [1, -1]) {
    add(geoCache.jThigh, white, jockey, s * 0.2, -0.03, 0.02, 1.15, 0, s * 0.25);
    add(geoCache.jShin, boots, jockey, s * 0.27, -0.2, 0.13, -0.5, 0, s * 0.1);
  }

  const mixer = new THREE.AnimationMixer(model);
  const actions = { idle: mixer.clipAction(HCLIP.Idle), gallop: mixer.clipAction(HCLIP.Gallop), walk: mixer.clipAction(HCLIP.Walk), jump: mixer.clipAction(HCLIP.Gallop_Jump) };
  actions.jump.setLoop(THREE.LoopOnce, 1); actions.jump.clampWhenFinished = true;
  actions.idle.time = Math.random() * 3; actions.idle.play();
  root.userData = { model, bone, rider, jockey, armL, armR, whip, mixer, actions, state: 'idle', lastF: 0, whipT: 0, jumpT: 0, phase: Math.random() };
  return root;
}

const _bp = new THREE.Vector3();
const JUMP_T = 0.62;
function startJump(h) { h.mesh.userData.jumpT = JUMP_T; }
function animateHorse(h, dt, speed, t) {
  const u = h.userData;
  let want = speed > 4.5 ? 'gallop' : speed > 0.7 ? 'walk' : 'idle';
  if (u.jumpT > 0) {
    u.jumpT -= dt; want = 'jump';
    const k = 1 - Math.max(0, u.jumpT) / JUMP_T;
    u.model.position.y = Math.sin(Math.PI * k) * 0.95;
    u.actions.jump.timeScale = 1.46 / JUMP_T;
  } else u.model.position.y = 0;
  if (want !== u.state) {
    const a = u.actions[want], b = u.actions[u.state];
    a.reset().play(); b.crossFadeTo(a, want === 'gallop' || want === 'jump' ? 0.15 : 0.5, false); u.state = want;
  }
  u.actions.gallop.timeScale = Math.max(0.8, 0.58 * speed / 7.2);
  u.actions.walk.timeScale = Math.max(0.6, speed / 2.4);
  u.mixer.update(dt);
  // rider follows the back
  u.bone.getWorldPosition(_bp); h.worldToLocal(_bp);
  u.rider.position.set(0, _bp.y + 0.13, _bp.z + 0.12);
  const g = speed > 4.5 && u.state !== 'jump' ? 1 : 0;
  u.jockey.position.y = 0.32 + Math.sin(t * 3) * 0.004 + g * 0.06;
  u.jockey.rotation.x = g * (-0.08 + Math.sin((u.actions.gallop.time / 0.58) * Math.PI * 2) * 0.05);
  // arms push with the rhythm, whip on perfect taps
  const ph = (u.actions.gallop.time / 0.58) * Math.PI * 2;
  u.armL.rotation.x = g * Math.sin(ph) * 0.35;
  u.whipT = Math.max(0, u.whipT - dt);
  u.armR.rotation.x = u.whipT > 0 ? -1.6 + (0.3 - u.whipT) * 9 : g * Math.sin(ph) * 0.35;
  u.whip.visible = u.whipT > 0 || g > 0;
  // footfalls
  if (u.state !== 'gallop') return 0;
  const f = (u.actions.gallop.time / u.actions.gallop.getClip().duration) % 1;
  const steps = Math.floor(f * 4) !== Math.floor(u.lastF * 4) ? 1 : 0;
  u.lastF = f;
  return steps;
}

/* ---------- dust particles ---------- */
const DUST_N = 220;
const dustTex = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(232,206,170,0.9)'); gr.addColorStop(0.5, 'rgba(222,190,150,0.45)'); gr.addColorStop(1, 'rgba(222,190,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
const dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: dustTex, transparent: true, depthWrite: false, fog: true }), DUST_N);
dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
dust.frustumCulled = false;
scene.add(dust);
const dustP = Array.from({ length: DUST_N }, () => ({ life: 0, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, s: 1 }));
let dustI = 0;
function puff(x, z, v, big) {
  const d = dustP[dustI++ % DUST_N];
  d.life = 1; d.x = x + (Math.random() - .5) * 0.6; d.y = 0.15; d.z = z;
  d.vx = (Math.random() - .5) * 1.2; d.vy = 0.6 + Math.random() * (big ? 2 : 1); d.vz = v * 0.15 + Math.random();
  d.s = (big ? 1.8 : 1) * (0.6 + Math.random() * 0.8);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function updateDust(dt) {
  for (let i = 0; i < DUST_N; i++) {
    const d = dustP[i];
    if (d.life > 0) {
      d.life -= dt * 1.4; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vy *= 0.96;
      const sc = d.s * (0.6 + (1 - d.life) * 2.2) * Math.min(1, d.life * 2.5);
      _m.compose(_v.set(d.x, d.y, d.z), camera.quaternion, _s.set(sc, sc, sc));
    } else _m.compose(_v.set(0, -50, 0), _q, _s.set(0, 0, 0));
    dust.setMatrixAt(i, _m);
  }
  dust.instanceMatrix.needsUpdate = true;
}

/* ---------- horses in scene ---------- */
let player = null;
const rivals = [];
function buildPlayer() {
  if (player) scene.remove(player.mesh);
  const H = HORSES[sel], S = SILKS[silkSel] || SILKS[0];
  const mesh = makeHorse({ coat: H.coat, mane: H.mane, silk: S.c, cap: S.cap, num: 3, blaze: H.blaze });
  mesh.position.set(LANES[PLAYER_LANE], 0, 0);
  scene.add(mesh);
  player = { mesh, name: H.name, z: 0, v: 0, me: true, color: '#' + new THREE.Color(S.c).getHexString() };
}
const rivalLanes = [0, 1, 3, 4];
RIVALS.forEach((r, i) => {
  const mesh = makeHorse({ coat: r.coat, mane: r.mane, silk: r.silk, cap: r.cap, num: rivalLanes[i] + 1, blaze: i === 2 });
  mesh.position.set(LANES[rivalLanes[i]], 0, 0);
  scene.add(mesh);
  rivals.push({ mesh, lane: LANES[rivalLanes[i]], name: r.name, z: 0, v: 0, color: '#' + new THREE.Color(r.silk).getHexString(), base: 0, seed: Math.random() * 10 });
});
buildPlayer();
let foes = rivals.slice(), field = [player], ghost = null;

/* ---------- friend challenge (ghost) ---------- */
const B36 = (n, w) => Math.max(0, Math.min(36 ** w - 1, Math.round(n))).toString(36).padStart(w, '0');
function b64u(str) { try { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch { return ''; } }
function unb64u(s) { try { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))); } catch { return ''; } }
function myName() { try { const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user; if (u) return (u.first_name || u.username || '').slice(0, 20); } catch {} return ''; }
function encodeChallenge(r) {
  // g1 + horse + theme + hurdles + 8 splits (centiseconds, base36 x3) + _ + name
  let p = 'g1' + sel.toString(36) + THEME_KEYS.indexOf(r.theme).toString(36) + (r.hurdles ? '1' : '0') + r.splits.map((t) => B36(t * 100, 3)).join('');
  let nm = b64u(myName());
  while (p.length + 1 + nm.length > 64 && nm.length) nm = nm.slice(0, -4);
  return nm ? p + '_' + nm : p;
}
function decodeChallenge(p) {
  if (!p || !p.startsWith('g1') || p.length < 29) return null;
  const horse = parseInt(p[2], 36), theme = THEME_KEYS[parseInt(p[3], 36)] || 'dala', hurdles = p[4] === '1';
  const splits = []; for (let i = 0; i < 8; i++) splits.push(parseInt(p.substr(5 + i * 3, 3), 36) / 100);
  if (splits.some((t, i) => !(t > 0) || (i && t <= splits[i - 1]))) return null;
  const name = p[29] === '_' ? unb64u(p.slice(30)) : '';
  return { horse: Math.min(horse, HORSES.length - 1), theme, hurdles, splits, time: splits[7], name: name || "Do'stingiz" };
}
function startParam() {
  try { if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) return tg.initDataUnsafe.start_param; } catch {}
  const m = /[?&](?:tgWebAppStartParam|startapp|c)=([\w-]+)/.exec(location.search); return m ? m[1] : '';
}
let challenge = decodeChallenge(startParam());
function makeGhost(c) {
  const H = HORSES[c.horse];
  const mesh = makeHorse({ coat: H.coat, mane: H.mane, silk: 0x94a3b8, cap: 0xffffff, num: 2, ghost: true });
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(256, 64, 'rgba(15,23,42,.85)', [{ text: '👻 ' + c.name.slice(0, 14), size: 30, y: 34, color: '#fff' }]), transparent: true, depthWrite: false }));
  label.scale.set(2.2, 0.55, 1); label.position.y = 3.1; mesh.add(label);
  scene.add(mesh);
  return { mesh, name: c.name, z: 0, v: 0, ghost: true, lane: LANES[1], splits: c.splits, color: '#94a3b8', seed: 0, hIdx: 0 };
}
function ghostZ(g, t) {
  const S = g.splits;
  if (t <= 0) return 0;
  let prevT = 0, prevZ = 0;
  for (let i = 0; i < S.length; i++) {
    if (t <= S[i]) { const k = (t - prevT) / (S[i] - prevT); return prevZ + k * 100; }
    prevT = S[i]; prevZ = (i + 1) * 100;
  }
  const lastV = 100 / (S[7] - S[6]);
  return RACE + (t - S[7]) * lastV * Math.max(0, 1 - (t - S[7]) * 0.4);
}

/* ================= UI ================= */
const $ = (id) => document.getElementById(id);
const ui = {
  menu: $('menu'), hud: $('hud'), result: $('result'), count: $('count'), pop: $('pop'), banner: $('banner'), vign: $('vign'),
  needle: $('needle'), zperf: $('zperf'), zgood: $('zgood'), combo: $('combo'), place: $('place'), left: $('left'), time: $('time'),
  stam: $('stam'), stamb: $('stamb'), stamv: $('stamv'), spd: $('spd'), lane: $('lane'), meter: $('meter'), tapline: document.querySelector('.tapline span'),
  sheet: $('sheet'), sheettitle: $('sheettitle'), sheetbody: $('sheetbody'),
};
const dots = [];
function setupDots() {
  ui.lane.querySelectorAll('.dot').forEach((d) => d.remove()); dots.length = 0;
  for (const r of field.length > 1 ? field.slice(1).concat(player) : [player]) {
    const d = document.createElement('div'); d.className = 'dot' + (r.me ? ' me' : ''); d.style.background = r.color;
    ui.lane.appendChild(d); dots.push([r, d]);
  }
}
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function wins() { return store.get('wins', 0); }
function level() { return 1 + Math.min(9, Math.floor(wins() / 2)); }
function isOwned(i) { return owned().includes(HORSES[i].id); }
function renderChips() {
  $('chips').innerHTML = THEME_KEYS.map((k) => `<button data-k="${k}" class="${k === themeSel ? 'on' : ''}">${THEMES[k].name}${THEMES[k].hurdles ? ' 🚧' : ''}</button>`).join('');
  $('chips').querySelectorAll('button').forEach((b) => b.onclick = () => {
    themeSel = b.dataset.k; store.set('theme', themeSel); applyTheme(themeSel); renderChips(); renderMenu(); haptic('select'); Audio.init(); Audio.click();
  });
}
function streakInfo() {
  const last = store.get('dailyLast', 0), st = store.get('streak', 0);
  const alive = last === dayKey() || last === yesterdayKey();
  return { streak: alive ? st : 0, doneToday: last === dayKey() };
}
function renderMenu() {
  const H = HORSES[sel];
  $('hname').textContent = H.name + (isOwned(sel) ? '' : ' 🔒'); $('hdesc').textContent = isOwned(sel) ? H.desc : `${H.desc} · ${H.price} 🪙`;
  $('s1').style.width = H.speed * 10 + '%'; $('s2').style.width = H.stamina * 10 + '%'; $('s3').style.width = H.control * 10 + '%';
  $('lvl').textContent = level(); $('wins').textContent = wins();
  const b = store.get('best_' + themeSel, null); $('best').textContent = b ? b.toFixed(2) + ' s' : '—';
  $('mute').textContent = muted ? '🔇' : '🔊';
  $('coins').textContent = '🪙 ' + coins();
  $('subtitle').textContent = THEMES[themeSel].sub + '. 800 metr, 5 chavandoz.';
  const st = streakInfo(); $('streak').textContent = st.doneToday ? '✓' : st.streak ? '🔥' + st.streak : 'yangi';
  const start = $('start');
  if (isOwned(sel)) { start.textContent = 'Poygani boshlash'; start.disabled = false; }
  else { start.textContent = coins() >= H.price ? `Sotib olish · ${H.price} 🪙` : `Yana ${H.price - coins()} 🪙 kerak`; }
  if (challenge) {
    show($('invite'));
    $('invtitle').textContent = `👻 ${challenge.name} sizni bellashuvga chaqirdi!`;
    $('invsub').textContent = `Natijasi: ${challenge.time.toFixed(2)} s · ${THEMES[challenge.theme].name}${challenge.hurdles ? ", to'siqli" : ''}`;
  } else hide($('invite'));
}
function pick(d) {
  sel = (sel + d + HORSES.length) % HORSES.length; store.set('horse', sel);
  buildPlayer(); renderMenu(); haptic('select'); Audio.init(); Audio.click();
  menuSpin = 0;
}
function buyHorse(i) {
  const H = HORSES[i];
  if (isOwned(i) || coins() < H.price) return false;
  addCoins(-H.price); store.set('owned', [...owned(), H.id]);
  haptic('notify', 'success'); Audio.fanfare(); banner(`🎉 ${H.name} endi sizniki!`);
  return true;
}
$('prev').onclick = () => pick(-1);
$('next').onclick = () => pick(1);
$('mute').onclick = () => { muted = !muted; store.set('muted', muted); Audio.init(); Audio.setMuted(muted); renderMenu(); };
$('start').onclick = () => {
  Audio.init(); haptic('impact', 'medium');
  if (!isOwned(sel)) { if (buyHorse(sel)) renderMenu(); else { haptic('notify', 'error'); banner("Tanga yetmaydi. Poygada yutib to'plang!"); } return; }
  startRace({});
};
$('again').onclick = () => { Audio.init(); haptic('impact', 'medium'); toMenu(); };
$('ctabot').onclick = () => openTg(BOT_URL);
$('ctasite').onclick = (e) => { e.preventDefault(); openLink(SITE_URL); };
$('realhorse').onclick = (e) => { e.preventDefault(); openLink(SITE_URL); };
$('invgo').onclick = () => {
  Audio.init(); const c = challenge; if (!c) return;
  if (!isOwned(sel)) { sel = 0; store.set('horse', 0); buildPlayer(); }
  themeSel = c.theme; applyTheme(c.theme, c.hurdles); renderChips();
  startRace({ ghost: c });
};
$('share').onclick = () => {
  const r = lastResult; if (!r) return;
  if (r.kop) {
    const text = `Otbozor ko'pkarisida ${r.score} ta uloqni qozonga tashladim va ${r.place}-o'rinni oldim! Sen ham kel 🐎`;
    return openTg(`https://t.me/share/url?url=${encodeURIComponent(GAME_URL)}&text=${encodeURIComponent(text)}`);
  }
  if (!r.splits) return;
  const param = encodeChallenge(r);
  const text = `Otbozor ot poygasida 800 metrni ${r.time.toFixed(2)} soniyada bosib o'tdim! Mening otimni quvib yeta olasanmi? 🐎`;
  openTg(`https://t.me/share/url?url=${encodeURIComponent(GAME_URL + '?startapp=' + param)}&text=${encodeURIComponent(text)}`);
};

/* ---------- sheets: shop, daily, leaderboard ---------- */
function openSheet(title, html, bind) {
  ui.sheettitle.textContent = title; ui.sheetbody.innerHTML = html; show(ui.sheet);
  bind && bind(ui.sheetbody);
}
$('sheetx').onclick = () => hide(ui.sheet);
ui.sheet.addEventListener('pointerdown', (e) => { if (e.target === ui.sheet) hide(ui.sheet); });

function shopHtml() {
  const hs = HORSES.map((H, i) => {
    const own = isOwned(i);
    const btn = own ? (i === sel ? `<button class="own" disabled>Tanlangan</button>` : `<button data-pick="${i}" class="own">Tanlash</button>`)
      : `<button data-buy="${i}" ${coins() < H.price ? 'disabled' : ''}>${H.price} 🪙</button>`;
    return `<div class="item ${i === sel ? 'on' : ''}"><span class="sw" style="background:#${new THREE.Color(H.coat).getHexString()}"></span>
      <div><b>${H.name}</b><small>Tezlik ${H.speed} · Chidam ${H.stamina} · Boshqaruv ${H.control}</small></div>${btn}</div>`;
  }).join('');
  const ss = SILKS.map((S, i) => {
    const own = ownedSilk().includes(i);
    const btn = own ? (i === silkSel ? `<button class="own" disabled>Kiyilgan</button>` : `<button data-wear="${i}" class="own">Kiyish</button>`)
      : `<button data-silk="${i}" ${coins() < S.price ? 'disabled' : ''}>${S.price} 🪙</button>`;
    return `<div class="item ${i === silkSel ? 'on' : ''}"><span class="sw" style="background:linear-gradient(135deg,#${new THREE.Color(S.c).getHexString()} 60%,#${new THREE.Color(S.cap).getHexString()} 60%)"></span>
      <div><b>${S.name}</b><small>Chavandoz kiyimi va egar yopqichi</small></div>${btn}</div>`;
  }).join('');
  return `<div class="note">Sizda <b>🪙 ${coins()}</b> tanga bor. Tanga poygada o'rin, aniq zarb, kunlik poyga va ko'pkaridan keladi.</div>
    <div class="sec">OTLAR</div>${hs}<div class="sec">CHAVANDOZ KIYIMI</div>${ss}`;
}
function openShop() {
  const bind = (root) => {
    root.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => { const i = +b.dataset.buy; if (buyHorse(i)) { sel = i; store.set('horse', i); buildPlayer(); } refresh(); });
    root.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => { sel = +b.dataset.pick; store.set('horse', sel); buildPlayer(); refresh(); });
    root.querySelectorAll('[data-silk]').forEach((b) => b.onclick = () => {
      const i = +b.dataset.silk, S = SILKS[i]; if (coins() < S.price) return;
      addCoins(-S.price); store.set('ownedSilk', [...ownedSilk(), i]); silkSel = i; store.set('silk', i); buildPlayer(); haptic('notify', 'success'); Audio.fanfare(); refresh();
    });
    root.querySelectorAll('[data-wear]').forEach((b) => b.onclick = () => { silkSel = +b.dataset.wear; store.set('silk', silkSel); buildPlayer(); haptic('select'); refresh(); });
  };
  const refresh = () => { openSheet("Do'kon", shopHtml(), bind); renderMenu(); };
  refresh();
}
$('bshop').onclick = () => { Audio.init(); openShop(); };

function dailyPlan() {
  const k = dayKey(), r = rng(k * 7919);
  const theme = THEME_KEYS[Math.floor(r() * THEME_KEYS.length)];
  const hurdles = THEMES[theme].hurdles || r() < 0.4;
  return { key: k, theme, hurdles };
}
function openDaily() {
  const d = dailyPlan(), st = streakInfo();
  const next = st.doneToday ? st.streak : st.streak + 1;
  const days = Array.from({ length: 7 }, (_, i) => `<div class="${i < (st.doneToday ? st.streak : st.streak) % 8 ? 'on' : ''}">${i + 1}-kun<b>+${25 * (i + 1)}</b></div>`).join('');
  const best = store.get('dailyBest_' + d.key, null);
  openSheet('Kunlik poyga', `
    <div class="daily"><h4>${THEMES[d.theme].name}${d.hurdles ? ", to'siqli" : ''}</h4>
    <p>Bugungi trassa hamma uchun bir xil. Tangalar <b>2 baravar</b>, raqiblar kuchliroq. Har kuni o'ynasangiz bonus o'sib boradi.</p></div>
    <div class="sec">KETMA-KET KUNLAR: ${st.streak} 🔥</div>
    <div class="days">${days}</div>
    <div class="note">${st.doneToday ? `Bugun o'ynadingiz${best ? `: <b>${best.toFixed(2)} s</b>` : ''}. Yana o'ynab natijani yaxshilashingiz mumkin, bonus ertaga yana beriladi.` : `Bugun o'ynasangiz ${next}-kun bonusi: <b>+${25 * Math.min(next, 7)} 🪙</b>`}</div>
    <button class="btn" id="dailygo" style="margin-top:12px">Kunlik poygani boshlash</button>`, (root) => {
    root.querySelector('#dailygo').onclick = () => {
      hide(ui.sheet); if (!isOwned(sel)) { sel = 0; buildPlayer(); }
      applyTheme(d.theme, d.hurdles); startRace({ daily: d });
    };
  });
}
$('bdaily').onclick = () => { Audio.init(); openDaily(); };

/* ---------- leaderboard (server on Otbozor backend) ---------- */
async function api(path, body) {
  if (!API) throw new Error('noapi');
  const r = await fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}
function submitScore(kind, value, extra = {}) {
  if (!API || !tg || !tg.initData) return;
  api('/score', { initData: tg.initData, kind, value, horse: HORSES[sel].id, ...extra }).catch(() => {});
}
function openTop(period = 'week') {
  const tabs = `<div class="tabs"><button data-p="week" class="${period === 'week' ? 'on' : ''}">Hafta</button><button data-p="month" class="${period === 'month' ? 'on' : ''}">Oy turniri</button><button data-p="kop" class="${period === 'kop' ? 'on' : ''}">Ko'pkari</button></div>`;
  const prize = period === 'month' ? `<div class="daily"><h4>🏆 Oy turniri</h4><p>Oy oxirida eng tez chavandoz g'olib bo'ladi. Sovrin: <b>${esc(TOURNAMENT_PRIZE)}</b>. G'oliblar @otbozor_bot va Instagram'da e'lon qilinadi.</p></div>` : '';
  const bind = (root) => root.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => openTop(b.dataset.p));
  if (!API) {
    openSheet('Reyting', tabs + prize + `<div class="note">Umumiy reyting tez orada ishga tushadi. ${store.get('best_dala', 0) ? `Hozircha shaxsiy rekordingiz: <b>${store.get('best_dala', 0).toFixed(2)} s</b>.` : "Hozircha o'z rekordingizni o'rnating!"}</div>`, bind);
    return;
  }
  openSheet('Reyting', tabs + prize + `<div class="note">Yuklanmoqda…</div>`, bind);
  const kind = period === 'kop' ? 'kopkari' : 'race';
  api(`/top?kind=${kind}&period=${period === 'kop' ? 'week' : period}${tg && tg.initData ? '&me=' + encodeURIComponent(tg.initDataUnsafe?.user?.id || '') : ''}`).then((d) => {
    const fmt = (v) => kind === 'race' ? v.toFixed(2) + ' s' : v + ' ta';
    const rows = (d.top || []).map((x, i) => `<div class="row ${x.me ? 'me' : ''}"><span class="n">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>${esc(x.name)}<span class="t">${fmt(x.value)}</span></div>`).join('') || `<div class="note">Hali natija yo'q. Birinchi bo'ling!</div>`;
    const me = d.me && d.me.rank > 20 ? `<div class="row me"><span class="n">${d.me.rank}</span>Siz<span class="t">${fmt(d.me.value)}</span></div>` : '';
    openSheet('Reyting', tabs + prize + rows + me, bind);
  }).catch(() => openSheet('Reyting', tabs + prize + `<div class="note">Reytingni yuklab bo'lmadi. Internetni tekshirib qayta urinib ko'ring.</div>`, bind));
}
$('btop').onclick = () => { Audio.init(); openTop('week'); };
$('bkop').onclick = () => { Audio.init(); if (!isOwned(sel)) { sel = 0; buildPlayer(); } Kop.start(); };

let popT = 0;
function pop(text, color) {
  ui.pop.textContent = text; ui.pop.style.color = color;
  ui.pop.style.textShadow = '0 0 2px #fff, 0 3px 0 #fff, 0 -2px 0 #fff, 3px 0 0 #fff, -3px 0 0 #fff, 0 10px 24px rgba(0,0,0,.25)';
  ui.pop.classList.remove('show'); void ui.pop.offsetWidth; ui.pop.classList.add('show');
}
let bannerT = 0;
function banner(t, dur = 1.8) { ui.banner.textContent = t; ui.banner.classList.add('on'); bannerT = dur; }

/* ================= GAME LOGIC ================= */
let mode = 'menu'; // menu | count | race | finish | kop
let raceT = 0, countT = 0, goTime = 0;
let stamina = 100, boost = 0, combo = 0, bestCombo = 0, taps = 0, perfects = 0, lastTap = -1, needleT = 0, stumble = 0;
let camKick = 0, slow = 1, slowT = 0, lastPlace = 5, commentT = 0;
let finishOrder = [], lastResult = null, finishCam = 0, menuSpin = 0, tiredWarned = false, shownFinal = false, falseStart = false;
let raceOpts = {}, splits = [], cleanJumps = 0, jumpMode = false;

function stats() { const H = HORSES[sel]; return H; }
function zones() {
  const H = stats();
  const perf = 0.10 + H.control * 0.008;
  return { perf, good: perf + 0.16 };
}
function layoutZones() {
  const z = zones();
  ui.zperf.style.left = (50 - z.perf * 50) + '%'; ui.zperf.style.width = z.perf * 100 + '%';
  ui.zgood.style.left = (50 - z.good * 50) + '%'; ui.zgood.style.width = z.good * 100 + '%';
}
const JUMP_FAR = 22, JUMP_GOOD = [4, 10], JUMP_OK = 15;
function setJumpMode(on) {
  if (on === jumpMode) return;
  jumpMode = on;
  ui.meter.classList.toggle('jump', on);
  if (on) {
    ui.zperf.style.left = (1 - JUMP_GOOD[1] / JUMP_FAR) * 100 + '%'; ui.zperf.style.width = (JUMP_GOOD[1] - JUMP_GOOD[0]) / JUMP_FAR * 100 + '%';
    ui.zgood.style.left = (1 - JUMP_OK / JUMP_FAR) * 100 + '%'; ui.zgood.style.width = (JUMP_OK - JUMP_GOOD[1]) / JUMP_FAR * 100 + '%';
    ui.tapline.textContent = "🚧 To'siq! Yashil zonada sakrang";
  } else { layoutZones(); ui.tapline.textContent = 'Yashil zonada bosing'; }
}

function resetRace() {
  if (ghost) { scene.remove(ghost.mesh); ghost = null; }
  if (raceOpts.ghost) ghost = makeGhost(raceOpts.ghost);
  foes = ghost ? rivals.filter((_, i) => i !== 1) : rivals.slice();
  rivals.forEach((r, i) => { r.mesh.visible = mode !== 'menu' && !(ghost && i === 1); });
  field = [player, ...foes, ...(ghost ? [ghost] : [])];
  for (const h of field) { h.z = 0; h.v = 0; h.done = false; h.time = 0; h.hIdx = 0; h.mesh.position.z = 0; h.mesh.userData.jumpT = 0; }
  const lv = level() + (raceOpts.daily ? 1 : 0);
  const r = raceOpts.daily ? rng(raceOpts.daily.key) : Math.random;
  foes.forEach((f, i) => {
    f.base = 16.4 + i * 0.45 + lv * 0.32 + r() * 0.5;
    f.kick = 1.5 + r() * 2.2;
    f.seed = r() * 10;
  });
  stamina = 100; boost = 0; combo = 0; bestCombo = 0; taps = 0; perfects = 0; lastTap = -1; needleT = 0; stumble = 0;
  raceT = 0; finishOrder = []; lastPlace = 5; commentT = 0; slow = 1; slowT = 0; confetti.visible = false; tiredWarned = false; shownFinal = false; falseStart = false;
  splits = []; cleanJumps = 0; jumpMode = true; setJumpMode(false);
  $('place').parentElement.querySelector('small').textContent = "O'RIN";
  layoutZones(); setupDots();
}

function setRivals(v) { for (const r of rivals) r.mesh.visible = v; if (ghost) ghost.mesh.visible = v; }
function toMenu() {
  mode = 'menu'; Audio.cheer(false); setRivals(false); Kop.stop();
  hide(ui.result); hide(ui.hud); show(ui.menu); show(canvas);
  raceOpts = {}; applyTheme(themeSel); player.mesh.position.set(LANES[PLAYER_LANE], 0, 0); player.mesh.rotation.y = 0; scene.add(player.mesh);
  resetRace(); renderMenu();
}

function startRace(opts) {
  raceOpts = opts || {};
  if (!raceOpts.daily && !raceOpts.ghost) applyTheme(themeSel);
  mode = 'count';
  resetRace();
  hide(ui.menu); hide(ui.result); hide(ui.sheet); show(ui.hud); setRivals(true);
  if (ghost) rivals[1].mesh.visible = false;
  countT = 3.0; goTime = -1;
  ui.count.classList.remove('hidden', 'go');
  ui.count.textContent = '3'; Audio.beep(false); haptic('impact', 'light');
  if (store.get('races', 0) < 3) $('tip').classList.remove('hidden');
  store.set('races', store.get('races', 0) + 1);
  if (raceOpts.ghost) banner(`👻 ${raceOpts.ghost.name}: ${raceOpts.ghost.time.toFixed(2)} s. Quvib yeting!`, 2.6);
  else if (raceOpts.daily) banner('📅 Kunlik poyga · tangalar x2', 2.2);
}

function needlePos() {
  return 1 - Math.abs(((needleT % 2) + 2) % 2 - 1);
}
function nextHurdle(h) { return hurdlesOn && h.hIdx < HURDLES_AT.length ? HURDLES_AT[h.hIdx] - (h.z + 1.2) : Infinity; }

function onTap() {
  if (mode === 'kop') return Kop.tap();
  if (mode === 'count') {
    if (countT > 0.15) { falseStart = true; banner("Shoshilmang! Signalni kuting"); Audio.miss(); haptic('notify', 'error'); }
    return;
  }
  if (mode !== 'race') return;
  if (raceT - lastTap < 0.18) return;
  lastTap = raceT;
  const d = nextHurdle(player);
  if (jumpMode && player.mesh.userData.jumpT <= 0 && !player.jumped) {
    if (d > JUMP_OK) { pop('Hali erta!', '#f59e0b'); return; }
    player.jumped = true; startJump(player); Audio.whoosh();
    if (d >= JUMP_GOOD[0] && d <= JUMP_GOOD[1]) { boost = Math.min(10, boost + 3); cleanJumps++; pop("A'lo sakrash!", '#16a34a'); haptic('impact', 'heavy'); camKick = 0.3; }
    else if (d > JUMP_GOOD[1]) { boost -= 1.5; pop('Erta sakradi', '#f59e0b'); haptic('impact', 'light'); }
    else { player.v *= 0.72; pop('Kech! Oyog\'i tegdi', '#ef4444'); haptic('notify', 'warning'); }
    return;
  }
  taps++;
  const H = stats();
  const dd = Math.abs(needlePos() - 0.5) * 2;
  const z = zones();
  const tired = stamina < 18;
  const eff = tired ? 0.45 : 1;
  const sCost = 1.25 - H.stamina * 0.07;
  if (raceT < 0.35 && taps === 1 && !falseStart) {
    boost += 5; banner("Zo'r start! 🚀", 1.4); Audio.whoosh();
  }
  if (dd <= z.perf) {
    combo++; perfects++; bestCombo = Math.max(bestCombo, combo);
    boost = Math.min(10, boost + (3.6 + Math.min(combo, 6) * 0.35) * eff);
    stamina -= 4.2 * sCost;
    player.mesh.userData.whipT = 0.3; camKick = 0.25;
    pop(combo >= 3 ? `Zo'r! x${combo}` : "Zo'r!", '#16a34a'); Audio.perfect(combo); haptic('impact', combo >= 3 ? 'heavy' : 'medium');
    if (combo === 5 || combo === 10 || combo === 15) { banner(`🔥 ${combo} ta ketma-ket aniq zarb!`); }
    for (let i = 0; i < 4; i++) puff(player.mesh.position.x, player.mesh.position.z + 1, player.v, true);
  } else if (dd <= z.good) {
    combo = 0;
    boost = Math.min(10, boost + 1.8 * eff);
    stamina -= 5.5 * sCost;
    pop('Yaxshi', '#f59e0b'); Audio.good(); haptic('impact', 'light');
  } else {
    combo = 0;
    boost = Math.max(-4, boost - 3); stumble = 0.35;
    stamina -= 8 * sCost;
    const pos = needlePos(), dir = needleDir();
    const early = (pos < 0.5 && dir > 0) || (pos > 0.5 && dir < 0);
    pop(early ? 'Erta!' : 'Kech!', '#ef4444'); Audio.miss(); haptic('notify', 'error');
  }
  stamina = Math.max(0, stamina);
  ui.combo.textContent = combo >= 2 ? `KOMBO x${combo}` : '';
}
let prevNeedle = 0.5;
function needleDir() { return needlePos() - prevNeedle; }

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button,a,.sheetwrap')) return;
  Audio.init();
  if (mode === 'kop') return Kop.pointer('down', e);
  onTap();
}, { passive: true });
window.addEventListener('pointermove', (e) => { if (mode === 'kop') Kop.pointer('move', e); }, { passive: true });
window.addEventListener('pointerup', (e) => { if (mode === 'kop') Kop.pointer('up', e); }, { passive: true });
window.addEventListener('pointercancel', (e) => { if (mode === 'kop') Kop.pointer('up', e); }, { passive: true });
window.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); Audio.init(); if (mode === 'menu') startRace({}); else onTap(); } });

function hurdleStep(h, dt, isPlayer) {
  if (!hurdlesOn || h.hIdx >= HURDLES_AT.length) return;
  const d = nextHurdle(h);
  if (isPlayer) {
    if (d < 45 && d > JUMP_FAR && h.warnIdx !== h.hIdx) { h.warnIdx = h.hIdx; banner("⚠️ Oldinda to'siq!", 1.2); }
    setJumpMode(d <= JUMP_FAR && d > -2 && !h.jumped);
    if (d <= 0.6 && !h.jumped) {
      h.jumped = true; h.v *= 0.35; stumble = 1.0; boost = Math.min(boost, 0); combo = 0;
      pop("💥 To'siqqa urildi!", '#ef4444'); haptic('notify', 'error'); Audio.miss(); camKick = 0.5;
      for (let i = 0; i < 10; i++) puff(h.mesh.position.x, h.mesh.position.z - 1, 5, true);
    }
  } else if (d < 5.5 && !h.jumped) {
    h.jumped = true;
    if (Math.random() < Math.max(0.03, 0.12 - level() * 0.01)) { h.v *= 0.5; } else startJump(h);
  }
  if (d < -3) { h.hIdx++; h.jumped = false; if (isPlayer) setJumpMode(false); }
}

function updateRace(dt) {
  raceT += dt;
  const H = stats();
  const prog = Math.min(1, player.z / RACE);
  prevNeedle = needlePos();
  needleT += dt * (1.45 + prog * 0.7);
  stamina = Math.min(100, stamina + dt * (2.2 + H.stamina * 0.12));
  boost += (0 - boost) * Math.min(1, dt * 0.55);
  boost -= Math.sign(boost) * Math.min(Math.abs(boost), dt * 0.9);
  stumble = Math.max(0, stumble - dt);
  const tired = stamina < 18;
  if (tired && !tiredWarned) { tiredWarned = true; banner('😮‍💨 Ot charchadi! Kuchini tiklang', 2.2); haptic('notify', 'warning'); }
  if (stamina > 35) tiredWarned = false;

  const cruise = 14.2 + H.speed * 0.38 - (tired ? 2.5 : 0);
  const maxV = 21.5 + H.speed * 0.42;
  const target = Math.min(maxV, cruise + boost * 1.0) - (stumble > 0 ? 3 : 0);
  player.v += (target - player.v) * Math.min(1, dt * (player.v < 5 ? 1.6 : 2.2));
  const z0 = player.z;
  if (!player.done) player.z += player.v * dt;
  // 100 m splits for friend challenges
  const k0 = Math.floor(z0 / 100), k1 = Math.floor(player.z / 100);
  if (k1 > k0 && k1 <= 8) splits.push(raceT - (player.z - k1 * 100) / Math.max(1, player.v));
  hurdleStep(player, dt, true);

  foes.forEach((r) => {
    if (r.done) { r.v *= 0.985; r.z += r.v * dt; return; }
    const rp = r.z / RACE;
    let tgt = r.base + Math.sin(raceT * 0.6 + r.seed) * 0.9 + Math.sin(raceT * 1.7 + r.seed * 2) * 0.4;
    if (rp > 0.72) tgt += r.kick;
    const gap = player.z - r.z;
    if (gap > 28) tgt += Math.min(2.5, (gap - 28) * 0.06);
    if (gap < -40) tgt -= 1.2;
    r.v += (tgt - r.v) * Math.min(1, dt * 1.2);
    r.z += r.v * dt;
    hurdleStep(r, dt, false);
  });
  if (ghost) {
    const nz = ghostZ(ghost, raceT); ghost.v = Math.max(0, (nz - ghost.z) / Math.max(dt, 1e-4)); ghost.z = nz;
    if (hurdlesOn && ghost.hIdx < HURDLES_AT.length) { const d = HURDLES_AT[ghost.hIdx] - (ghost.z + 1.2); if (d < 5.5 && !ghost.jumped) { ghost.jumped = true; startJump(ghost); } if (d < -3) { ghost.hIdx++; ghost.jumped = false; } }
  }

  for (const h of field) {
    if (!h.done && h.z >= RACE) {
      h.done = true;
      h.time = h.ghost ? h.splits[7] : raceT - (h.z - RACE) / Math.max(1, h.v);
      finishOrder.push(h);
      if (h === player) finishRace();
    }
  }
  if (!shownFinal && player.z > RACE - 200) { shownFinal = true; banner('🏁 Oxirgi 200 metr! Hammasini bering!'); Audio.cheer(true); }

  const place = 1 + field.filter((h) => h !== player && (h.done && !player.done ? true : h.z > player.z)).length;
  ui.place.innerHTML = `${place}<sup>/${field.length}</sup>`;
  commentT -= dt;
  if (place !== lastPlace && raceT > 3 && commentT <= 0) {
    if (place === 1) banner('🏆 Siz peshqadamsiz!');
    else if (place < lastPlace) banner(`⬆️ ${place}-o'ringa chiqdingiz!`);
    else { const by = field.filter((h) => h !== player && h.z > player.z).sort((a, b) => a.z - b.z)[0]; banner(`${by ? (by.ghost ? '👻 ' : '') + by.name : 'Raqib'} quvib o'tdi!`); }
    commentT = 2.2; lastPlace = place;
    if (place === 1) haptic('notify', 'success');
  }
  ui.left.textContent = Math.max(0, Math.ceil(RACE - player.z)) + ' m';
  ui.time.textContent = raceT.toFixed(2);
  ui.stamb.style.width = stamina + '%'; ui.stamv.textContent = Math.round(stamina) + '%';
  ui.stam.classList.toggle('low', tired);
  ui.spd.textContent = Math.round(player.v * 3.6);
  if (jumpMode) { const d = nextHurdle(player); ui.needle.style.left = Math.max(0, Math.min(1, 1 - d / JUMP_FAR)) * 100 + '%'; }
  else ui.needle.style.left = needlePos() * 100 + '%';
  ui.vign.classList.toggle('on', boost > 6);
  for (const [h, d] of dots) d.style.left = Math.min(100, (h.z / RACE) * 100) + '%';
}

function finishRace() {
  mode = 'finish'; finishCam = 0; setJumpMode(false);
  const t = player.time;
  while (splits.length < 8) splits.push(t);
  splits[7] = t;
  const place = finishOrder.indexOf(player) + 1;
  const theme = curTheme;
  const prevBest = store.get('best_' + theme, null);
  const isBest = !prevBest || t < prevBest;
  if (isBest) store.set('best_' + theme, t);
  if (place === 1) store.set('wins', wins() + 1);
  const acc = taps ? Math.round((perfects / taps) * 100) : 0;
  lastResult = { place, time: t, acc, splits: splits.slice(0, 8), theme, hurdles: hurdlesOn, isBest };
  haptic('notify', place === 1 ? 'success' : 'warning');
  if (place === 1) Audio.fanfare();
  slow = 0.22; slowT = 1.4;
  if (place <= 3) setTimeout(() => burstConfetti(player.mesh.position.x, player.mesh.position.z - 1), 500);
  ui.vign.classList.remove('on');
  submitScore('race', t, { theme, hurdles: hurdlesOn, daily: raceOpts.daily ? raceOpts.daily.key : 0 });
  setTimeout(() => showResult(isBest), 2600);
}

function showResult(isBest) {
  const r = lastResult;
  for (const h of field) if (!h.done) { h.done = true; h.time = h.ghost ? h.splits[7] : player.time + (RACE - h.z) / Math.max(10, h.v); finishOrder.push(h); }
  finishOrder.sort((a, b) => a.time - b.time);
  r.place = finishOrder.indexOf(player) + 1;
  // coins
  let earn = [100, 60, 40, 25, 15][r.place - 1] + perfects * 2 + cleanJumps * 10;
  const notes = [];
  if (raceOpts.daily) {
    earn *= 2;
    const st = streakInfo();
    if (!st.doneToday) {
      const ns = (store.get('dailyLast', 0) === yesterdayKey() ? store.get('streak', 0) : 0) + 1;
      store.set('streak', ns); store.set('dailyLast', dayKey());
      const bonus = 25 * Math.min(ns, 7); earn += bonus; notes.push(`🔥 ${ns}-kun bonusi +${bonus}`);
    }
    const kb = 'dailyBest_' + raceOpts.daily.key, db = store.get(kb, null);
    if (!db || r.time < db) store.set(kb, r.time);
  }
  let ghostLine = '';
  if (ghost) {
    const diff = r.time - ghost.splits[7];
    if (diff < 0) { earn += 50; ghostLine = `👻 ${ghost.name}ni ${(-diff).toFixed(2)} s farq bilan yutdingiz!`; }
    else ghostLine = `👻 ${ghost.name} ${diff.toFixed(2)} s tezroq edi. Qayta urinib ko'ring!`;
    challenge = null;
  }
  addCoins(earn);
  hide(ui.hud); show(ui.result);
  const sub = ['G\'alaba! 🏆', 'Juda yaqin edi!', 'Shohsupada!', 'Yomon emas', 'Keyingisida albatta'][Math.min(4, r.place - 1)];
  $('rplace').innerHTML = `${r.place}<sup>-o'rin</sup>`;
  $('rsub').textContent = ghostLine || (isBest ? sub + ' · Yangi rekord!' : sub);
  const stars = r.place === 1 ? (r.acc >= 60 ? 3 : 2) : r.place <= 3 ? 1 : 0;
  $('stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('stars').style.color = '#facc15';
  $('rtime').previousSibling.textContent = 'VAQT'; $('racc').previousSibling.textContent = 'ANIQ ZARB';
  $('rtime').textContent = r.time.toFixed(2);
  $('rbest').textContent = (store.get('best_' + r.theme, r.time)).toFixed(2);
  $('racc').textContent = r.acc + '%';
  $('earn').textContent = `+${earn} 🪙` + (notes.length ? ' · ' + notes.join(' · ') : '');
  $('order').innerHTML = finishOrder.map((h, i) =>
    `<div class="${h === player ? 'me' : ''}"><b>${i + 1}.</b><i style="background:${h.color}"></i>${h.ghost ? '👻 ' : ''}${esc(h.name)}${h === player ? ' (siz)' : ''}<span>${h.time.toFixed(2)} s</span></div>`).join('');
  setTimeout(() => Audio.cheer(false), 2500);
}

/* ================= CAMERA ================= */
const DEBUG_CAM = (/[?&]cam=([-\d.]+),([-\d.]+),([-\d.]+)/.exec(location.search) || null)?.slice(1).map(Number);
const camPos = new THREE.Vector3(6, 3, 8), camLook = new THREE.Vector3();
function updateCamera(dt, t) {
  if (mode === 'kop') return Kop.camera(dt, camPos, camLook);
  const p = player.mesh.position;
  world.spot.position.set(p.x + 2, 18, p.z + 6); world.spot.target.position.set(p.x, 0, p.z - 6);
  let want, look, fov = 55;
  if (DEBUG_CAM) {
    want = new THREE.Vector3(p.x + DEBUG_CAM[0], DEBUG_CAM[1], p.z + DEBUG_CAM[2]); look = new THREE.Vector3(p.x, 1.1, p.z);
  } else if (mode === 'menu') {
    menuSpin += dt * 0.35;
    const a = 0.9 + Math.sin(menuSpin) * 0.5;
    want = new THREE.Vector3(p.x + Math.sin(a) * 7.2, 2.3, p.z - Math.cos(a) * 7.2 - 0.4);
    look = new THREE.Vector3(p.x, 0.15, p.z - 0.3);
  } else if (mode === 'count') {
    want = new THREE.Vector3(p.x + 2.4, 2.0, p.z - 9.5);
    look = new THREE.Vector3(p.x - 0.3, 0.9, p.z);
  } else if (mode === 'race' && player.z > RACE - 110) {
    // dramatic front-side shot for the final stretch
    want = new THREE.Vector3(p.x + 5.2, 1.7, p.z - 3.2);
    look = new THREE.Vector3(p.x - 0.3, 1.2, p.z - 1.2);
    fov = 52;
  } else if (mode === 'race') {
    const v = player.v;
    const shake = v > 20 ? (v - 20) * 0.012 : 0;
    want = new THREE.Vector3(p.x + 1.0, 3.1 + Math.sin(t * 18) * shake, p.z + 6.6 - Math.min(0.8, Math.max(0, boost) * 0.08));
    look = new THREE.Vector3(p.x + 0.15, 1.1, p.z - 6);
    fov = Math.min(68, 54 + Math.max(0, boost) * 0.9 + Math.max(0, v - 19) * 0.5);
  } else if (mode === 'finish' && slowT > 0) {
    want = new THREE.Vector3(8.5, 1.4, -RACE - 1.5);
    look = new THREE.Vector3(p.x, 1.2, p.z);
    fov = 42;
  } else {
    finishCam += dt * 0.4;
    want = new THREE.Vector3(p.x + Math.sin(finishCam + 0.8) * 7, 2.6, p.z + Math.cos(finishCam + 0.8) * 7);
    look = new THREE.Vector3(p.x, 1.4, p.z);
  }
  const finalShot = mode === 'race' && player.z > RACE - 110;
  const k = finalShot ? 1 - Math.pow(0.08, dt) : mode === 'race' ? 1 - Math.pow(0.0005, dt) : mode === 'finish' && slowT > 0 ? 1 - Math.pow(0.000001, dt) : 1 - Math.pow(0.02, dt);
  camKick = Math.max(0, camKick - dt);
  if (camKick > 0) { want.y += Math.sin(camKick * 60) * camKick * 0.25; fov += camKick * 12; }
  camPos.lerp(want, k); if (finalShot) camLook.copy(look); else camLook.lerp(look, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  sun.position.set(p.x + 12, 24, p.z + 8); sun.target.position.set(p.x, 0, p.z - 4);
}

/* ================= LOOP ================= */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();
if (tg && tg.onEvent) tg.onEvent('viewportChanged', resize);

let last = performance.now(), T = 0;
const SIM = /[?&]sim=(\d+)/.exec(location.search);
const SUB = SIM ? +SIM[1] : 1;
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  if (slowT > 0) { slowT -= rdt; if (slowT <= 0) slow = 1; }
  for (let i = 0; i < SUB; i++) step(rdt * slow);
  updateDust(rdt * slow);
  updateConfetti(rdt);
  updateSnow(rdt);
  for (let i = 0; i < flags.length; i++) flags[i].rotation.y = (flags[i].rotation.y > 1.5 ? Math.PI : 0) + Math.sin(T * 6 + i) * 0.35;
  updateCamera(rdt * SUB, T);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function step(dt) {
  T += dt;
  if (mode === 'count') {
    const before = Math.ceil(countT);
    countT -= dt;
    const after = Math.ceil(countT);
    if (countT <= 0 && goTime < 0) {
      goTime = T; mode = 'race'; ui.count.textContent = 'KET!'; ui.count.classList.add('go'); Audio.beep(true); haptic('impact', 'heavy');
      setTimeout(() => ui.count.classList.add('hidden'), 650);
      setTimeout(() => $('tip').classList.add('hidden'), 3500);
      if (falseStart) { boost = -3; }
    } else if (after !== before && after > 0) { ui.count.textContent = String(after); Audio.beep(false); haptic('impact', 'light'); }
  }
  if (mode === 'race') updateRace(dt);
  else if (mode === 'finish') {
    raceT += dt;
    for (const h of field) { if (h.ghost) { h.z = ghostZ(h, raceT); continue; } h.v *= (h === player ? 0.975 : 0.99); h.z += h.v * dt; }
    for (const h of field) if (!h.done && h.z >= RACE) { h.done = true; h.time = h.ghost ? h.splits[7] : raceT - (h.z - RACE) / Math.max(1, h.v); finishOrder.push(h); }
  } else if (mode === 'kop') { Kop.update(dt); }
  if (mode !== 'kop') for (const h of field) {
    h.mesh.position.z = -h.z;
    if (!h.me) h.mesh.position.x = h.lane + Math.sin(T * 0.4 + h.seed) * 0.35;
    const steps = animateHorse(h.mesh, dt, h.v, T);
    if (steps > 0 && h.v > 3) {
      puff(h.mesh.position.x, h.mesh.position.z + 0.7, h.v, false);
      if (h === player) for (let i = 0; i < steps; i++) Audio.hoof(Math.min(1, h.v / 18));
    }
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) ui.banner.classList.remove('on'); }
  // crowd bounce
  if (window.__crowd && (mode === 'race' || mode === 'finish') && player.z > RACE - 260) {
    window.__crowd.position.y = Math.abs(Math.sin(T * 9)) * 0.12;
  }
}

const Kop = createKopkari({ THREE, scene, camera, makeHorse, animateHorse, HORSES, RIVALS, SILKS, puff, pop, banner, haptic, Audio, store, addCoins, canvasTex, textTex,
  getSel: () => ({ sel, silkSel }), ui: { $, show, hide, esc }, submitScore, onExit: () => toMenu(), setResult: (r) => { lastResult = r; }, setMode: (m) => { mode = m; }, world, sun, applyTheme });
applyTheme(themeSel); renderChips();
renderMenu(); layoutZones(); setupDots(); setRivals(false);
requestAnimationFrame((t) => { last = t; frame(t); });
setTimeout(() => { const l = $('loading'); l.style.opacity = 0; setTimeout(() => l.remove(), 450); }, 350);
