#!/usr/bin/env node
/*
 * Remake report: verifies this repo's remake of santionispirits.com against a
 * reference spec extracted from the original site (copy, structure, design
 * tokens, interactions). Prints "REMAKE COMPLETE" only when every check passes.
 *
 * Usage: node scripts/remake-report.js [--out report]
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'report');

/* ---------- reference spec (taken from the original site's markup, CSS, copy deck and voice-over transcript) ---------- */
const SPEC = {
  title: 'Santioni Spirits | Cocktails to Indulge Now, Atone Later',
  description: 'Choose pleasure with Santioni Spirits: where intentional indulgence meets effortless enjoyment. Refined, ready-to-pour cocktails to help you savor the moment.',
  colors: { red: 'rgb(200, 41, 36)', ink: 'rgb(18, 18, 18)', paper: 'rgb(239, 238, 233)' },
  // fluid type scale from the original stylesheet, evaluated at 1440px wide
  typeAt1440: { '.RetailUI .heading3': 82, '.pour-heading-probe': null, '.heading2-probe': 159.2 },
  copy: [
    // age gate
    'Are you of', 'legal age?', 'Yes', 'No', 'Access', 'Denied', 'You need to be of legal age to access.',
    // nav
    'Experience', 'Collection',
    // voice-over narrative (16 beats)
    'In an immense land of nothingness, a lonely figure wanders through the mist.',
    'Distant whispers alert the traveler',
    'The saint finally catches a glimpse of what he was seeking since he went on his pilgrimage.',
    'At the sight of it, he stands taller, gaze fixated, and determination burning within.',
    'An ominous structure stands before the saint.',
    'A vivid light shines through the circular portal at the base of the great monolith.',
    "There's no time. He must see it through the end.",
    'As he approaches the portal, the holy sound grows stronger, shaking him to the core. Light begins to pulsate, inviting him closer.',
    'A strong wind begins to blow, playful and expectant. Now standing before the portal, he raises a hand.',
    'Hesitantly his hand draws forward',
    'Taking a deep breath, he steps in.',
    'He awakens in an exalted room lit by a warm light.',
    'In front of him, a large pedestal pulsates with light',
    'Three Santioni Spirits bottles glint on the table, vibrating with a tantalizing shimmer.',
    'inviting him to indulge',
    'a beam of light engulfs him, swirling with mint, chocolate, and cream',
    'The saint gently floats back to the floor, one foot after the other.',
    'The columns and roof begin to break apart and lift away, revealing a deep red sky.',
    // taste + collection poster
    'Indulge now', 'Atone later', 'Santioni', 'Spirits', 'Notturno Collection',
    // products
    'Orange Chocolate & Cream', 'Mint Chocolate & Cream', 'Marshmallow Coffee & Cream',
    // taste
    'The Notturno Collection is an ode to the night', 'A taste of possibility', 'Inspired by the quiet glamour of the late hours',
    'True devotion requires a little indulgence. Santioni Spirits is crafted for the saints and the sinners alike. The Notturno Collection blends heavenly cream and earthly decadence to unwind your soul and elevate your evenings.',
    // pour ritual
    'The night starts after dinner', 'Chill your spirit', 'Shake your spirit', 'Let the night play on', 'Pour your spirit', 'What happens next is up to you',
    // retail
    'Select Houses Forthcoming',
    // footer
    'Instagram', 'indulge@santionispirits.com', 'Active Theory', 'Plan8', 'Legal',
    // cookie banner
    'This website uses cookies to improve your experience and for analytics and marketing purposes.', 'Privacy Policy', 'Accept', 'Decline'
  ],
  links: {
    instagram: 'https://www.instagram.com/santionispirits',
    email: 'mailto:indulge@santionispirits.com',
    privacy: 'https://cdn.sanity.io/files/nhqx6ogi/production/d2513cb86f7baedec1e90571f62be07acd158d56.pdf'
  },
  sections: ['#loader', '#age-gate', '.HeaderMenu', '#experience', '.DrinkSelectionUI', '#collection', '#products', '#taste', '#pour', '#retail', '#footer', '#cookie-banner'],
  narrationBeats: 16,
  flavors: {
    orange: 'swirling with orange, chocolate, and cream',
    marshmallow: 'swirling with marshmallow, coffee, and cream'
  },
  widths: [390, 768, 1440]
};

/* ---------- tiny static server ---------- */
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, path.normalize(p));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const norm = (s) => s.replace(/\s+/g, ' ').replace(/[’]/g, "'").trim().toLowerCase();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const results = [];
  const check = (group, name, ok, detail = '') => results.push({ group, name, ok: !!ok, detail });

  /* ---- desktop pass ---- */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failed = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('requestfailed', (r) => { if (r.url().startsWith(base)) failed.push(r.url()); });
  page.on('response', (r) => { if (r.url().startsWith(base) && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

  await page.goto(base, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(OUT, '01-loader.png') });

  // meta
  check('Meta', 'Title matches original', (await page.title()) === SPEC.title, await page.title());
  const desc = await page.getAttribute('meta[name="description"]', 'content');
  check('Meta', 'Description matches original', desc === SPEC.description);

  // structure
  for (const sel of SPEC.sections) check('Structure', `Section present: ${sel}`, await page.$(sel));
  const beats = await page.$$eval('#experience .narration', (n) => n.length);
  check('Structure', `All ${SPEC.narrationBeats} narrative beats present`, beats === SPEC.narrationBeats, `${beats} found`);
  check('Structure', 'Three bottles to choose from', (await page.$$('.bottle-pick')).length === 3);
  check('Structure', 'Three product slides', (await page.$$('.slide')).length === 3);

  // copy fidelity (DOM text, including hidden states)
  const allText = norm(await page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('br').forEach((b) => b.replaceWith(' '));
    clone.querySelectorAll('script,style').forEach((s) => s.remove());
    return clone.textContent;
  }));
  const missing = SPEC.copy.filter((c) => !allText.includes(norm(c)));
  check('Copy', `All ${SPEC.copy.length} reference copy strings present`, missing.length === 0, missing.length ? `missing: ${missing.join(' | ')}` : '');

  // links
  check('Links', 'Instagram link', await page.$(`a[href="${SPEC.links.instagram}"]`));
  check('Links', 'Email link', await page.$(`a[href="${SPEC.links.email}"]`));
  check('Links', 'Privacy policy link', await page.$(`a[href^="${SPEC.links.privacy}"]`));

  // loader -> age gate
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 8000 }).catch(() => {});
  check('Flow', 'Loader completes', !(await page.evaluate(() => document.body.classList.contains('is-loading'))));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '02-age-gate.png') });
  check('Flow', 'Age gate shown after loader', await page.isVisible('#age-gate .intro'));

  // fonts
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return ['Limelight', 'Archivo Black', 'Figtree'].map((f) => document.fonts.check(`16px "${f}"`));
  });
  check('Design', 'Display, bold and text fonts load', fonts.every(Boolean), JSON.stringify(fonts));

  // design tokens
  const ageHeading = await page.$eval('#age-gate .heading2', (e) => parseFloat(getComputedStyle(e).fontSize));
  check('Design', 'heading2 follows original fluid scale (159.2px @1440)', Math.abs(ageHeading - 159.2) < 1, `${ageHeading}px`);
  // original: font-size:max(30px,min(16cqw,82px)) inside the .stack container
  const retail = await page.$eval('#retail .heading3', (e) => ({ fs: parseFloat(getComputedStyle(e).fontSize), cw: e.closest('.stack').clientWidth }));
  const retailExpected = Math.max(30, Math.min(0.16 * retail.cw, 82));
  check('Design', 'Retail heading3 follows original container-query scale', Math.abs(retail.fs - retailExpected) < 1, `${retail.fs}px vs ${retailExpected.toFixed(1)}px`);
  const bodyBold = await page.$eval('.RetailUI .header-row-left', (e) => parseFloat(getComputedStyle(e).fontSize));
  check('Design', 'body-bold 15px at desktop', Math.abs(bodyBold - 15) < 0.5, `${bodyBold}px`);
  const footerBg = await page.$eval('#footer', (e) => getComputedStyle(e).backgroundColor);
  check('Design', 'Ink #121212 footer', footerBg === SPEC.colors.ink, footerBg);
  const posterColor = await page.$eval('.poster-head', (e) => getComputedStyle(e).color);
  check('Design', 'Collection poster header in brand red', posterColor === SPEC.colors.red, posterColor);
  const redBg = await page.$eval('#products', (e) => getComputedStyle(e).backgroundColor);
  check('Design', 'Products on brand red', redBg === SPEC.colors.red, redBg);
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('Design', 'Paper page background behind the comic panels', bodyBg === SPEC.colors.paper, bodyBg);

  // age gate: No -> denied (separate context so state stays clean)
  {
    const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p2.goto(base);
    await p2.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 8000 });
    await p2.click('[data-age="no"]');
    check('Interaction', 'Age gate "No" shows ACCESS DENIED', await p2.isVisible('#age-gate .denied'));
    check('Interaction', 'Site stays locked after "No"', await p2.evaluate(() => document.body.classList.contains('is-gated')));
    await p2.screenshot({ path: path.join(OUT, '03-denied.png') });
    await p2.close();
  }

  // age gate: Yes
  await page.click('[data-age="yes"]');
  await page.waitForTimeout(1000);
  check('Interaction', 'Age gate "Yes" unlocks the site', !(await page.evaluate(() => document.body.classList.contains('is-gated'))));
  check('Interaction', 'Cookie banner appears after entry', await page.isVisible('#cookie-banner'));
  await page.screenshot({ path: path.join(OUT, '04-experience.png') });
  await page.click('[data-cookie="accept"]');
  check('Interaction', 'Cookie "Accept" dismisses banner', !(await page.isVisible('#cookie-banner')));

  // comic panels get their tilted, inked frames
  const framed = await page.$$eval('svg[data-quad] > g[clip-path]', (n) => n.length);
  check('Design', 'Story panels are clipped and inked', framed >= 10, `${framed} framed panels`);

  // scroll to selection, choose orange
  await page.$eval('.chapter--select', (e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, '05-selection.png') });
  await page.click('.bottle-pick[data-bottle="1"]');
  const orangeCopy = norm(await page.textContent('#drink-copy'));
  check('Interaction', 'Choosing Orange rewrites the beam narration', orangeCopy.includes(norm(SPEC.flavors.orange)));
  await page.click('.bottle-pick[data-bottle="3"]');
  check('Interaction', 'Choosing Marshmallow rewrites the beam narration', norm(await page.textContent('#drink-copy')).includes(norm(SPEC.flavors.marshmallow)));
  await page.$eval('[data-scene="beam"]', (e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, '06-beam.png') });
  await page.$eval('[data-scene="crumble"]', (e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, '07-crumble.png') });

  // nav
  await page.click('.header__link[data-nav="collection"]');
  await page.waitForTimeout(1500);
  check('Interaction', 'Header "Collection" jumps to collection & becomes active', await page.$eval('.header__link[data-nav="collection"]', (e) => e.classList.contains('active')));
  await page.screenshot({ path: path.join(OUT, '08-collection.png') });

  // products carousel
  await page.$eval('#products', (e) => e.scrollIntoView());
  await page.waitForTimeout(600);
  const before = await page.$eval('.slide.is-active', (e) => e.dataset.index);
  await page.click('#products .right-text');
  await page.waitForTimeout(900);
  const after = await page.$eval('.slide.is-active', (e) => e.dataset.index);
  check('Interaction', 'Product carousel advances', before !== after, `${before} -> ${after}`);
  await page.screenshot({ path: path.join(OUT, '09-products.png') });
  await page.keyboard.press('ArrowLeft');

  for (const [sel, name] of [['#taste', '10-taste'], ['#pour', '11-pour'], ['#retail', '12-retail'], ['#footer', '13-footer']]) {
    await page.$eval(sel, (e) => e.scrollIntoView());
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  }

  // audio toggle
  await page.click('.AudioToggle');
  check('Interaction', 'Audio toggle switches on', (await page.getAttribute('.AudioToggle', 'aria-pressed')) === 'true');

  // returning visitor skips gate
  {
    const p3 = await ctx.newPage();
    await p3.goto(base);
    await p3.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 8000 });
    check('Interaction', 'Returning visitor skips age gate', !(await p3.evaluate(() => document.body.classList.contains('is-gated'))));
    await p3.close();
  }

  check('Quality', 'No console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('Quality', 'No failed local requests', failed.length === 0, failed.join(' | '));
  await ctx.close();

  /* ---- responsive pass ---- */
  for (const w of SPEC.widths) {
    const p = await browser.newPage({ viewport: { width: w, height: w < 500 ? 844 : 1000 } });
    await p.addInitScript(() => { try { localStorage.setItem('santioni-age', 'yes'); localStorage.setItem('santioni-cookies', 'accept'); } catch (e) {} });
    await p.goto(base);
    await p.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 8000 });
    await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
    await p.waitForTimeout(1600);
    const overflow = await p.evaluate(() => {
      const offenders = [];
      document.querySelectorAll('main *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > window.innerWidth + 1 || r.left < -1) && getComputedStyle(el).visibility !== 'hidden') {
          let hidden = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'hidden' || o === 'clip') { const ar = a.getBoundingClientRect(); if (ar.right <= window.innerWidth + 1) { hidden = true; break; } } }
          if (!hidden) offenders.push(el.className || el.tagName);
        }
      });
      return { scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth, offenders: offenders.slice(0, 5) };
    });
    check('Responsive', `No horizontal overflow at ${w}px`, overflow.scroll <= 0 && overflow.offenders.length === 0, JSON.stringify(overflow));
    await p.screenshot({ path: path.join(OUT, `r-${w}-top.png`) });
    for (const sel of ['#collection', '#products', '#taste', '#footer']) {
      await p.$eval(sel, (e) => e.scrollIntoView());
      await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(OUT, `r-${w}-${sel.slice(1)}.png`) });
    }
    await p.close();
  }

  await browser.close();
  srv.close();

  /* ---- write report ---- */
  const passed = results.filter((r) => r.ok).length;
  const complete = passed === results.length;
  const groups = [...new Set(results.map((r) => r.group))];
  let md = `# Santioni Spirits remake report\n\nReference: https://santionispirits.com\n\n**${passed}/${results.length} checks passed**\n\n`;
  for (const g of groups) {
    md += `## ${g}\n\n`;
    for (const r of results.filter((x) => x.group === g)) md += `- ${r.ok ? 'PASS' : 'FAIL'} — ${r.name}${r.detail && !r.ok ? ` _(${r.detail})_` : ''}\n`;
    md += '\n';
  }
  md += `Screenshots are in \`${path.relative(ROOT, OUT)}/\`.\n\n**${complete ? 'REMAKE COMPLETE' : 'REMAKE INCOMPLETE'}**\n`;
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.group}] ${r.name}${r.ok ? '' : `  -> ${r.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log(complete ? 'REMAKE COMPLETE' : 'REMAKE INCOMPLETE');
  process.exit(complete ? 0 : 1);
})().catch((e) => { console.error(e); console.log('REMAKE INCOMPLETE'); process.exit(1); });
