# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server with HMR
npm run build     # production build
npm run preview   # preview production build locally
npm run lint      # run ESLint
```

No test runner is configured.

## Architecture

This is a minimal React 19 + Vite 8 single-page app. All application code lives in `src/`:

- `main.jsx` — mounts `<App />` into `#root`
- `App.jsx` — single top-level component; this is where feature development begins
- `App.css` / `index.css` — component and global styles respectively

Static assets served from `public/` (e.g. `icons.svg`) are referenced via root-relative paths in JSX. Images imported directly in JSX (e.g. `hero.png`, `react.svg`) are bundled by Vite.
