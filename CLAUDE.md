# Evolution! — 2D ecosystem & evolution simulation

- User-facing text is bilingual: **English and Spanish** (same convention as the sibling project `../PreyPredator2`). Every UI string lives in the `STRINGS` table (`t(key)` helper) in `index.html`; static HTML uses `data-i18n*` attributes. Any new user-facing text must be added to both languages. The choice is saved in `localStorage` (`evolution.lang`); the first visit follows the browser language.
- Structure: a single self-contained `index.html` (2D Canvas; only lil-gui is loaded from cdn.jsdelivr.net; no build step). Open it directly in a browser.
- All code comments and documentation in English. JSDoc on every function; closing-bracket comments on blocks longer than 10 lines.
- The simulation core lives between the `// === SIM CORE START ===` and `// === SIM CORE END ===` markers and has no DOM dependencies, so it can be extracted and run headlessly in Node for balance tuning (see `tools/headless.mjs`).
- Design notes (genome, trade-offs, visual encoding) are in `DESIGN.md`.
