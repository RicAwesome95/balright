/* Santioni Spirits — remake. Vanilla JS, no dependencies. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const body = document.body;
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // the story always starts at the beginning, like the original
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);

  /* ---------------- flavors ---------------- */
  const FLAVORS = {
    1: { name: 'orange', color: '#63C4F4', copy: 'The saint drinks, and in an instant, a beam of light engulfs him, swirling with orange, chocolate, and cream, an ethereal trail that lifts him beyond the senses.' },
    2: { name: 'mint', color: '#97F3AD', copy: 'The saint drinks, and in an instant, a beam of light engulfs him, swirling with mint, chocolate, and cream, an ethereal trail that lifts him beyond the senses.' },
    3: { name: 'marshmallow', color: '#FBEB7F', copy: 'The saint drinks, and in an instant, a beam of light engulfs him, swirling with marshmallow, coffee, and cream, an ethereal trail that lifts him beyond the senses.' }
  };
  let selectedBottle = 2;

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

  function splitWords(p) {
    const words = p.textContent.trim().split(/\s+/);
    p.textContent = '';
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.style.setProperty('--i', String(i));
      span.textContent = w;
      p.append(span, ' ');
    });
  }

  /* ---------------- bottle choice ---------------- */
  function selectBottle(n) {
    selectedBottle = n;
    const f = FLAVORS[n];
    document.documentElement.style.setProperty('--drink', f.color);
    $$('.bottle-pick').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.bottle === n)));
    const copy = $('#drink-copy');
    if (copy) { copy.textContent = f.copy; if (copy.dataset.split) splitWords(copy); }
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

  /* ---------------- loader ---------------- */
  const loader = $('#loader');
  function setProgress(p) { loader.style.setProperty('--loader-per', String(clamp(p, 0, 1))); }
  async function runLoader() {
    let p = 0;
    const tick = setInterval(() => { p = Math.min(0.9, p + 0.06); setProgress(p); }, 90);
    const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    const minTime = new Promise((r) => setTimeout(r, reduceMotion ? 200 : 2200));
    const maxTime = new Promise((r) => setTimeout(r, 5000));
    await Promise.race([Promise.all([fontsReady, minTime]), maxTime]);
    clearInterval(tick);
    setProgress(1);
    await new Promise((r) => setTimeout(r, 350));
    body.classList.remove('is-loading');
    if (!location.hash) window.scrollTo(0, 0);
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

  /* ---------------- comic panels: clip each drawing to its tilted frame and ink the border ---------------- */
  $$('svg[data-quad]').forEach((svg, i) => {
    const id = `panel-quad-${i}`;
    const defs = document.createElementNS(NS, 'defs');
    const clip = document.createElementNS(NS, 'clipPath');
    const poly = document.createElementNS(NS, 'polygon');
    clip.id = id;
    poly.setAttribute('points', svg.dataset.quad);
    clip.appendChild(poly);
    defs.appendChild(clip);
    const art = document.createElementNS(NS, 'g');
    art.setAttribute('clip-path', `url(#${id})`);
    while (svg.firstChild) art.appendChild(svg.firstChild);
    const frame = poly.cloneNode();
    frame.setAttribute('fill', 'none');
    frame.setAttribute('stroke', '#121212');
    frame.setAttribute('stroke-width', '8');
    frame.setAttribute('stroke-linejoin', 'round');
    frame.setAttribute('filter', 'url(#f-rough)');
    svg.append(defs, art, frame);
    // layers deeper in the drawing move further with the mouse, like the original's depth
    const layers = Array.from(art.children);
    layers.forEach((layer, k) => {
      if (k === 0) { layer.setAttribute('data-bg', ''); return; }
      layer.setAttribute('data-depth', '');
      layer.style.setProperty('--d', String(Math.round(6 + (k / Math.max(1, layers.length - 1)) * 26)));
    });
  });

  /* ---------------- captions: pop in, words appear one by one ---------------- */
  $$('.narration').forEach((p) => { splitWords(p); p.dataset.split = '1'; });
  $$('.slide-in[data-from]').forEach((el) => el.style.setProperty('--from', el.dataset.from));

  /* ---------------- reveals ---------------- */
  const chapters = $$('.chapter');
  const reveal = (targets, cls, opts) => {
    if (!('IntersectionObserver' in window)) { targets.forEach((t) => t.classList.add(cls)); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add(cls); io.unobserve(e.target); }
    }), opts);
    targets.forEach((t) => io.observe(t));
  };
  reveal(chapters, 'in-view', { threshold: 0.12, rootMargin: '0px 0px -12% 0px' });
  reveal($$('.panel'), 'in', { threshold: 0.12 });
  reveal($$('.slide-in'), 'in-view', { threshold: 0.4 });

  /* ---------------- nav ---------------- */
  const navLinks = $$('.header__link');
  const taste = $('#taste');
  function updateNav() {
    const key = taste.getBoundingClientRect().top < window.innerHeight * 0.5 ? 'collection' : 'experience';
    navLinks.forEach((l) => l.classList.toggle('active', l.dataset.nav === key));
  }

  /* ---------------- products carousel ---------------- */
  const slides = $$('.slide');
  const dots = $$('.dots [data-go]');
  const labels = ['Orange<br>Chocolate<br>&amp; Cream', 'Mint<br>Chocolate<br>&amp; Cream', 'Marshmallow<br>Coffee<br>&amp; Cream'];
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
    $('[data-prev-label]').innerHTML = labels[(current + 2) % 3];
    $('[data-next-label]').innerHTML = labels[(current + 1) % 3];
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

  /* ---------------- motion loop: smooth scroll, mouse depth, 3D panels, holds, cursor badge ---------------- */
  const root = document.documentElement;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const parallax = $$('[data-speed]').map((el) => ({ el, speed: parseFloat(el.dataset.speed) || 0, anchor: el.closest('.chapter') || el.parentElement }));
  const panels = $$('.panel').map((el) => ({ el, rx: 0, ry: 0, lift: 0, px: 0, py: 0 }));
  const crumbleTitle = $('[data-scene="crumble"] .title-one');
  const bleeds = $$('.bleed');
  const collection = $('#collection');
  const poster = $('.collection-ui__text-quad');
  const rail = $('.ScrollRail');
  const logo = $('.SiteLogo');
  const badge = $('.CursorBadge');
  const badgeLabel = $('.label', badge);

  // smooth (inertia) scrolling for wheels; keyboard, scrollbar and touch stay native
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  let scrollTarget = window.scrollY, scrollCur = window.scrollY, smoothing = false;
  const smoothOK = !reduceMotion;
  if (smoothOK) {
    window.addEventListener('wheel', (e) => {
      if (body.classList.contains('is-gated') || body.classList.contains('is-loading') || e.ctrlKey) return;
      e.preventDefault();
      if (!smoothing) scrollCur = scrollTarget = window.scrollY;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
      scrollTarget = clamp(scrollTarget + e.deltaY * unit, 0, maxScroll());
      smoothing = true;
    }, { passive: false });
  }
  function scrollToY(y) {
    if (!smoothOK) { window.scrollTo(0, y); return; }
    if (!smoothing) scrollCur = window.scrollY;
    scrollTarget = clamp(y, 0, maxScroll());
    smoothing = true;
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id.length > 1 ? $(id) : null;
    if (!el) return;
    e.preventDefault();
    scrollToY(id === '#top' ? 0 : el.getBoundingClientRect().top + window.scrollY);
    if (a.classList.contains('skip-link')) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
  }));

  // pointer
  let mxT = 0, myT = 0, mx = 0, my = 0, ptrX = -200, ptrY = -200, bx = -200, by = -200, bs = 0;
  let hoverPanel = null, cursorText = '', pressed = false;
  const lookUnder = (el) => {
    hoverPanel = el && el.closest ? el.closest('.panel') : null;
    const c = el && el.closest ? el.closest('[data-cursor]') : null;
    cursorText = c ? c.dataset.cursor : '';
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    ptrX = e.clientX; ptrY = e.clientY;
    mxT = (e.clientX / window.innerWidth) * 2 - 1;
    myT = (e.clientY / window.innerHeight) * 2 - 1;
    if (!pressed) lookUnder(e.target);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { hoverPanel = null; cursorText = ''; });
  window.addEventListener('scroll', () => {
    if (!smoothing) scrollCur = scrollTarget = window.scrollY;
    // what sits under a still mouse changes as the page moves
    if (!pressed && ptrX > 0) lookUnder(document.elementFromPoint(ptrX, ptrY));
  }, { passive: true });

  // press-and-hold scenes: the hand reaches, the bottle pours, the beam lifts
  const holds = $$('[data-hold]').map((el) => ({ el, kind: el.dataset.hold, on: false, v: 0, hx: 0, hy: 0 }));
  let pourFill = 0;
  holds.forEach((h) => {
    const stop = () => { h.on = false; pressed = false; };
    h.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      h.on = true; pressed = true;
      try { h.el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    });
    h.el.addEventListener('pointerup', stop);
    h.el.addEventListener('pointercancel', stop);
    h.el.addEventListener('lostpointercapture', stop);
    h.el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); h.on = true; } });
    h.el.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') h.on = false; });
  });
  const armHold = holds.find((h) => h.kind === 'hand');
  const arm = $('.arm');

  // logo and audio bars switch to ink over paper, white over night and red
  const onLight = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const sec = el && el.closest('.chapter, section, footer');
    if (sec && sec.matches('.chapter--title')) return y > sec.getBoundingClientRect().bottom - window.innerHeight * 0.28;
    return !!sec && (sec.matches('.page:not(.bleed)') || sec.id === 'retail');
  };
  const ease = (base, dt) => 1 - Math.pow(base, dt);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const H = window.innerHeight;

    if (smoothing) {
      scrollCur = lerp(scrollCur, scrollTarget, ease(0.0009, dt));
      if (Math.abs(scrollTarget - scrollCur) < 0.5) { scrollCur = scrollTarget; smoothing = false; }
      window.scrollTo(0, scrollCur);
    }

    if (!reduceMotion) {
      mx = lerp(mx, finePointer ? mxT : 0, ease(0.002, dt));
      my = lerp(my, finePointer ? myT : 0, ease(0.002, dt));
      root.style.setProperty('--mx', mx.toFixed(3));
      root.style.setProperty('--my', my.toFixed(3));

      parallax.forEach(({ el, speed, anchor }) => {
        const r = anchor.getBoundingClientRect();
        if (r.bottom < -H || r.top > 2 * H) return;
        el.style.setProperty('--py', `${(-(r.top + r.height / 2 - H / 2) * speed).toFixed(1)}px`);
      });

      // panels are cards in perspective: tilted back as they come up, flat mid-screen,
      // tilted forward as they leave; they lean toward the mouse and lift when hovered
      const kp = ease(0.0005, dt);
      panels.forEach((p) => {
        const r = p.el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > H + 100) return;
        const prog = clamp((r.top + r.height / 2 - H / 2) / H, -1.2, 1.2);
        const hovered = finePointer && hoverPanel === p.el;
        const lx = hovered ? clamp(((ptrX - r.left) / r.width) * 2 - 1, -1, 1) : mx;
        const ly = hovered ? clamp(((ptrY - r.top) / r.height) * 2 - 1, -1, 1) : my;
        p.rx = lerp(p.rx, prog * 26 - ly * (hovered ? 10 : 6), kp);
        p.ry = lerp(p.ry, lx * (hovered ? 14 : 8), kp);
        p.lift = lerp(p.lift, hovered ? 1 : 0, kp);
        p.px = lerp(p.px, -lx, kp);
        p.py = lerp(p.py, -ly, kp);
        const st = p.el.style;
        st.setProperty('--rx', `${p.rx.toFixed(2)}deg`);
        st.setProperty('--ry', `${p.ry.toFixed(2)}deg`);
        // farther away above and below the middle of the screen, nearer when hovered
        st.setProperty('--pz', `${(p.lift * 70 - Math.abs(prog) * 260).toFixed(1)}px`);
        st.setProperty('--sp', prog.toFixed(3));
        st.setProperty('--lift', p.lift.toFixed(3));
        st.setProperty('--px', p.px.toFixed(3));
        st.setProperty('--pyy', p.py.toFixed(3));
      });

      // full-bleed scenes: their layers drift at different rates as they scroll through
      bleeds.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -H * 0.5 || r.top > H * 1.5) return;
        el.style.setProperty('--sp', clamp((r.top + r.height / 2 - H / 2) / H, -1.5, 1.5).toFixed(3));
      });

      if (crumbleTitle) {
        const r = crumbleTitle.parentElement.getBoundingClientRect();
        crumbleTitle.style.setProperty('--py', `${((r.top + r.height / 2 - H / 2) * 0.25).toFixed(1)}px`);
      }
      const c = collection.getBoundingClientRect();
      if (c.bottom > 0 && c.top < H) {
        const t = clamp((H - c.top) / (H + c.height), 0, 1);
        poster.style.setProperty('--tx', `${(lerp(14, -6, t) - my * 5).toFixed(2)}deg`);
        poster.style.setProperty('--ty', `${(lerp(-16, 10, t) + mx * 7).toFixed(2)}deg`);
      }
    }

    // holds
    holds.forEach((h) => {
      h.v = lerp(h.v, h.on ? 1 : 0, ease(h.on ? 0.02 : 0.001, dt));
      h.el.style.setProperty('--hold', h.v.toFixed(3));
      if (h.kind === 'pour') {
        if (h.on) pourFill = Math.min(1, pourFill + dt * 0.4);
        h.el.style.setProperty('--fill', pourFill.toFixed(3));
      }
    });
    if (armHold && arm) {
      const r = armHold.el.getBoundingClientRect();
      const tx = armHold.on ? clamp(ptrX - (r.left + r.width * 0.42), -500, 300) : 0;
      const ty = armHold.on ? clamp(ptrY - (r.top + r.height * 0.42), -300, 300) : 0;
      armHold.hx = lerp(armHold.hx, tx, ease(0.003, dt));
      armHold.hy = lerp(armHold.hy, ty, ease(0.003, dt));
      arm.style.setProperty('--hx', `${armHold.hx.toFixed(1)}px`);
      arm.style.setProperty('--hy', `${armHold.hy.toFixed(1)}px`);
    }

    // cursor badge trails the mouse and shows the prompt for what it is over
    if (finePointer) {
      bx = lerp(bx, ptrX, ease(0.00002, dt));
      by = lerp(by, ptrY, ease(0.00002, dt));
      const show = !!cursorText && !body.classList.contains('is-gated');
      if (show && badgeLabel.textContent !== cursorText) badgeLabel.textContent = cursorText;
      const active = holds.find((h) => h.el.dataset.cursor === cursorText);
      bs = lerp(bs, show ? (pressed ? 0.86 : 1) : 0, ease(0.0005, dt));
      badge.style.setProperty('--bs', bs.toFixed(3));
      badge.style.setProperty('--bx', `${bx.toFixed(1)}px`);
      badge.style.setProperty('--by', `${by.toFixed(1)}px`);
      badge.style.setProperty('--hold', active ? (active.kind === 'pour' ? pourFill : active.v).toFixed(3) : '0');
    }

    logo.classList.toggle('on-light', onLight(4, 44));
    audioBtn.classList.toggle('on-light', onLight(window.innerWidth - 90, H - 46));
    const max = maxScroll();
    rail.style.setProperty('--progress', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    updateNav();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  runLoader();
})();
