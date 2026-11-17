import * as THREE from './three.module.min.js';

/* ================= CONFIG ================= */
const RACE = 800;            // metres
const LANES = [-4.4, -2.2, 0, 2.2, 4.4];
const PLAYER_LANE = 2;
const BOT_URL = 'https://t.me/otbozor_bot';
const SITE_URL = 'https://otbozor.uz';
const GAME_URL = 'https://t.me/otbozor_game';

const HORSES = [
  { name: 'Qorabayir', desc: 'Shamoldek tez', coat: 0x1d1a1a, mane: 0x050505, sock: 0x1d1a1a, speed: 9, stamina: 6, control: 6 },
  { name: "Oqbo'z",    desc: 'Charchashni bilmaydi', coat: 0xe9e6e1, mane: 0x9a958e, sock: 0xd8d3cc, speed: 7, stamina: 9, control: 7 },
  { name: 'Jiyron',    desc: 'Itoatkor va aniq', coat: 0xa0522d, mane: 0x5a2a12, sock: 0xf3efe9, speed: 8, stamina: 7, control: 9 },
];
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
let sel = store.get('horse', 0);
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

const hemi = new THREE.HemisphereLight(0xe8f6ff, 0x8a6b4a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dd, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

/* ---------- ground & track ---------- */
const TRACK_START = 40, TRACK_END = -RACE - 220, TRACK_LEN = TRACK_START - TRACK_END;
const dirtTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#c99a6b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random(); g.fillStyle = v > .5 ? 'rgba(255,240,220,.18)' : 'rgba(90,55,25,.16)';
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 3);
  }
  for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(110,70,35,.10)'; g.fillRect(x + Math.random() * 4, 0, 2, h); }
}, [4, TRACK_LEN / 8]);
const track = new THREE.Mesh(new THREE.PlaneGeometry(14, TRACK_LEN), new THREE.MeshLambertMaterial({ map: dirtTex }));
track.rotation.x = -Math.PI / 2; track.position.set(0, 0.04, (TRACK_START + TRACK_END) / 2); track.receiveShadow = true;
scene.add(track);

const grassTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#7cbf4a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = Math.random() > .5 ? 'rgba(40,110,30,.22)' : 'rgba(200,240,140,.18)';
    g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3);
  }
}, [40, 160]);
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
  const mm = new THREE.MeshLambertMaterial({ color: 0x9fb7c9, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const h = 40 + Math.random() * 60;
    const mt = new THREE.Mesh(new THREE.ConeGeometry(50 + Math.random() * 40, h, 5), mm);
    mt.position.set(-260 + i * 36 + Math.random() * 20, h / 2 - 2, -RACE - 260 - Math.random() * 60);
    mt.rotation.y = Math.random() * 3; scene.add(mt);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(mt.geometry.parameters.radius * 0.28, h * 0.28, 5), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    snow.position.set(mt.position.x, h - 2 - h * 0.14, mt.position.z); snow.rotation.y = mt.rotation.y; scene.add(snow);
  }
}

/* ---------- horse model ---------- */
const geoCache = {
  torso: new THREE.CapsuleGeometry(0.42, 1.25, 6, 14),
  chest: new THREE.SphereGeometry(0.47, 14, 12),
  rump: new THREE.SphereGeometry(0.5, 14, 12),
  neck: new THREE.CylinderGeometry(0.19, 0.3, 0.95, 10),
  head: new THREE.BoxGeometry(0.26, 0.3, 0.62),
  muzzle: new THREE.BoxGeometry(0.22, 0.22, 0.24),
  ear: new THREE.ConeGeometry(0.06, 0.18, 6),
  mane: new THREE.BoxGeometry(0.07, 0.95, 0.16),
  tail: new THREE.CylinderGeometry(0.04, 0.1, 0.8, 8),
  upper: new THREE.CylinderGeometry(0.1, 0.075, 0.52, 8),
  lower: new THREE.CylinderGeometry(0.065, 0.055, 0.46, 8),
  hoof: new THREE.CylinderGeometry(0.075, 0.09, 0.09, 8),
  thigh: new THREE.SphereGeometry(0.2, 10, 8),
  jTorso: new THREE.BoxGeometry(0.36, 0.5, 0.26),
  jHead: new THREE.SphereGeometry(0.15, 12, 10),
  jArm: new THREE.BoxGeometry(0.1, 0.4, 0.1),
  jLeg: new THREE.BoxGeometry(0.12, 0.42, 0.14),
  cloth: new THREE.BoxGeometry(0.9, 0.04, 0.7),
  eye: new THREE.SphereGeometry(0.03, 6, 6),
};
function numTex(n, silk) {
  return canvasTex(128, 96, (g, w, h) => {
    g.fillStyle = '#' + new THREE.Color(silk).getHexString(); g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(28, 12, 72, 72);
    g.fillStyle = '#0f172a'; g.font = '900 60px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 50);
  });
}

function makeHorse(o) {
  const coat = new THREE.MeshStandardMaterial({ color: o.coat, roughness: 0.55, metalness: 0.05 });
  const mane = new THREE.MeshStandardMaterial({ color: o.mane, roughness: 0.9 });
  const sock = new THREE.MeshStandardMaterial({ color: o.sock ?? o.coat, roughness: 0.6 });
  const hoofM = new THREE.MeshStandardMaterial({ color: 0x1f1a17, roughness: 0.7 });
  const silk = new THREE.MeshStandardMaterial({ color: o.silk, roughness: 0.45 });
  const cap = new THREE.MeshStandardMaterial({ color: o.cap, roughness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd6a57c, roughness: 0.7 });
  const boots = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
  const mats = { coat, mane, sock };

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const add = (geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m;
  };
  add(geoCache.torso, coat, body, 0, 1.3, 0, Math.PI / 2);
  add(geoCache.chest, coat, body, 0, 1.33, -0.62).scale.set(0.95, 1, 1);
  add(geoCache.rump, coat, body, 0, 1.36, 0.62).scale.set(1, 1, 1.05);

  const neck = new THREE.Group(); neck.position.set(0, 1.48, -0.78); neck.rotation.x = -0.62; body.add(neck);
  add(geoCache.neck, coat, neck, 0, 0.42, 0);
  add(geoCache.mane, mane, neck, 0, 0.45, 0.2);
  const head = new THREE.Group(); head.position.set(0, 0.88, -0.02); head.rotation.x = 0.15; neck.add(head);
  add(geoCache.head, coat, head, 0, 0, -0.22);
  add(geoCache.muzzle, coat, head, 0, -0.04, -0.52);
  add(geoCache.ear, coat, head, 0.08, 0.2, 0.02, -0.25);
  add(geoCache.ear, coat, head, -0.08, 0.2, 0.02, -0.25);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
  add(geoCache.eye, eyeM, head, 0.135, 0.06, -0.12); add(geoCache.eye, eyeM, head, -0.135, 0.06, -0.12);
  if (o.blaze) add(new THREE.BoxGeometry(0.06, 0.02, 0.5), white, head, 0, 0.155, -0.3);

  const tail = new THREE.Group(); tail.position.set(0, 1.52, 1.08); tail.rotation.x = -0.55; body.add(tail);
  add(geoCache.tail, mane, tail, 0, -0.4, 0);

  // saddle cloth + number
  const cloth = new THREE.MeshStandardMaterial({ map: numTex(o.num, o.silk), roughness: 0.6 });
  add(geoCache.cloth, [silk, silk, white, white, silk, silk], body, 0, 1.73, -0.05);
  const side = new THREE.PlaneGeometry(0.62, 0.42);
  add(side, cloth, body, 0.445, 1.55, -0.05, 0, Math.PI / 2);
  add(side, cloth, body, -0.445, 1.55, -0.05, 0, -Math.PI / 2);

  // legs
  const legs = [];
  const mk = (x, z, front, off) => {
    const hip = new THREE.Group(); hip.position.set(x, 1.12, z); body.add(hip);
    add(geoCache.thigh, coat, hip, 0, 0.05, 0).scale.set(1, 1.4, 1.2);
    add(geoCache.upper, coat, hip, 0, -0.26, 0);
    const knee = new THREE.Group(); knee.position.y = -0.52; hip.add(knee);
    add(geoCache.lower, sock, knee, 0, -0.23, 0);
    add(geoCache.hoof, hoofM, knee, 0, -0.48, 0);
    legs.push({ hip, knee, front, off });
  };
  mk(0.2, -0.62, true, 0.55); mk(-0.2, -0.62, true, 0.68);
  mk(0.2, 0.62, false, 0.0); mk(-0.2, 0.62, false, 0.12);

  // jockey
  const jockey = new THREE.Group(); jockey.position.set(0, 1.78, -0.1); body.add(jockey);
  const jt = add(geoCache.jTorso, silk, jockey, 0, 0.26, 0, -1.0);
  jt.position.z = -0.12;
  add(geoCache.jHead, skin, jockey, 0, 0.5, -0.42);
  const helmet = add(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap, jockey, 0, 0.52, -0.42, -0.4);
  helmet.scale.set(1, 1.05, 1.1);
  const armL = add(geoCache.jArm, silk, jockey, 0.2, 0.28, -0.42, -1.25);
  const armR = add(geoCache.jArm, silk, jockey, -0.2, 0.28, -0.42, -1.25);
  add(geoCache.jLeg, white, jockey, 0.26, 0.02, 0.02, 0.9);
  add(geoCache.jLeg, white, jockey, -0.26, 0.02, 0.02, 0.9);
  add(new THREE.BoxGeometry(0.13, 0.25, 0.13), boots, jockey, 0.3, -0.18, -0.12, -0.4);
  add(new THREE.BoxGeometry(0.13, 0.25, 0.13), boots, jockey, -0.3, -0.18, -0.12, -0.4);

  root.userData = { body, neck, head, tail, legs, jockey, armL, armR, mats, phase: Math.random() * 6 };
  return root;
}

function animateHorse(h, dt, speed, t) {
  const u = h.userData;
  const freq = speed / 6.8; // strides per second
  const prev = u.phase;
  u.phase += dt * freq * Math.PI * 2;
  const p = u.phase;
  const amp = Math.min(1, speed / 14);
  for (const L of u.legs) {
    const a = p + L.off * Math.PI * 2;
    const s = Math.sin(a), c = Math.cos(a);
    L.hip.rotation.x = s * 0.75 * amp + (L.front ? -0.05 : 0.08);
    if (L.front) L.knee.rotation.x = -Math.max(0, c) * 1.3 * amp;
    else L.knee.rotation.x = Math.max(0, -c) * 1.0 * amp;
  }
  const b = Math.sin(p * 2);
  u.body.position.y = Math.abs(Math.sin(p)) * 0.12 * amp - 0.04 * amp;
  u.body.rotation.x = Math.sin(p) * 0.06 * amp;
  u.neck.rotation.x = -0.62 - Math.sin(p) * 0.16 * amp;
  u.head.rotation.x = 0.15 + Math.sin(p + 0.6) * 0.1 * amp;
  u.tail.rotation.x = -0.55 - 0.5 * amp - Math.sin(p * 1.0) * 0.18 * amp;
  u.tail.rotation.z = Math.sin(t * 2 + u.phase * 0.1) * 0.15;
  u.jockey.position.y = 1.78 - Math.abs(Math.sin(p)) * 0.08 * amp;
  u.jockey.rotation.x = Math.sin(p) * 0.05 * amp;
  if (speed < 0.2) {
    // idle breathing
    u.body.position.y = Math.sin(t * 2) * 0.01; u.neck.rotation.x = -0.55 + Math.sin(t * 1.3) * 0.04;
    for (const L of u.legs) { L.hip.rotation.x *= 0.85; L.knee.rotation.x *= 0.85; }
  }
  // returns number of footfalls crossed (for sound)
  const step = Math.PI / 2;
  return Math.floor(u.phase / step) - Math.floor(prev / step);
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
  const H = HORSES[sel];
  const mesh = makeHorse({ coat: H.coat, mane: H.mane, sock: H.sock, silk: PLAYER_SILK, cap: PLAYER_CAP, num: 3, blaze: sel === 2 });
  mesh.position.set(LANES[PLAYER_LANE], 0, 0);
  scene.add(mesh);
  player = { mesh, name: H.name, z: 0, v: 0, me: true, color: '#16a34a' };
}
const rivalLanes = [0, 1, 3, 4];
RIVALS.forEach((r, i) => {
  const mesh = makeHorse({ coat: r.coat, mane: r.mane, silk: r.silk, cap: r.cap, num: rivalLanes[i] + 1, blaze: i === 2 });
  mesh.position.set(LANES[rivalLanes[i]], 0, 0);
  scene.add(mesh);
  rivals.push({ mesh, name: r.name, z: 0, v: 0, color: '#' + new THREE.Color(r.silk).getHexString(), base: 0, seed: Math.random() * 10 });
});
buildPlayer();

/* ================= UI ================= */
const $ = (id) => document.getElementById(id);
const ui = {
  menu: $('menu'), hud: $('hud'), result: $('result'), count: $('count'), pop: $('pop'), banner: $('banner'), vign: $('vign'),
  needle: $('needle'), zperf: $('zperf'), zgood: $('zgood'), combo: $('combo'), place: $('place'), left: $('left'), time: $('time'),
  stam: $('stam'), stamb: $('stamb'), stamv: $('stamv'), spd: $('spd'), lane: $('lane'),
};
const dots = [];
function setupDots() {
  ui.lane.querySelectorAll('.dot').forEach((d) => d.remove()); dots.length = 0;
  for (const r of [...rivals, player]) {
    const d = document.createElement('div'); d.className = 'dot' + (r.me ? ' me' : ''); d.style.background = r.color;
    ui.lane.appendChild(d); dots.push([r, d]);
  }
}
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function wins() { return store.get('wins', 0); }
function level() { return 1 + Math.min(9, Math.floor(wins() / 2)); }
function renderMenu() {
  const H = HORSES[sel];
  $('hname').textContent = H.name; $('hdesc').textContent = H.desc;
  $('s1').style.width = H.speed * 10 + '%'; $('s2').style.width = H.stamina * 10 + '%'; $('s3').style.width = H.control * 10 + '%';
  $('lvl').textContent = level(); $('wins').textContent = wins();
  const b = store.get('best', null); $('best').textContent = b ? b.toFixed(2) + ' s' : '—';
  $('mute').textContent = muted ? '🔇' : '🔊';
}
function pick(d) {
  sel = (sel + d + HORSES.length) % HORSES.length; store.set('horse', sel);
  buildPlayer(); renderMenu(); haptic('select'); Audio.init(); Audio.click();
  menuSpin = 0;
}
$('prev').onclick = () => pick(-1);
$('next').onclick = () => pick(1);
$('mute').onclick = () => { muted = !muted; store.set('muted', muted); Audio.init(); Audio.setMuted(muted); renderMenu(); };
$('start').onclick = () => { Audio.init(); haptic('impact', 'medium'); startRace(); };
$('again').onclick = () => { Audio.init(); haptic('impact', 'medium'); toMenu(); };
$('ctabot').onclick = () => openTg(BOT_URL);
$('ctasite').onclick = (e) => { e.preventDefault(); openLink(SITE_URL); };
$('share').onclick = () => {
  const r = lastResult; if (!r) return;
  const text = `Otbozor ot poygasida ${r.place}-o'rinni oldim, 800 metrni ${r.time.toFixed(2)} soniyada bosib o'tdim! Sen meni yengib ko'r 🐎`;
  if (window.TelegramGameProxy && window.TelegramGameProxy.shareScore) { try { window.TelegramGameProxy.shareScore(); return; } catch {} }
  openTg(`https://t.me/share/url?url=${encodeURIComponent(GAME_URL)}&text=${encodeURIComponent(text)}`);
};

let popT = 0;
function pop(text, color) {
  ui.pop.textContent = text; ui.pop.style.color = color;
  ui.pop.style.textShadow = '0 0 2px #fff, 0 3px 0 #fff, 0 -2px 0 #fff, 3px 0 0 #fff, -3px 0 0 #fff, 0 10px 24px rgba(0,0,0,.25)';
  ui.pop.classList.remove('show'); void ui.pop.offsetWidth; ui.pop.classList.add('show');
}
let bannerT = 0;
function banner(t, dur = 1.8) { ui.banner.textContent = t; ui.banner.classList.add('on'); bannerT = dur; }

/* ================= GAME LOGIC ================= */
let mode = 'menu'; // menu | count | race | finish
let raceT = 0, countT = 0, goTime = 0;
let stamina = 100, boost = 0, combo = 0, bestCombo = 0, taps = 0, perfects = 0, lastTap = -1, needleT = 0, stumble = 0;
let finishOrder = [], lastResult = null, finishCam = 0, menuSpin = 0, tiredWarned = false, shownFinal = false, falseStart = false;

function stats() { const H = HORSES[sel]; return H; }
function zones() {
  const H = stats();
  const perf = 0.10 + H.control * 0.008;      // 0.148 .. 0.172
  return { perf, good: perf + 0.16 };
}
function layoutZones() {
  const z = zones();
  ui.zperf.style.left = (50 - z.perf * 50) + '%'; ui.zperf.style.width = z.perf * 100 + '%';
  ui.zgood.style.left = (50 - z.good * 50) + '%'; ui.zgood.style.width = z.good * 100 + '%';
}

function resetRace() {
  for (const h of [player, ...rivals]) { h.z = 0; h.v = 0; h.done = false; h.time = 0; h.mesh.position.z = 0; }
  const lv = level();
  rivals.forEach((r, i) => {
    r.base = 16.4 + i * 0.45 + lv * 0.32 + Math.random() * 0.5;
    r.kick = 1.5 + Math.random() * 2.2;
    r.seed = Math.random() * 10;
  });
  stamina = 100; boost = 0; combo = 0; bestCombo = 0; taps = 0; perfects = 0; lastTap = -1; needleT = 0; stumble = 0;
  raceT = 0; finishOrder = []; tiredWarned = false; shownFinal = false; falseStart = false;
  layoutZones(); setupDots();
}

function setRivals(v) { for (const r of rivals) r.mesh.visible = v; }
function toMenu() {
  mode = 'menu'; Audio.cheer(false); setRivals(false);
  hide(ui.result); hide(ui.hud); show(ui.menu);
  resetRace(); renderMenu();
}

function startRace() {
  resetRace();
  hide(ui.menu); hide(ui.result); show(ui.hud); setRivals(true);
  mode = 'count'; countT = 3.0; goTime = -1;
  ui.count.classList.remove('hidden', 'go');
  ui.count.textContent = '3'; Audio.beep(false); haptic('impact', 'light');
  if (store.get('races', 0) < 3) $('tip').classList.remove('hidden');
  store.set('races', store.get('races', 0) + 1);
}

function needlePos() {
  // triangle wave, speeds up as race progresses
  return 1 - Math.abs(((needleT % 2) + 2) % 2 - 1);
}

function onTap() {
  if (mode === 'count') {
    if (countT > 0.15) { falseStart = true; banner("Shoshilmang! Signalni kuting"); Audio.miss(); haptic('notify', 'error'); }
    return;
  }
  if (mode !== 'race') return;
  if (raceT - lastTap < 0.18) return;
  lastTap = raceT; taps++;
  const H = stats();
  const d = Math.abs(needlePos() - 0.5) * 2; // 0 center .. 1 edge
  const z = zones();
  const tired = stamina < 18;
  const eff = tired ? 0.45 : 1;
  const sCost = 1.25 - H.stamina * 0.07; // 0.62 .. 0.83
  if (raceT < 0.35 && taps === 1 && !falseStart) {
    boost += 5; banner("Zo'r start! 🚀", 1.4); Audio.whoosh();
  }
  if (d <= z.perf) {
    combo++; perfects++; bestCombo = Math.max(bestCombo, combo);
    boost = Math.min(10, boost + (3.6 + Math.min(combo, 6) * 0.35) * eff);
    stamina -= 4.2 * sCost;
    pop(combo >= 3 ? `Zo'r! x${combo}` : "Zo'r!", '#16a34a'); Audio.perfect(combo); haptic('impact', combo >= 3 ? 'heavy' : 'medium');
    if (combo === 5 || combo === 10 || combo === 15) { banner(`🔥 ${combo} ta ketma-ket aniq zarb!`); }
    for (let i = 0; i < 4; i++) puff(player.mesh.position.x, player.mesh.position.z + 1, player.v, true);
  } else if (d <= z.good) {
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
function needleDir() { return needlePos() - prevNeedle; } // >0 moving right

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button,a')) return;
  Audio.init(); onTap();
}, { passive: true });
window.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); Audio.init(); if (mode === 'menu') startRace(); else onTap(); } });

function updateRace(dt) {
  raceT += dt;
  const H = stats();
  const prog = Math.min(1, player.z / RACE);
  // needle speed
  prevNeedle = needlePos();
  needleT += dt * (1.45 + prog * 0.7);
  // stamina regen & boost decay
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
  if (!player.done) player.z += player.v * dt;

  // rivals
  rivals.forEach((r, i) => {
    if (r.done) { r.v *= 0.985; r.z += r.v * dt; return; }
    const rp = r.z / RACE;
    let tgt = r.base + Math.sin(raceT * 0.6 + r.seed) * 0.9 + Math.sin(raceT * 1.7 + r.seed * 2) * 0.4;
    if (rp > 0.72) tgt += r.kick;
    const gap = player.z - r.z;
    if (gap > 28) tgt += Math.min(2.5, (gap - 28) * 0.06);  // keep pack close
    if (gap < -40) tgt -= 1.2;
    r.v += (tgt - r.v) * Math.min(1, dt * 1.2);
    r.z += r.v * dt;
  });

  // finish checks
  for (const h of [player, ...rivals]) {
    if (!h.done && h.z >= RACE) {
      h.done = true;
      // exact crossing time
      h.time = raceT - (h.z - RACE) / Math.max(1, h.v);
      finishOrder.push(h);
      if (h === player) finishRace();
    }
  }
  if (!shownFinal && player.z > RACE - 200) { shownFinal = true; banner('🏁 Oxirgi 200 metr! Hammasini bering!'); Audio.cheer(true); }

  // HUD
  const all = [player, ...rivals];
  const place = 1 + all.filter((h) => h !== player && (h.done && !player.done ? true : h.z > player.z)).length;
  ui.place.innerHTML = `${place}<sup>/5</sup>`;
  ui.left.textContent = Math.max(0, Math.ceil(RACE - player.z)) + ' m';
  ui.time.textContent = raceT.toFixed(2);
  ui.stamb.style.width = stamina + '%'; ui.stamv.textContent = Math.round(stamina) + '%';
  ui.stam.classList.toggle('low', tired);
  ui.spd.textContent = Math.round(player.v * 3.6);
  ui.needle.style.left = needlePos() * 100 + '%';
  ui.vign.classList.toggle('on', boost > 6);
  for (const [h, d] of dots) d.style.left = Math.min(100, (h.z / RACE) * 100) + '%';
}

function finishRace() {
  mode = 'finish'; finishCam = 0;
  const t = player.time;
  const place = finishOrder.indexOf(player) + 1;
  const prevBest = store.get('best', null);
  const isBest = !prevBest || t < prevBest;
  if (isBest) store.set('best', t);
  if (place === 1) store.set('wins', wins() + 1);
  const acc = taps ? Math.round((perfects / taps) * 100) : 0;
  lastResult = { place, time: t, acc };
  haptic('notify', place === 1 ? 'success' : 'warning');
  if (place === 1) Audio.fanfare();
  ui.vign.classList.remove('on');
  setTimeout(() => showResult(isBest), 1600);
}

function showResult(isBest) {
  const r = lastResult;
  // let remaining rivals "finish" with projected times
  for (const h of rivals) if (!h.done) { h.done = true; h.time = player.time + (RACE - h.z) / Math.max(10, h.v); finishOrder.push(h); }
  finishOrder.sort((a, b) => a.time - b.time);
  r.place = finishOrder.indexOf(player) + 1;
  hide(ui.hud); show(ui.result);
  const sub = ['G\'alaba! 🏆', 'Juda yaqin edi!', 'Shohsupada!', 'Yomon emas', 'Keyingisida albatta'][r.place - 1];
  $('rplace').innerHTML = `${r.place}<sup>-o'rin</sup>`;
  $('rsub').textContent = isBest ? sub + ' · Yangi rekord!' : sub;
  const stars = r.place === 1 ? (r.acc >= 60 ? 3 : 2) : r.place <= 3 ? 1 : 0;
  $('stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('stars').style.color = '#facc15';
  $('rtime').textContent = r.time.toFixed(2);
  $('rbest').textContent = (store.get('best', r.time)).toFixed(2);
  $('racc').textContent = r.acc + '%';
  $('order').innerHTML = finishOrder.map((h, i) =>
    `<div class="${h === player ? 'me' : ''}"><b>${i + 1}.</b><i style="background:${h.color}"></i>${h.name}${h === player ? ' (siz)' : ''}<span>${h.time.toFixed(2)} s</span></div>`).join('');
  setTimeout(() => Audio.cheer(false), 2500);
}

/* ================= CAMERA ================= */
const DEBUG_CAM = (/[?&]cam=([-\d.]+),([-\d.]+),([-\d.]+)/.exec(location.search) || null)?.slice(1).map(Number);
const camPos = new THREE.Vector3(6, 3, 8), camLook = new THREE.Vector3();
function updateCamera(dt, t) {
  const p = player.mesh.position;
  let want, look, fov = 55;
  if (DEBUG_CAM) {
    want = new THREE.Vector3(p.x + DEBUG_CAM[0], DEBUG_CAM[1], p.z + DEBUG_CAM[2]); look = new THREE.Vector3(p.x, 1.1, p.z);
  } else if (mode === 'menu') {
    menuSpin += dt * 0.35;
    const a = 0.9 + Math.sin(menuSpin) * 0.5;
    want = new THREE.Vector3(p.x + Math.sin(a) * 7.2, 2.3, p.z - Math.cos(a) * 7.2 - 0.4);
    look = new THREE.Vector3(p.x, 0.15, p.z - 0.3);
  } else if (mode === 'count') {
    want = new THREE.Vector3(p.x + 2.2, 1.9, p.z - 8.5);
    look = new THREE.Vector3(p.x - 0.3, 0.6, p.z);
  } else if (mode === 'race') {
    const v = player.v;
    const shake = v > 20 ? (v - 20) * 0.012 : 0;
    want = new THREE.Vector3(p.x + 1.9, 2.6 + Math.sin(t * 18) * shake, p.z + 4.9 - Math.min(0.8, Math.max(0, boost) * 0.08));
    look = new THREE.Vector3(p.x + 0.35, 0.9, p.z - 5);
    fov = Math.min(68, 54 + Math.max(0, boost) * 0.9 + Math.max(0, v - 19) * 0.5);
  } else {
    finishCam += dt * 0.4;
    want = new THREE.Vector3(p.x + Math.sin(finishCam + 0.8) * 7, 2.6, p.z + Math.cos(finishCam + 0.8) * 7);
    look = new THREE.Vector3(p.x, 1.4, p.z);
  }
  const k = mode === 'race' ? 1 - Math.pow(0.0005, dt) : 1 - Math.pow(0.02, dt);
  camPos.lerp(want, k); camLook.lerp(look, k);
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
  for (let i = 0; i < SUB; i++) step(rdt);
  updateDust(rdt);
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
    for (const h of [player, ...rivals]) { h.v *= (h === player ? 0.975 : 0.99); h.z += h.v * dt; }
    for (const h of rivals) if (!h.done && h.z >= RACE) { h.done = true; h.time = raceT - (h.z - RACE) / Math.max(1, h.v); finishOrder.push(h); }
  }
  for (const h of [player, ...rivals]) {
    h.mesh.position.z = -h.z;
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

renderMenu(); layoutZones(); setupDots(); setRivals(false);
requestAnimationFrame((t) => { last = t; frame(t); });
setTimeout(() => { const l = $('loading'); l.style.opacity = 0; setTimeout(() => l.remove(), 450); }, 350);
