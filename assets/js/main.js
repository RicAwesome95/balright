/* Santioni Spirits — remake. Vanilla JS, no dependencies. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  /* ---------------- flavors ---------------- */
  const FLAVORS = {
    1: { name: 'orange', color: '#63C4F4', copy: 'The saint drinks, and in an instant, a beam of light engulfs him, swirling with orange, chocolate, and cream, an ethereal trail that lifts him beyond the senses.' },
    2: { name: 'mint', color: '#97F3AD', copy: 'The saint drinks, and in an instant, a beam of light engulfs him, swirling with mint, chocolate, and cream, an ethereal trail that lifts him beyond the senses.' },
    3: { name: 'marshmallow', color: '#FBEB7F', copy: 'The saint drinks, and in an instant, a beam of light engulfs him, swirling with marshmallow, coffee, and cream, an ethereal trail that lifts him beyond the senses.' }
  };
  let selectedBottle = 2;

  function selectBottle(n) {
    selectedBottle = n;
    const f = FLAVORS[n];
    document.documentElement.style.setProperty('--drink', f.color);
    $$('.bottle-pick').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.bottle === n)));
    const copy = $('#drink-copy');
    if (copy) copy.textContent = f.copy;
    audio.click();
  }
  $$('.bottle-pick').forEach((b) => {
    b.addEventListener('click', () => selectBottle(+b.dataset.bottle));
    b.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const next = ((selectedBottle - 1 + (e.key === 'ArrowRight' ? 1 : 2)) % 3) + 1;
      selectBottle(next);
      $(`.bottle-pick[data-bottle="${next}"]`).focus();
    });
  });

  /* ---------------- ambient audio (synthesized, no files) ---------------- */
  const audio = (() => {
    let ctx = null, master = null, on = false;
    function build() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 600; filter.connect(master);
      [55, 82.5, 110, 164.8].forEach((f, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6;
        g.gain.value = 0.12 / (i + 1);
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = 0.07 + i * 0.03; lg.gain.value = 0.05 / (i + 1);
        lfo.connect(lg); lg.connect(g.gain); lfo.start();
        o.connect(g); g.connect(filter); o.start();
      });
      return true;
    }
    return {
      toggle() {
        if (!ctx && !build()) return false;
        on = !on;
        if (ctx.state === 'suspended') ctx.resume();
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(on ? 0.5 : 0, ctx.currentTime + 1.2);
        return on;
      },
      click() {
        if (!ctx || !on) return;
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = 880; g.gain.value = 0.08;
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.3);
      }
    };
  })();
  const audioBtn = $('.AudioToggle');
  audioBtn.addEventListener('click', () => audioBtn.setAttribute('aria-pressed', String(audio.toggle())));

  /* ---------------- loader ---------------- */
  const loader = $('#loader');
  function setProgress(p) { loader.style.setProperty('--loader-per', String(clamp(p, 0, 1))); }
  async function runLoader() {
    let p = 0;
    const tick = setInterval(() => { p = Math.min(0.9, p + 0.07); setProgress(p); }, 90);
    const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    const minTime = new Promise((r) => setTimeout(r, reduceMotion ? 200 : 1200));
    const maxTime = new Promise((r) => setTimeout(r, 4000));
    await Promise.race([Promise.all([fontsReady, minTime]), maxTime]);
    clearInterval(tick);
    setProgress(1);
    await new Promise((r) => setTimeout(r, 300));
    body.classList.remove('is-loading');
    loader.setAttribute('aria-hidden', 'true');
    if (store.get('santioni-age') === 'yes') passGate(true);
    else { const yes = $('[data-age="yes"]'); if (yes) yes.focus({ preventScroll: true }); }
  }

  /* ---------------- age gate ---------------- */
  const gate = $('#age-gate');
  function passGate(silent) {
    body.classList.remove('is-gated');
    gate.setAttribute('aria-hidden', 'true');
    gate.setAttribute('inert', '');
    if (!silent) store.set('santioni-age', 'yes');
    showCookies();
  }
  $$('[data-age]').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.age === 'yes') passGate(false);
    else { $('.intro', gate).hidden = true; $('.denied', gate).hidden = false; }
  }));

  /* ---------------- cookie banner ---------------- */
  const cookie = $('#cookie-banner');
  function showCookies() { if (!store.get('santioni-cookies')) cookie.hidden = false; }
  $$('[data-cookie]').forEach((b) => b.addEventListener('click', () => {
    store.set('santioni-cookies', b.dataset.cookie);
    cookie.hidden = true;
  }));

  /* ---------------- chapter reveal + nav ---------------- */
  const chapters = $$('.chapter');
  chapters.forEach((c) => { const n = $('.narration', c); if (n && n.textContent.length > 120) n.setAttribute('data-long', ''); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('in-view');
    }), { threshold: 0.35 });
    chapters.forEach((c) => io.observe(c));
  } else chapters.forEach((c) => c.classList.add('in-view'));

  const navLinks = $$('.header__link');
  function updateNav() {
    const col = $('#collection').getBoundingClientRect().top;
    const key = col < window.innerHeight * 0.5 ? 'collection' : 'experience';
    navLinks.forEach((l) => l.classList.toggle('active', l.dataset.nav === key));
  }

  /* ---------------- products carousel ---------------- */
  const slides = $$('.slide');
  const dots = $$('.dots [data-go]');
  const names = ['Orange Chocolate & Cream', 'Mint Chocolate & Cream', 'Marshmallow Coffee & Cream'];
  const products = $('#products');
  let current = 1;
  function go(i) {
    const prev = current;
    current = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === current);
      s.classList.toggle('is-prev', k === prev && k !== current);
      s.setAttribute('aria-hidden', String(k !== current));
    });
    dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === current)));
    products.style.setProperty('--drink', slides[current].style.getPropertyValue('--drink'));
    $('[data-prev-label]').textContent = names[(current + 2) % 3];
    $('[data-next-label]').textContent = names[(current + 1) % 3];
    audio.click();
  }
  $$('#products [aria-label="previous slide"]').forEach((b) => b.addEventListener('click', () => go(current - 1)));
  $$('#products [aria-label="next slide"]').forEach((b) => b.addEventListener('click', () => go(current + 1)));
  dots.forEach((d) => d.addEventListener('click', () => go(+d.dataset.go)));
  products.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(current - 1);
    if (e.key === 'ArrowRight') go(current + 1);
  });
  let touchX = null;
  products.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  products.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
  go(1);

  /* ---------------- story canvas ---------------- */
  const canvas = $('#story-canvas');
  const ctx = canvas.getContext('2d');
  const experience = $('#experience');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // keyframes per scene: sky top/bottom, fog, monolith (0..1 size), portal glow, interior, beam, crumble, figure scale
  const SCENES = {
    wander:    { top: '#2b2b2e', bot: '#8d8a86', fog: 1.0, mono: 0.0, glow: 0.0, inside: 0, beam: 0, crumble: 0, fig: 0.35 },
    hood:      { top: '#2a2a2e', bot: '#7a7672', fog: 0.9, mono: 0.0, glow: 0.1, inside: 0, beam: 0, crumble: 0, fig: 0.6 },
    glimpse:   { top: '#1f1f24', bot: '#6b5f58', fog: 0.8, mono: 0.25, glow: 0.4, inside: 0, beam: 0, crumble: 0, fig: 0.4 },
    monolith:  { top: '#141418', bot: '#4a3a34', fog: 0.6, mono: 0.55, glow: 0.65, inside: 0, beam: 0, crumble: 0, fig: 0.3 },
    approach:  { top: '#121216', bot: '#4b2a22', fog: 0.5, mono: 0.8, glow: 0.85, inside: 0, beam: 0, crumble: 0, fig: 0.35 },
    near:      { top: '#121214', bot: '#5a2a1e', fog: 0.45, mono: 1.0, glow: 1.0, inside: 0, beam: 0, crumble: 0, fig: 0.5 },
    hand:      { top: '#1a1110', bot: '#a5552e', fog: 0.3, mono: 1.25, glow: 1.4, inside: 0, beam: 0, crumble: 0, fig: 0.0 },
    cathedral: { top: '#3d2618', bot: '#e9c48e', fog: 0.2, mono: 0.0, glow: 0.2, inside: 1, beam: 0, crumble: 0, fig: 0.4 },
    selection: { top: '#3a2216', bot: '#f0cf98', fog: 0.15, mono: 0.0, glow: 0.3, inside: 1, beam: 0, crumble: 0, fig: 0.0 },
    beam:      { top: '#2a1a12', bot: '#d9b07a', fog: 0.1, mono: 0.0, glow: 0.2, inside: 1, beam: 1, crumble: 0, fig: 0.45 },
    float:     { top: '#33201a', bot: '#e0b886', fog: 0.15, mono: 0.0, glow: 0.2, inside: 1, beam: 0.25, crumble: 0, fig: 0.45 },
    crumble:   { top: '#3d0806', bot: '#C82924', fog: 0.2, mono: 0.0, glow: 0.0, inside: 1, beam: 0, crumble: 1, fig: 0.4 }
  };
  const order = chapters.map((c) => SCENES[c.dataset.scene] || SCENES.wander);

  const motes = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: 20 + Math.random() * 80, s: 0.2 + Math.random() * 0.8 }));
  const debris = Array.from({ length: 26 }, (_, i) => ({ x: (i % 2 ? 0.04 : 0.84) + Math.random() * 0.12, y: 0.2 + Math.random() * 0.8, w: 20 + Math.random() * 50, h: 30 + Math.random() * 90, r: Math.random() * 6, v: 0.4 + Math.random() }));

  function sceneAt(f) {
    const i = clamp(Math.floor(f), 0, order.length - 1);
    const j = clamp(i + 1, 0, order.length - 1);
    const t = clamp(f - i, 0, 1);
    const e = t * t * (3 - 2 * t);
    const a = order[i], b = order[j];
    const out = {};
    for (const k in a) out[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], e) : mix(hex(a[k]), hex(b[k]), e);
    return out;
  }

  function drawFigure(x, y, s, robe) {
    if (s <= 0.01) return;
    const h = H * 0.42 * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-h * 0.08, -h * 0.82);
    ctx.quadraticCurveTo(0, -h * 1.02, h * 0.08, -h * 0.82);
    ctx.lineTo(h * 0.2, 0);
    ctx.lineTo(-h * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -h * 0.86, h * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frame(time) {
    const t = time / 1000;
    const rect = experience.getBoundingClientRect();
    const chapterH = rect.height / chapters.length || 1;
    const f = clamp((-rect.top + H * 0.5) / chapterH - 0.5, 0, chapters.length - 1);
    const s = sceneAt(f);
    const drink = hex(FLAVORS[selectedBottle].color);
    const pastStory = rect.bottom < 0;
    canvas.style.visibility = pastStory ? 'hidden' : 'visible';
    if (pastStory) { if (!reduceMotion) requestAnimationFrame(frame); return; }

    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(s.top)); g.addColorStop(1, rgb(s.bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const horizon = H * 0.78;
    // ground
    ctx.fillStyle = rgb(mix(s.bot, [10, 10, 10], 0.6), 0.9 * (1 - s.inside));
    ctx.fillRect(0, horizon, W, H - horizon);

    // monolith + portal
    if (s.mono > 0.01) {
      const mh = H * 0.9 * s.mono, mw = mh * 0.38;
      const mx = W / 2 - mw / 2, my = horizon - mh;
      ctx.fillStyle = rgb([14, 12, 12], clamp(s.mono * 1.4, 0, 1));
      ctx.fillRect(mx, my, mw, mh);
      const pr = mw * 0.32, py = horizon - pr * 1.15;
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.4);
      const rg = ctx.createRadialGradient(W / 2, py, 0, W / 2, py, pr * 5 * s.glow + 1);
      rg.addColorStop(0, `rgba(255,236,200,${0.95 * s.glow * pulse})`);
      rg.addColorStop(0.25, `rgba(255,170,90,${0.45 * s.glow})`);
      rg.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255,246,225,${clamp(s.glow, 0, 1)})`;
      ctx.beginPath(); ctx.arc(W / 2, py, pr, 0, Math.PI * 2); ctx.fill();
    }

    // interior: warm cathedral columns + pedestal
    if (s.inside > 0.01) {
      ctx.save();
      ctx.globalAlpha = s.inside;
      const cols = 6;
      for (let i = 0; i < cols; i++) {
        const side = i < cols / 2 ? -1 : 1;
        const k = i % (cols / 2);
        const cw = W * (0.07 - k * 0.015), ch = H * (1 - k * 0.12);
        let cx = W / 2 + side * (W * (0.46 - k * 0.12)) - cw / 2;
        let cy = H - ch;
        if (s.crumble > 0.01) {
          cy -= s.crumble * H * (0.15 + k * 0.1) * (1 + 0.2 * Math.sin(t + i));
          cx += side * s.crumble * 30;
        }
        const cg = ctx.createLinearGradient(cx, 0, cx + cw, 0);
        cg.addColorStop(0, 'rgba(70,40,25,.95)'); cg.addColorStop(0.5, 'rgba(160,110,70,.95)'); cg.addColorStop(1, 'rgba(60,35,22,.95)');
        ctx.fillStyle = cg; ctx.fillRect(cx, cy, cw, ch);
      }
      // pedestal
      const pw = Math.min(W * 0.5, 520), ph = H * 0.06, px = W / 2 - pw / 2, py = H * 0.8;
      ctx.fillStyle = 'rgba(40,24,16,.95)'; ctx.fillRect(px, py, pw, ph);
      ctx.fillRect(W / 2 - pw * 0.2, py + ph, pw * 0.4, H - py - ph);
      const lg = ctx.createRadialGradient(W / 2, py, 0, W / 2, py, pw);
      lg.addColorStop(0, `rgba(255,230,180,${0.5 + 0.2 * Math.sin(t * 2)})`); lg.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // debris during crumble
    if (s.crumble > 0.01) {
      ctx.fillStyle = `rgba(40,10,8,${0.85 * s.crumble})`;
      debris.forEach((d) => {
        const y = (d.y - ((t * 0.03 * d.v) % 1.4) * s.crumble) * H;
        ctx.save(); ctx.translate(d.x * W, y); ctx.rotate(d.r + t * 0.2 * d.v);
        ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); ctx.restore();
      });
    }

    // beam of light in the chosen flavor
    if (s.beam > 0.01) {
      const bw = Math.min(W * 0.28, 300);
      const bg = ctx.createLinearGradient(W / 2 - bw / 2, 0, W / 2 + bw / 2, 0);
      bg.addColorStop(0, rgb(drink, 0)); bg.addColorStop(0.5, rgb(mix(drink, [255, 255, 255], 0.5), 0.85 * s.beam)); bg.addColorStop(1, rgb(drink, 0));
      ctx.fillStyle = bg; ctx.fillRect(W / 2 - bw / 2, 0, bw, H);
      ctx.strokeStyle = rgb(drink, 0.7 * s.beam); ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let y = 0; y <= H; y += 12) {
          const x = W / 2 + Math.sin(y * 0.012 + t * 2 + k * 2.1) * bw * 0.35;
          y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // the saint
    const robe = s.inside > 0.5 && f > order.length - 4 ? rgb(mix(drink, [30, 30, 30], 0.35)) : 'rgba(18,16,16,.95)';
    const floatY = s.beam > 0.2 ? -Math.sin(t * 1.5) * 20 * s.beam - 60 * s.beam : 0;
    drawFigure(W / 2, (s.inside > 0.5 ? H * 0.8 : horizon) + floatY, s.fig, robe);

    // mist
    if (s.fog > 0.01) {
      motes.forEach((m) => {
        const x = ((m.x + t * 0.008 * m.s) % 1.2 - 0.1) * W;
        const y = (0.45 + m.y * 0.6) * H;
        const mg = ctx.createRadialGradient(x, y, 0, x, y, m.r * 2.4);
        mg.addColorStop(0, `rgba(220,215,208,${0.09 * s.fog})`); mg.addColorStop(1, 'rgba(220,215,208,0)');
        ctx.fillStyle = mg; ctx.fillRect(x - m.r * 2.4, y - m.r * 2.4, m.r * 4.8, m.r * 4.8);
      });
    }

    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

    if (!reduceMotion || frame.first) requestAnimationFrame(frame);
  }
  frame.first = true;
  requestAnimationFrame((t) => { frame(t); frame.first = false; });
  if (reduceMotion) window.addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true });

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
  runLoader();
})();
