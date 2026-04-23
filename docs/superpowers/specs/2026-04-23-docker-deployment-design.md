# Docker Deployment Design

**Date:** 2026-04-23

## Summary

Package the app as a single Docker container using a multi-stage Dockerfile. The Vite frontend is built in the build stage; Express serves both the static frontend and the API in production. SQLite persists via a named Docker volume.

## Deployment Target

Single machine (VPS or home server). Orchestrated with `docker-compose`.

## Architecture

One container runs the Express server (`server.ts` via `tsx`) on port 3001. In production mode, Express serves the Vite-built static files from `dist/` in addition to `/api/*` routes. No separate Vite dev server or nginx needed.

```
Browser → :3001 → Express
                  ├── /api/*        → SQLite (named volume at /app/data/todos.db)
                  ├── /assets/*     → dist/ (static)
                  └── GET *         → dist/index.html (SPA catch-all)
```

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `Dockerfile` | Multi-stage build |
| Create | `docker-compose.yml` | Service + volume definition |
| Create | `.dockerignore` | Exclude build artifacts and local files |
| Modify | `server.ts` | Production static serving, conditional CORS, env-configurable DB path and port |

## Dockerfile

Two stages:

**Stage 1 — builder (`node:20-alpine`)**
- `npm ci` (installs all deps including devDependencies)
- `npm run build` (produces `dist/`)

**Stage 2 — runtime (`node:20-alpine`)**
- `npm ci --omit=dev && npm install tsx` (production deps + tsx runner)
- Copy `dist/` from builder
- Copy `server.ts` and `tsconfig.json`
- `ENV NODE_ENV=production`
- `EXPOSE 3001`
- `CMD ["npx", "tsx", "server.ts"]`

`tsx` is a devDependency; the runtime stage installs it explicitly rather than relying on `npx` downloading it at container startup.

## docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/todos.db
    volumes:
      - todos-data:/app/data
    restart: unless-stopped

volumes:
  todos-data:
```

Named volume `todos-data` mounts to `/app/data` inside the container. `DB_PATH` env var points `server.ts` at `/app/data/todos.db`.

## .dockerignore

```
node_modules
dist
todos.db
.superpowers
.claude
docs
*.md
```

## server.ts Changes

### 1. DB path via environment variable

```ts
const dbPath = process.env.DB_PATH ?? join(dirname(fileURLToPath(import.meta.url)), 'todos.db')
```

Development continues to use `todos.db` next to `server.ts`. Docker uses `/app/data/todos.db`.

### 2. Port via environment variable

```ts
const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
```

### 3. Conditional CORS

In production the frontend is served from the same Express process (same origin), so the `localhost:5173` CORS header is only applied in development:

```ts
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173' }))
}
```

### 4. Static file serving (production only)

After all API routes, add:

```ts
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'))
  app.get('*', (_req, res) => res.sendFile('dist/index.html', { root: '.' }))
}
```

The catch-all ensures that refreshing the page on any client-side route returns `index.html` rather than a 404.

## Development Workflow (unchanged)

`npm run dev` continues to run `tsx server.ts` + Vite dev server concurrently on ports 3001 and 5173. No Docker involvement in day-to-day development.

## Deployment Commands

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down

# Stop and remove volume (deletes all todos)
docker compose down -v
```

## Out of Scope

- HTTPS / TLS termination (handle at reverse proxy or host level)
- Multi-container setup (nginx + node)
- CI/CD pipeline
- Health check endpoint
