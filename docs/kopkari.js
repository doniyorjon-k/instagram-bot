// Ko'pkari mode: grab the uloq, carry it into the qozon circle, defend it in tug-of-war.
export function createKopkari(d) {
  const { THREE, scene, makeHorse, animateHorse, HORSES, RIVALS, SILKS, puff, pop, banner, haptic, Audio, store, addCoins, canvasTex, textTex } = d;
  const { $, show, hide, esc } = d.ui;
  const C = new THREE.Vector3(-190, 0, -300);
  const R = 42, GOAL = new THREE.Vector3(C.x, 0, C.z - 26), GOAL_R = 4.2, MATCH = 90;
  const NAMES = ['Botir', 'Sardor', 'Jasur', 'Oybek', 'Murod'];
  const COLS = [0xef4444, 0x2563eb, 0xf59e0b, 0x9333ea, 0x0ea5e9];

  /* ---------- arena ---------- */
  const arena = new THREE.Group(); arena.position.copy(C); scene.add(arena); arena.visible = false;
  const dirt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c4935f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = Math.random() > .5 ? 'rgba(255,235,210,.16)' : 'rgba(80,50,20,.16)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [14, 14]);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 4, 64), new THREE.MeshLambertMaterial({ map: dirt }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.05; ground.receiveShadow = true; arena.add(ground);
  // fence
  const postM = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const N = 72;
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), postM, N);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; m4.makeTranslation(Math.cos(a) * (R + 3), 0.6, Math.sin(a) * (R + 3)); posts.setMatrixAt(i, m4); }
  arena.add(posts);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(R + 3, 0.07, 6, 96), new THREE.MeshLambertMaterial({ color: 0x16a34a }));
  rail.rotation.x = Math.PI / 2; rail.position.y = 1.15; arena.add(rail);
  // crowd ring
  const cols = [0xef4444, 0x3b82f6, 0xfacc15, 0xffffff, 0x16a34a, 0xf97316, 0x0f172a, 0xa855f7, 0x7c2d12];
  const CN = 520, crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 1.1, 0.5), new THREE.MeshLambertMaterial(), CN);
  const cc = new THREE.Color();
  for (let i = 0; i < CN; i++) {
    const a = Math.random() * Math.PI * 2, r = R + 5 + Math.random() * 7;
    m4.makeTranslation(Math.cos(a) * r, 0.55 + (r - R - 5) * 0.25, Math.sin(a) * r); crowd.setMatrixAt(i, m4); crowd.setColorAt(i, cc.setHex(cols[i % cols.length]));
  }
  arena.add(crowd);
  // qozon (goal)
  const goal = new THREE.Group(); goal.position.set(GOAL.x - C.x, 0, GOAL.z - C.z); arena.add(goal);
  const ring = new THREE.Mesh(new THREE.RingGeometry(GOAL_R - 0.35, GOAL_R, 48), new THREE.MeshBasicMaterial({ color: 0x16a34a }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; goal.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(GOAL_R - 0.35, 48), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.22 }));
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.07; goal.add(fill);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 8), postM); pole.position.set(0, 2.5, -GOAL_R); goal.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshLambertMaterial({ map: textTex(256, 144, '#16a34a', [{ text: 'QOZON', size: 54, y: 74, color: '#fff' }]), side: THREE.DoubleSide }));
  flag.position.set(0.8, 4.4, -GOAL_R); goal.add(flag);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), new THREE.MeshLambertMaterial({ map: textTex(512, 100, '#ffffff', [{ text: "OTBOZOR KO'PKARI", size: 54, y: 52, color: '#15803d' }]) }));
  sign.position.set(0, 2.2, -(R + 3.4)); arena.add(sign);
  // uloq
  const uloq = new THREE.Group(); arena.add(uloq);
  const fur = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 10), fur); body.rotation.z = Math.PI / 2; body.castShadow = true; uloq.add(body);
  for (const x of [-0.3, 0.3]) for (const z of [-0.12, 0.12]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.45, 5), fur); l.position.set(x, -0.15, z); l.rotation.z = x > 0 ? 0.6 : -0.6; uloq.add(l); }
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.8 }));
  halo.rotation.x = -Math.PI / 2; arena.add(halo);

  /* ---------- state ---------- */
  let riders = [], me = null, carrier = null, uloqPos = new THREE.Vector3(), uloqDrop = 0, t = 0, active = false, done = false;
  let joy = null, tug = null, respawnT = 0, tugWins = 0, dashT = 0, dashCool = 0;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 }));
  arrow.rotation.x = -Math.PI / 2; const arrowG = new THREE.Group(); arrowG.add(arrow); arrow.position.z = -2.6; arena.add(arrowG);
  function dash() {
    if (!active || dashCool > 0 || tug) return;
    dashT = 1.3; dashCool = 5; Audio.whoosh(); haptic('impact', 'heavy'); pop('⚡ Tezlash!', '#f59e0b');
  }
  const tmp = new THREE.Vector3();

  function label(name, col) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(256, 64, '#' + new THREE.Color(col).getHexString(), [{ text: name, size: 34, y: 34, color: '#fff' }]), transparent: true, depthWrite: false }));
    sp.scale.set(1.9, 0.48, 1); sp.position.y = 3.2; return sp;
  }
  function build() {
    for (const r of riders) arena.remove(r.mesh);
    riders = [];
    const { sel, silkSel } = d.getSel();
    const H = HORSES[sel], S = SILKS[silkSel] || SILKS[0];
    const add = (o, name, col, isMe, i) => {
      const mesh = makeHorse(o); mesh.add(label(name, col)); arena.add(mesh);
      const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
      const rad = isMe ? 12 : 19;
      const r = { mesh, name, col, me: isMe, x: Math.cos(a) * rad, z: Math.sin(a) * rad, hd: Math.atan2(Math.cos(a), Math.sin(a)), v: 0, score: 0, stun: isMe ? 0 : 1.0, cool: 0,
        top: isMe ? 12.4 + H.speed * 0.2 : 9.9 + Math.random() * 0.9 + Math.min(10, store.get('wins', 0)) * 0.06, role: i % 3, seed: Math.random() * 9 };
      riders.push(r); return r;
    };
    me = add({ coat: H.coat, mane: H.mane, silk: S.c, cap: S.cap, num: 1, blaze: H.blaze }, 'Siz', S.c, true, 0);
    for (let i = 0; i < 5; i++) { const rv = RIVALS[i % RIVALS.length]; add({ coat: rv.coat, mane: rv.mane, silk: COLS[i], cap: 0xffffff, num: i + 2 }, NAMES[i], COLS[i], false, i + 1); }
  }

  function resetUloq() { carrier = null; uloqPos.set(0, 0.3, 0); uloqDrop = 1; }

  function start() {
    d.setMode('kop'); d.applyTheme('dala', false);
    build(); resetUloq();
    t = MATCH; active = true; done = false; tug = null; tugWins = 0; respawnT = 0; dashT = 0; dashCool = 0;
    $('kdash').onclick = dash;
    arena.visible = true;
    hide($('menu')); hide($('result')); hide($('hud')); show($('khud')); hide($('tug'));
    $('khint').style.opacity = 1; setTimeout(() => { $('khint').style.opacity = 0; }, 4500);
    banner("🐐 Ko'pkari! Uloqni olib, qozonga tashlang", 2.6);
    Audio.beep(true); Audio.cheer(true); haptic('impact', 'heavy');
    hud();
  }
  function stop() {
    if (!arena.visible && !active) return;
    active = false; arena.visible = false; hide($('khud')); hide($('joy')); hide($('tug'));
  }

  function hud() {
    $('kscore').textContent = me.score;
    $('kbest').textContent = Math.max(...riders.filter((r) => !r.me).map((r) => r.score));
    const s = Math.max(0, Math.ceil(t)); $('ktime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /* ---------- input ---------- */
  function pointer(type, e) {
    if (!active) return;
    if (type === 'down') {
      joy = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId };
      const j = $('joy'); j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; show(j); $('joyk').style.transform = '';
      if (tug) tapTug();
    } else if (type === 'move' && joy && e.pointerId === joy.id) {
      joy.x = e.clientX; joy.y = e.clientY;
      const dx = joy.x - joy.x0, dy = joy.y - joy.y0, l = Math.hypot(dx, dy), k = Math.min(1, 46 / Math.max(l, 1));
      $('joyk').style.transform = `translate(${dx * k}px,${dy * k}px)`;
    } else if (type === 'up' && joy && e.pointerId === joy.id) { joy = null; hide($('joy')); }
  }
  function tap() { if (tug) tapTug(); }
  function tapTug() { tug.taps++; haptic('impact', 'light'); Audio.click(); }

  /* ---------- tug of war ---------- */
  function startTug(a, b) {
    // a = attacker, b = carrier
    a.cool = b.cool = 2.5;
    if (b.me && !a.me) a.cool = 3.5;
    if (!a.me && !b.me) {
      const win = Math.random() < 0.45 ? a : b;
      if (win === a) { carrier = a; b.stun = 1.0; }
      else a.stun = 0.8;
      return;
    }
    tug = { a, b, time: 2.0, taps: 0, need: 4 + Math.floor(Math.random() * 3) + Math.min(3, Math.floor(store.get('wins', 0) / 5)) };
    show($('tug')); $('tugt').textContent = b.me ? `${a.name} uloqni tortyapti! Tez-tez bosing!` : `${b.name} bilan tortishuv! Tez-tez bosing!`;
    haptic('notify', 'warning'); Audio.whoosh();
  }
  function endTug() {
    const { a, b } = tug, playerWon = tug.taps >= tug.need;
    hide($('tug'));
    const meIsCarrier = b.me;
    if (playerWon) {
      tugWins++;
      if (!meIsCarrier) { carrier = me; b.stun = 2.0; me.cool = 3; pop('Tortib oldingiz!', '#16a34a'); }
      else { a.stun = 2.2; me.cool = 3; pop("Uloqni saqladingiz!", '#16a34a'); }
      haptic('notify', 'success'); Audio.perfect(3);
    } else {
      if (meIsCarrier) { carrier = a; me.stun = 1.0; pop('Uloqni oldirdingiz', '#ef4444'); }
      else { me.stun = 0.8; pop("Bo'shatmadi", '#ef4444'); }
      haptic('notify', 'error'); Audio.miss();
    }
    tug = null;
  }

  /* ---------- AI + movement ---------- */
  function steer(r, tx, tz, want, dt) {
    const turn = r.me ? 5.5 : 3.0;
    const dx = tx - r.x, dz = tz - r.z, dist = Math.hypot(dx, dz);
    if (dist < 0.3) { r.v += (0 - r.v) * Math.min(1, dt * 2); return; }
    const target = Math.atan2(-dx, -dz);
    let da = target - r.hd; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    r.hd += Math.max(-dt * turn, Math.min(dt * turn, da));
    const sp = want * (Math.abs(da) > 1.2 ? 0.5 : 1);
    r.v += (sp - r.v) * Math.min(1, dt * 1.8);
  }
  function update(dt) {
    if (!active) return;
    if (tug) { tug.time -= dt; $('tugb').style.width = Math.min(100, tug.taps / tug.need * 100) + '%'; if (tug.time <= 0) endTug(); }
    else t -= dt;
    dashT = Math.max(0, dashT - dt); dashCool = Math.max(0, dashCool - dt);
    const db = $('kdash'); db.style.display = tug ? 'none' : ''; db.disabled = dashCool > 0; db.textContent = dashCool > 0 ? Math.ceil(dashCool) + ' s' : '⚡ Tezlash';
    if (t <= 0 && !done) return finish();
    // uloq drop animation
    if (uloqDrop > 0) uloqDrop = Math.max(0, uloqDrop - dt * 1.5);
    if (respawnT > 0) { respawnT -= dt; if (respawnT <= 0) resetUloq(); }

    for (const r of riders) {
      r.stun = Math.max(0, r.stun - dt); r.cool = Math.max(0, r.cool - dt);
      const top = r.top * (carrier === r ? (r.me ? 0.95 : 0.82) : 1) * (r.me && dashT > 0 ? 1.45 : 1);
      if (tug && (tug.a === r || tug.b === r)) { r.v *= 0.9; }
      else if (r.stun > 0) { r.v *= 0.94; }
      else if (r.me) {
        if (joy) {
          const dx = joy.x - joy.x0, dy = joy.y - joy.y0, l = Math.hypot(dx, dy);
          if (l > 8) steer(r, r.x + dx, r.z + dy, top * Math.min(1, l / 50), dt);
          else r.v *= 0.96;
        } else r.v += (0 - r.v) * Math.min(1, dt * 1.2);
      } else {
        let tx, tz, sp = top;
        if (respawnT > 0) { tx = Math.sin(t * 0.3 + r.seed) * 10; tz = Math.cos(t * 0.3 + r.seed) * 10; sp *= 0.5; }
        else if (!carrier) { tx = uloqPos.x + Math.sin(r.seed) * 1.2; tz = uloqPos.z + Math.cos(r.seed) * 1.2; }
        else if (carrier === r) { const gx = GOAL.x - C.x, gz = GOAL.z - C.z; tx = gx + Math.sin(t * 1.3 + r.seed) * 3; tz = gz; }
        else if (r.role === 2) { tx = (GOAL.x - C.x + carrier.x) / 2; tz = (GOAL.z - C.z + carrier.z) / 2; }
        else { tx = carrier.x - Math.sin(carrier.hd) * 2; tz = carrier.z - Math.cos(carrier.hd) * 2; }
        steer(r, tx, tz, sp, dt);
      }
      r.x += -Math.sin(r.hd) * r.v * dt; r.z += -Math.cos(r.hd) * r.v * dt;
      const rr = Math.hypot(r.x, r.z); if (rr > R) { r.x *= R / rr; r.z *= R / rr; r.v *= 0.9; }
    }
    // separation
    for (let i = 0; i < riders.length; i++) for (let j = i + 1; j < riders.length; j++) {
      const a = riders[i], b = riders[j], dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz);
      if (dd < 1.6 && dd > 0.001) { const push = (1.6 - dd) / 2; a.x -= dx / dd * push; a.z -= dz / dd * push; b.x += dx / dd * push; b.z += dz / dd * push; }
    }
    // grab
    if (!carrier && respawnT <= 0 && uloqDrop < 0.3) {
      for (const r of riders) if (r.stun <= 0 && Math.hypot(r.x - uloqPos.x, r.z - uloqPos.z) < (r.me ? 2.8 : 1.7)) {
        carrier = r; r.cool = 1.2;
        if (r.me) { banner("✊ Uloq sizda! Qozonga olib boring", 1.6); haptic('impact', 'heavy'); Audio.whoosh(); }
        else banner(`${r.name} uloqni oldi!`, 1.2);
        break;
      }
    }
    // snatch attempts
    if (carrier && !tug && carrier.cool <= 0) {
      for (const r of riders) if (r !== carrier && r.stun <= 0 && r.cool <= 0 && Math.hypot(r.x - carrier.x, r.z - carrier.z) < (r.me ? 3.4 : carrier.me ? 1.9 : 2.3)) { startTug(r, carrier); break; }
    }
    // score
    if (carrier && !tug) {
      const gx = GOAL.x - C.x, gz = GOAL.z - C.z;
      if (Math.hypot(carrier.x - gx, carrier.z - gz) < GOAL_R) {
        carrier.score++;
        if (carrier.me) { pop('HALOL! +1', '#16a34a'); haptic('notify', 'success'); Audio.fanfare(); d.camKick && d.camKick(); }
        else { banner(`${carrier.name} uloqni qozonga tashladi`, 1.4); Audio.miss(); }
        uloqPos.set(gx, 0.3, gz); carrier = null; respawnT = 1.6;
      }
    }
    if (carrier) { uloqPos.set(carrier.x - Math.cos(carrier.hd) * 0.55, 0, carrier.z + Math.sin(carrier.hd) * 0.55); }

    // render
    for (const r of riders) {
      r.mesh.position.set(r.x, 0, r.z); r.mesh.rotation.y = r.hd;
      const steps = animateHorse(r.mesh, dt, r.v, t);
      if (steps && r.v > 6 && Math.random() < 0.35) puff(C.x + r.x, C.z + r.z + 0.5, r.v * 0.3, false);
    }
    uloq.position.set(uloqPos.x, carrier ? 1.25 : 0.3 + uloqDrop * 6, uloqPos.z);
    uloq.rotation.y = carrier ? carrier.hd + Math.PI / 2 : uloq.rotation.y + dt;
    halo.visible = !carrier && respawnT <= 0; halo.position.set(uloqPos.x, 0.09, uloqPos.z); halo.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
    fill.material.opacity = carrier && carrier.me ? 0.35 + Math.sin(t * 8) * 0.15 : 0.22;
    flag.rotation.y = Math.sin(t * 5) * 0.3;
    // guide arrow: to the uloq, to the qozon when carrying, to the carrier otherwise
    let tx, tz;
    if (carrier === me) { tx = GOAL.x - C.x; tz = GOAL.z - C.z; arrow.material.color.set(0x22c55e); }
    else if (carrier) { tx = carrier.x; tz = carrier.z; arrow.material.color.set(0xef4444); }
    else { tx = uloqPos.x; tz = uloqPos.z; arrow.material.color.set(0xfacc15); }
    arrowG.visible = respawnT <= 0 && Math.hypot(tx - me.x, tz - me.z) > 4;
    arrowG.position.set(me.x, 0.15, me.z); arrowG.rotation.y = Math.atan2(-(tx - me.x), -(tz - me.z));
    arrow.position.z = -2.6 - Math.sin(t * 8) * 0.25;
    hud();
  }

  function finish() {
    done = true; active = false; hide($('joy')); hide($('tug')); hide($('khud'));
    Audio.cheer(false);
    const order = riders.slice().sort((a, b) => b.score - a.score || (a.me ? -1 : 1));
    const place = order.indexOf(me) + 1;
    const earn = me.score * 40 + tugWins * 10 + (place === 1 ? 100 : 0);
    addCoins(earn);
    const best = store.get('kopBest', 0); if (me.score > best) store.set('kopBest', me.score);
    if (place === 1) { store.set('wins', store.get('wins', 0) + 1); Audio.fanfare(); }
    d.submitScore('kopkari', me.score);
    d.setResult({ kop: true, place, score: me.score });
    show($('result'));
    $('rplace').innerHTML = `${place}<sup>-o'rin</sup>`;
    $('rsub').textContent = place === 1 ? "Ko'pkari g'olibi! 🏆" : me.score ? 'Yaxshi kurash!' : "Keyingi safar uloq sizniki bo'ladi";
    const stars = place === 1 ? 3 : place <= 3 ? 2 : me.score ? 1 : 0;
    $('stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('rtime').textContent = me.score; $('rtime').previousSibling.textContent = 'HALOL';
    $('rbest').textContent = Math.max(best, me.score);
    $('racc').textContent = tugWins; $('racc').previousSibling.textContent = 'TORTISHUV';
    $('earn').textContent = `+${earn} 🪙`;
    $('order').innerHTML = order.map((r, i) => `<div class="${r.me ? 'me' : ''}"><b>${i + 1}.</b><i style="background:#${new THREE.Color(r.col).getHexString()}"></i>${esc(r.name)}<span>${r.score} ta</span></div>`).join('');
    haptic('notify', place === 1 ? 'success' : 'warning');
  }

  const camOff = new THREE.Vector3(0, 21, 15);
  function camera(dt, camPos, camLook) {
    if (!me) return;
    const p = tmp.set(C.x + me.x, 0, C.z + me.z);
    const want = p.clone().add(camOff);
    const k = 1 - Math.pow(0.004, dt);
    camPos.lerp(want, k); camLook.lerp(p.clone().add(new THREE.Vector3(0, 0, -2.5)), k);
    d.camera.position.copy(camPos); d.camera.lookAt(camLook);
    d.camera.fov += (54 - d.camera.fov) * Math.min(1, dt * 4); d.camera.updateProjectionMatrix();
    d.sun.position.set(p.x + 12, 26, p.z + 8); d.sun.target.position.set(p.x, 0, p.z - 2);
  }

  if (/[?&]debug/.test(location.search)) window.__kop = () => ({ arrow: arrowG.rotation.y, tug: !!tug, carrierMe: carrier === me, score: me && me.score, dashCool });
  return { start, stop, update, pointer, tap, dash, camera, get active() { return active; } };
}
