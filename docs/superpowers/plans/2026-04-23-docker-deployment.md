# Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the app as a single Docker container with a multi-stage Dockerfile, persistent SQLite volume, and production static file serving.

**Architecture:** A multi-stage Dockerfile produces a lean runtime image (production deps + tsx + built frontend). Express serves both the Vite `dist/` and `/api/*` from a single process. SQLite persists via a named Docker volume mounted at `/app/data/`.

**Tech Stack:** Docker, docker-compose, Node 20 Alpine, tsx, Express, better-sqlite3, Vite.

> **Note:** No automated tests cover Docker behaviour — verification is manual (build + run + curl).

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `server.ts` | DB_PATH env var, PORT env var, conditional CORS, production static serving |
| Create | `.dockerignore` | Exclude node_modules, dist, local DB, dotfiles |
| Create | `Dockerfile` | Multi-stage build (builder + runtime) |
| Create | `docker-compose.yml` | Service definition + named volume |

---

## Task 1: Update `server.ts` for production

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Make DB path configurable via env var**

Replace line 198 in `server.ts`:

```ts
// before
const dbPath = join(dirname(fileURLToPath(import.meta.url)), 'todos.db')

// after
const dbPath = process.env.DB_PATH ?? join(dirname(fileURLToPath(import.meta.url)), 'todos.db')
```

- [ ] **Step 2: Make port configurable and update the listen call**

Replace lines 201–202:

```ts
// before
const app = createApp(db)
app.listen(3001, () => console.log('API server running on http://localhost:3001'))

// after
const app = createApp(db)
const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
```

- [ ] **Step 3: Make CORS conditional on dev mode**

Replace line 79 in `createApp`:

```ts
// before
app.use(cors({ origin: 'http://localhost:5173' }))

// after
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173' }))
}
```

- [ ] **Step 4: Add static file serving after all API routes**

After `return app` is the closing of `createApp`. Add the production static block just before `return app` (line 195):

```ts
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'))
    app.use((_req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' })
    })
  }

  return app
```

- [ ] **Step 5: Check TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Verify dev mode still works**

```bash
# In one terminal
npm run dev
```
Open http://localhost:5173 — app loads and todos work. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add server.ts
git commit -m "feat: make server production-ready for Docker (env-configurable DB path, port, conditional CORS, static serving)"
```

---

## Task 2: Create `.dockerignore`

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create the file**

```
node_modules
dist
todos.db
.superpowers
.claude
docs
*.md
```

- [ ] **Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore"
```

---

## Task 3: Create `Dockerfile`

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create the file**

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx
COPY --from=builder /app/dist ./dist
COPY server.ts tsconfig.json ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npx", "tsx", "server.ts"]
```

- [ ] **Step 2: Build the image to verify it compiles**

```bash
docker build -t aitodo .
```
Expected: build completes, final image tagged `aitodo`. No errors.

- [ ] **Step 3: Smoke-test the image standalone**

```bash
docker run --rm -p 3001:3001 -e NODE_ENV=production aitodo
```
In a second terminal:
```bash
curl -s http://localhost:3001/api/todos
```
Expected: `[]` or an array of todos.

```bash
curl -s http://localhost:3001/
```
Expected: HTML response starting with `<!doctype html>` (the Vite-built index.html).

Stop the container with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "feat: add multi-stage Dockerfile"
```

---

## Task 4: Create `docker-compose.yml`

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create the file**

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

- [ ] **Step 2: Start the stack**

```bash
docker compose up -d --build
```
Expected: container starts, no errors in output.

- [ ] **Step 3: Verify the app is running**

```bash
docker compose logs
```
Expected: `API server running on http://localhost:3001`

```bash
curl -s http://localhost:3001/api/todos
```
Expected: `[]` or existing todos.

```bash
curl -s http://localhost:3001/
```
Expected: HTML starting with `<!doctype html>`.

- [ ] **Step 4: Verify SQLite persistence across restarts**

```bash
# Add a todo
curl -s -X POST http://localhost:3001/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"text":"persistence test"}' | jq .
# Expected: {"id":1,"text":"persistence test",...}

# Restart the container
docker compose restart

# Verify todo survived
curl -s http://localhost:3001/api/todos | jq '.[0].text'
# Expected: "persistence test"
```

- [ ] **Step 5: Stop the stack**

```bash
docker compose down
```

- [ ] **Step 6: Commit and push**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose with persistent SQLite volume"
git push
```
