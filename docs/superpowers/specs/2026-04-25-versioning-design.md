# Versioning Design

**Date:** 2026-04-25

## Overview

Add a single-source-of-truth version to the app that is displayed in the UI and used to tag Docker images.

## Goals

- Version visible in the lower-left corner of the UI
- Docker images tagged with the version automatically on `docker compose up --build`
- Single source of truth: `package.json` `version` field
- Bump workflow: `npm version patch/minor/major`

## Version Storage & Sync

`package.json` is the authoritative source. A `version` lifecycle script keeps `.env` in sync:

```json
"version": "node -e \"require('fs').writeFileSync('.env','APP_VERSION='+process.env.npm_package_version+'\\n')\" && git add .env"
```

When `npm version patch` runs, npm:
1. Bumps `package.json`
2. Runs the `version` script — writes `APP_VERSION=x.y.z` to `.env` and stages it
3. Creates a single git commit containing `package.json`, `package-lock.json`, and `.env`
4. Creates a git tag `vx.y.z`

`.env` is removed from `.gitignore` so it is tracked. `.env.local` is added as the gitignored file for secrets.

## UI Display

`vite.config.js` reads the version from `package.json` at build time and injects it via `define`:

```js
import { readFileSync } from 'fs'
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
})
```

`App.tsx` renders a fixed badge outside the main layout:

```tsx
declare const __APP_VERSION__: string

<span className="app-version">v{__APP_VERSION__}</span>
```

`App.css` styles it as fixed, lower-left, small, and muted:

```css
.app-version {
  position: fixed;
  bottom: 12px;
  left: 12px;
  font-size: 11px;
  color: var(--text);
  opacity: 0.5;
}
```

## Docker Image Tagging

`docker-compose.yml` adds an `image:` field to the `app` service:

```yaml
app:
  build: .
  image: aitodo:${APP_VERSION:-latest}
```

Docker Compose reads `APP_VERSION` from `.env` automatically. The `:-latest` fallback handles missing `.env`.

## Workflow

```bash
npm version patch           # bumps version, writes .env, commits, tags
docker compose up --build   # builds image tagged aitodo:x.y.z, starts containers
```

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `version` lifecycle script; bump version to `0.1.0` |
| `.gitignore` | Remove `.env`; add `.env.local` |
| `.env` | New file: `APP_VERSION=0.1.0` |
| `vite.config.js` | Add `define` with `__APP_VERSION__` |
| `src/App.tsx` | Add `<span className="app-version">` |
| `src/App.css` | Add `.app-version` styles |
| `docker-compose.yml` | Add `image: aitodo:${APP_VERSION:-latest}` to `app` service |
