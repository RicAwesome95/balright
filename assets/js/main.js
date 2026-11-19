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

  /* ---------------- bottle choice ---------------- */
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
    frame.setAttribute('stroke-width', '7');
    frame.setAttribute('stroke-linejoin', 'round');
    svg.append(defs, art, frame);
  });
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

  /* ---------------- scroll-linked motion: parallax, poster tilt, rail ---------------- */
  const parallax = $$('[data-speed]').map((el) => ({ el, speed: parseFloat(el.dataset.speed) || 0, anchor: el.closest('.chapter') || el.parentElement }));
  const crumbleTitle = $('[data-scene="crumble"] .title-one');
  const collection = $('#collection');
  const poster = $('.collection-ui__text-quad');
  const rail = $('.ScrollRail');
  const logo = $('.SiteLogo');
  let ticking = false;

  function onScroll() {
    const H = window.innerHeight;
    if (!reduceMotion) {
      parallax.forEach(({ el, speed, anchor }) => {
        const r = anchor.getBoundingClientRect();
        if (r.bottom < -H || r.top > 2 * H) return;
        el.style.setProperty('--py', `${(-(r.top + r.height / 2 - H / 2) * speed).toFixed(1)}px`);
      });
      if (crumbleTitle) {
        const r = crumbleTitle.parentElement.getBoundingClientRect();
        crumbleTitle.style.setProperty('--py', `${((r.top + r.height / 2 - H / 2) * 0.25).toFixed(1)}px`);
      }
      const c = collection.getBoundingClientRect();
      const t = clamp((H - c.top) / (H + c.height), 0, 1);
      poster.style.setProperty('--tx', `${lerp(14, -6, t).toFixed(2)}deg`);
      poster.style.setProperty('--ty', `${lerp(-16, 10, t).toFixed(2)}deg`);
    }
    // logo and audio bars switch to ink over paper, white over night and red
    const onLight = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const sec = el && el.closest('.chapter, section, footer');
      if (sec && sec.matches('.chapter--title')) return y > sec.getBoundingClientRect().bottom - window.innerHeight * 0.28;
      return !!sec && (sec.matches('.page:not(.bleed)') || sec.id === 'retail');
    };
    logo.classList.toggle('on-light', onLight(4, 44));
    audioBtn.classList.toggle('on-light', onLight(window.innerWidth - 90, H - 46));
    const max = document.documentElement.scrollHeight - H;
    rail.style.setProperty('--progress', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    updateNav();
    ticking = false;
  }
  function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  onScroll();

  runLoader();
})();
