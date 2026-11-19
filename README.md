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
the original fluid type scale and brand colours, interactions (age gate, bottle choice, carousel, nav,
cookies, audio), responsiveness at 390/768/1440px, console errors and font loading. It writes
`report/REPORT.md` plus screenshots, and prints `REMAKE COMPLETE` when every check passes.

## Differences from the original

- The original is a WebGL experience. Here the 3D scenes are a scroll-driven 2D canvas: mist,
  the monolith and portal, the cathedral, the flavour-coloured beam of light and the crumbling red sky.
- The original's fonts (Charles Rosie, PP Nikkei Maru, GT Era) are commercial, so this remake uses
  self-hosted OFL stand-ins (Limelight, Archivo Black, Figtree). Licences are in `assets/fonts/`.
- The logo, emblem and bottle art are original SVG drawings, not the brand's assets.
- Ambient audio is synthesised with Web Audio rather than the original voice-over.
- The footer credits the original site's makers as "Original experience by Active Theory and Plan8".
