# balright — Santioni Spirits remake

A static, dependency-free remake of [santionispirits.com](https://santionispirits.com):
the scroll-told pilgrimage of the saint, the Notturno Collection, the product carousel,
the taste and pour rituals, retailers, footer, age gate, cookie notice and loader.

## Run

```bash
npm start
```

Then open http://localhost:8080.

## Report

```bash
npm run report
```

The report needs Playwright (`require('playwright')`). It serves the site locally and checks it against a
reference spec taken from the original site: copy (including all 16 voice-over beats), structure, meta,
the original fluid type scale and colours (red #C82924, ink #121212, paper), interactions (age gate, bottle choice, carousel, nav,
cookies, audio), responsiveness at 390/768/1440px, console errors and font loading. It writes
`report/REPORT.md` plus screenshots, and prints `REMAKE COMPLETE` when every check passes.

## Differences from the original

- The original is a cel-shaded WebGL comic. Here every scene is an original inline-SVG drawing in
  the same palette (ink, paper, tan robe, portal maroon, cathedral red), set in tilted ink-framed
  panels on paper with boxed captions, with scroll parallax and reveal motion instead of 3D cameras.
- The original's fonts (Charles Rosie, PP Nikkei Maru, GT Era) are commercial, so this remake uses
  self-hosted OFL stand-ins (Limelight, Archivo Black, Figtree). Licences are in `assets/fonts/`.
- The logo, emblem, figures, bottles and glass are original SVG drawings, not the brand's assets or models.
- Ambient audio is synthesised with Web Audio rather than the original voice-over.
- The footer credits the original site's makers as "Original experience by Active Theory and Plan8".
