# Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a version number (sourced from `package.json`) that displays in the lower-left corner of the UI and tags Docker images on `docker compose up --build`.

**Architecture:** `package.json` is the single source of truth. A `version` lifecycle script keeps `.env` in sync (for Docker Compose) and Vite injects the version into the React bundle at build time via `define`. No runtime API calls or environment variables are needed at runtime.

**Tech Stack:** Vite 8 (define), React 19, Docker Compose, npm lifecycle scripts

---

## File Map

| File | Action | Change |
|------|--------|--------|
| `package.json` | Modify | Bump version to `0.1.0`; add `version` lifecycle script |
| `.gitignore` | Modify | Remove `.env`; add `.env.local` |
| `.env` | Create | `APP_VERSION=0.1.0` |
| `vite.config.js` | Modify | Add `define: { __APP_VERSION__ }` |
| `src/vite-env.d.ts` | Modify | Declare `__APP_VERSION__` global |
| `src/App.tsx` | Modify | Add `<span className="app-version">` badge |
| `src/App.css` | Modify | Add `.app-version` fixed-position styles |
| `docker-compose.yml` | Modify | Add `image: aitodo:${APP_VERSION:-latest}` to `app` service |

---

### Task 1: Version source of truth

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env`

- [ ] **Step 1: Bump version and add lifecycle script in `package.json`**

Replace the `version` field and add the `version` script. The full scripts block becomes:

```json
{
  "name": "aitodo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"tsx server.ts\" \"vite\"",
    "server": "tsx server.ts",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "version": "node -e \"require('fs').writeFileSync('.env','APP_VERSION='+process.env.npm_package_version+'\\n')\" && git add .env"
  }
}
```

- [ ] **Step 2: Update `.gitignore`**

Find the `.env` line and replace it with `.env.local`:

```
# before
.env

# after
.env.local
```

- [ ] **Step 3: Create `.env` in the project root**

Contents:

```
APP_VERSION=0.1.0
```

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore .env
git commit -m "feat: add version source of truth and npm version hook"
```

---

### Task 2: Inject version into Vite build

**Files:**
- Modify: `vite.config.js`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Update `vite.config.js`**

Replace the entire file:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

- [ ] **Step 2: Declare the global in `src/vite-env.d.ts`**

Replace the entire file:

```ts
/// <reference types="vite/client" />

declare const __APP_VERSION__: string
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.js src/vite-env.d.ts
git commit -m "feat: inject app version into Vite bundle"
```

---

### Task 3: Display version in UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add version badge to `App.tsx`**

In the return statement, add the badge as the last child inside the root `<div className="app-layout">`, after the closing `</main>` tag:

```tsx
  return (
    <div className="app-layout">
      <CalendarPanel ... />
      <main className="main-panel">
        ...
      </main>
      <span className="app-version">v{__APP_VERSION__}</span>
    </div>
  )
```

- [ ] **Step 2: Add styles to `App.css`**

Append to the end of `src/App.css`:

```css
.app-version {
  position: fixed;
  bottom: 12px;
  left: 12px;
  font-size: 11px;
  color: var(--text);
  opacity: 0.5;
  font-family: var(--sans);
  pointer-events: none;
}
```

- [ ] **Step 3: Start the dev server and verify visually**

```bash
npm run dev
```

Open the app in a browser. You should see `v0.1.0` in the lower-left corner in small muted text. Confirm it doesn't overlap the calendar panel toggle or any UI element.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: display app version in lower-left corner"
```

---

### Task 4: Docker image tagging

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add `image:` field to the `app` service in `docker-compose.yml`**

```yaml
  app:
    build: .
    image: aitodo:${APP_VERSION:-latest}
    network_mode: "service:tailscale"
    depends_on:
      - tailscale
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/todos.db
    volumes:
      - todos-data:/app/data
    restart: unless-stopped
```

- [ ] **Step 2: Verify docker compose picks up the version**

```bash
docker compose config | grep image
```

Expected output includes:

```
image: aitodo:0.1.0
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: tag Docker images with APP_VERSION from .env"
```

---

### Task 5: End-to-end smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run `npm version patch` and verify the hook**

```bash
npm version patch
```

Expected: npm bumps `package.json` to `0.1.1`, runs the `version` script (writes `APP_VERSION=0.1.1` to `.env`, stages it), then creates a git commit containing `package.json`, `package-lock.json`, and `.env`, and a git tag `v0.1.1`.

Verify:

```bash
cat .env
# expected: APP_VERSION=0.1.1

git log --oneline -1
# expected: commit message like "0.1.1"

git tag --list | tail -1
# expected: v0.1.1
```

- [ ] **Step 2: Verify Docker Compose picks up the new version**

```bash
docker compose config | grep image
```

Expected:

```
image: aitodo:0.1.1
```

- [ ] **Step 3: Verify the UI shows the updated version**

```bash
npm run dev
```

Open the app. The badge in the lower-left should now read `v0.1.1`.

> Note: the dev server reads `package.json` at startup via `vite.config.js`, so it will reflect the new version without any extra steps.
