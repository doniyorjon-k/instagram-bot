// Shared helpers for Reel templates. A template defines window.build(D, R) which
// creates its DOM from the data D and schedules animations with the helpers in R,
// then returns the total length in ms. All animations are paused and seeked per
// frame by the renderer, so output is deterministic.
(function () {
  const E = 'cubic-bezier(.2,.8,.2,1)';
  const $ = (tag, cls, text, parent) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };
  const R = {
    E, $,
    rise: (el, delay, dist = 50) => el.animate(
      [{opacity: 0, transform: `translateY(${dist}px)`}, {opacity: 1, transform: 'none'}],
      {delay, duration: 650, easing: E, fill: 'both'}),
    fadeIn: (el, delay, duration = 450) => el.animate([{opacity: 0}, {opacity: 1}], {delay, duration, fill: 'both'}),
    fadeOut: (el, delay, duration = 300) => el.animate([{opacity: 1}, {opacity: 0}], {delay, duration, fill: 'forwards'}),
    wipe: (el, delay) => el.animate(
      [{clipPath: 'inset(0 100% 0 0 round .14em)'}, {clipPath: 'inset(0 0 0 0 round .14em)'}],
      {delay, duration: 600, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'both'}),
    pop: (el, delay) => el.animate([{opacity: 0, transform: 'scale(.3)'}, {opacity: 1, transform: 'none'}],
      {delay, duration: 450, easing: E, fill: 'both'}),
    // Big question/title: "line1 <mark>mark</mark> line2"
    title: (parent, cls, a, mark, b) => {
      const el = $('div', cls, null, parent);
      if (a) el.append(document.createTextNode(a + ' '));
      const m = mark ? $('span', 'mark', mark, el) : null;
      if (b) el.append(document.createTextNode(' ' + b));
      return [el, m];
    },
    header: (stage, label) => {
      const h = $('div', 'hdr', null, stage);
      const brand = $('div', 'brand', null, h);
      const img = $('img', null, null, brand); img.src = '../../assets/logo.svg';
      brand.append(document.createTextNode('Otbozor'));
      $('div', 'pill', label, h);
      return h;
    },
    // Bold lead + body text, e.g. "<b>Atigi 2-3 soat.</b> Ot ko'pincha..."
    rich: (parent, cls, bold, rest) => {
      const el = $('div', cls, null, parent);
      if (bold) $('b', null, bold + ' ', el);
      if (rest) el.append(document.createTextNode(rest));
      return el;
    },
    cta: (stage, D, start) => {
      const c = $('div', 'cta', null, stage);
      $('div', 'ring', null, c); $('div', 'ring2', null, c);
      const h = $('div', 'h big fit', null, c); $('span', null, D.cta_title, h);
      const b = $('div', 'b fit', D.cta_body, c);
      const btn = $('div', 'btn', '@otbozor_bot →', c);
      const alt = $('div', 'alt', 'yoki saytda: ', c); $('b', null, 'otbozor.uz', alt);
      R.fadeIn(c, start);
      [h, b, btn, alt].forEach((el, i) => R.rise(el, start + 200 + i * 140));
      btn.animate([{transform: 'scale(1)'}, {transform: 'scale(1.06)'}, {transform: 'scale(1)'}],
                  {delay: start + 1500, duration: 900, iterations: 2, easing: 'ease-in-out'});
      return start + 3600;
    },
  };

  // Shrink text in .fit boxes until it fits (never below data-min).
  const need = el => {
    const c = el.firstElementChild;
    return (c && getComputedStyle(el).display === 'flex') ? c.getBoundingClientRect().height : el.scrollHeight;
  };
  const fit = () => document.querySelectorAll('.fit').forEach(el => {
    const min = parseFloat(el.dataset.min || '30');
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (need(el) > el.clientHeight + 2 && size > min) { size -= 2; el.style.fontSize = size + 'px'; }
    el.dataset.fitted = need(el) <= el.clientHeight + 2 ? 'ok' : 'overflow';
  });

  document.fonts.ready.then(() => {
    const stage = document.getElementById('stage');
    const total = window.build(window.DATA, R, stage, fit);
    document.getAnimations().forEach(a => a.pause());
    window.seek = ms => { document.getAnimations().forEach(a => { a.currentTime = ms; }); if (window.onSeek) window.onSeek(ms); };
    window.REEL_TOTAL = total;
    document.body.dataset.reel = '1';
  });
})();
