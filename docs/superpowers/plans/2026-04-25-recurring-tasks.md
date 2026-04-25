# Recurring Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recurring tasks that auto-spawn a new instance on completion, configured inline on each todo item via a "🔁 Repeat" row.

**Architecture:** A `recurring_templates` table stores recurrence config. Setting recurrence on an existing todo calls `POST /api/templates` with `todo_id`, which creates the template and sets `template_id` on that todo. On `PATCH /api/todos/:id { done: true }`, the server detects `template_id`, calculates the next due date (strict: from current `due_date`), and inserts the next instance in the same DB transaction. The client reloads todos after any template mutation.

**Tech Stack:** SQLite via better-sqlite3, Express 5, React 19 + TypeScript, Vitest + Supertest (server tests only)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server.ts` | Modify | `recurring_templates` table init, template endpoints, `nextOccurrence` helper, spawn on complete |
| `server.test.ts` | Modify | Server integration tests for all new behavior |
| `src/types.ts` | Modify | `RecurringTemplate` interface + `RecurrenceType`; `template_id` on `Todo` |
| `src/api.ts` | Modify | `fetchTemplates`, `createTemplate`, `eraseTemplate`; update `patchTodo` return type |
| `src/hooks/useTemplates.ts` | Create | Template state: load, create, delete |
| `src/utils/recurrence.ts` | Create | `recurrenceLabel(template)` → display string |
| `src/components/RecurrencePicker.tsx` | Create | Inline segmented picker: type tabs, day toggles, interval input, Set/Remove |
| `src/components/DueDateChip.tsx` | Modify | Accept `recurrenceLabel?: string` prop, render pill badge |
| `src/components/TodoItem.tsx` | Modify | Add Repeat row; pass `recurrenceLabel` to `DueDateChip`; new props |
| `src/App.tsx` | Modify | Wire `useTemplates`; pass template props to `TodoItem` |
| `src/App.css` | Modify | Styles for recurrence picker, tabs, day buttons, chip badge |

---

## Task 1: DB schema + TypeScript types

**Files:**
- Modify: `server.ts` (initDb function)
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests for new schema columns**

Add to `server.test.ts` after the imports block, before the first `describe`:

```typescript
describe('schema', () => {
  it('has recurring_templates table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    expect(tables.map(t => t.name)).toContain('recurring_templates')
  })

  it('todos table has template_id column', () => {
    const cols = (db.prepare('PRAGMA table_info(todos)').all() as { name: string }[]).map(c => c.name)
    expect(cols).toContain('template_id')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "schema"
```
Expected: `FAIL` — `recurring_templates` not found, `template_id` not found.

- [ ] **Step 3: Add `recurring_templates` table and `template_id` migration in `initDb`**

In `server.ts`, inside `initDb`, after the existing `db.exec` blocks, add:

```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS recurring_templates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    text            TEXT NOT NULL,
    category_id     INTEGER REFERENCES categories(id),
    description     TEXT,
    recurrence_type TEXT NOT NULL,
    day_mask        INTEGER,
    interval_days   INTEGER,
    day_of_month    INTEGER
  )
`)

if (!todoCols.includes('template_id')) {
  db.exec('ALTER TABLE todos ADD COLUMN template_id INTEGER REFERENCES recurring_templates(id)')
}
```

- [ ] **Step 4: Add `TemplateRow` interface and `template_id` to `TodoRow` in `server.ts`**

Add after the existing `CategoryRow` interface:

```typescript
interface TemplateRow {
  id: number
  text: string
  category_id: number | null
  description: string | null
  recurrence_type: string
  day_mask: number | null
  interval_days: number | null
  day_of_month: number | null
}
```

Add `template_id: number | null` to the existing `TodoRow` interface:

```typescript
interface TodoRow {
  id: number
  text: string
  done: number
  completed_at: string | null
  created_at: string
  parent_id: number | null
  category_id: number | null
  due_date: string | null
  description: string | null
  template_id: number | null  // add this line
}
```

- [ ] **Step 5: Update `src/types.ts`**

Replace the entire file:

```typescript
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurringTemplate {
  id: number
  text: string
  category_id: number | null
  description: string | null
  recurrence_type: RecurrenceType
  day_mask: number | null
  interval_days: number | null
  day_of_month: number | null
}

export interface Todo {
  id: number
  text: string
  done: boolean
  completed_at: string | null
  created_at: string
  parent_id: number | null
  category_id: number | null
  due_date: string | null
  description: string | null
  template_id: number | null
}

export interface Category {
  id: number
  name: string
  color: string
}
```

- [ ] **Step 6: Run tests**

```bash
npm test
```
Expected: all existing tests pass + 2 new schema tests pass.

- [ ] **Step 7: Commit**

```bash
git add server.ts server.test.ts src/types.ts
git commit -m "feat: add recurring_templates schema and types"
```

---

## Task 2: GET + POST /api/templates

**Files:**
- Modify: `server.ts` (statements + routes + `nextOccurrence` helper)
- Modify: `server.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `server.test.ts`:

```typescript
describe('GET /api/templates', () => {
  it('returns empty array when no templates exist', async () => {
    const res = await request.get('/api/templates')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /api/templates', () => {
  async function makeTodoWithDue(due_date: string) {
    const todo = await request.post('/api/todos').send({ text: 'standup' })
    await request.patch(`/api/todos/${todo.body.id}`).send({ due_date })
    return todo.body.id as number
  }

  it('creates a daily template and links the todo', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId,
      recurrence_type: 'daily',
    })
    expect(res.status).toBe(200)
    expect(res.body.template.recurrence_type).toBe('daily')
    expect(res.body.template.text).toBe('standup')
    expect(res.body.todo.template_id).toBe(res.body.template.id)
    expect(res.body.todo.id).toBe(todoId)
  })

  it('creates a weekly template with day_mask', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId,
      recurrence_type: 'weekly',
      day_mask: 2,
    })
    expect(res.status).toBe(200)
    expect(res.body.template.day_mask).toBe(2)
  })

  it('creates a custom template with interval_days', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId,
      recurrence_type: 'custom',
      interval_days: 14,
    })
    expect(res.status).toBe(200)
    expect(res.body.template.interval_days).toBe(14)
  })

  it('creates a monthly template and derives day_of_month from due_date', async () => {
    const todoId = await makeTodoWithDue('2026-04-15')
    const res = await request.post('/api/templates').send({
      todo_id: todoId,
      recurrence_type: 'monthly',
    })
    expect(res.status).toBe(200)
    expect(res.body.template.day_of_month).toBe(15)
  })

  it('returns 400 when todo_id is missing', async () => {
    const res = await request.post('/api/templates').send({ recurrence_type: 'daily' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when todo does not exist', async () => {
    const res = await request.post('/api/templates').send({ todo_id: 999, recurrence_type: 'daily' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when todo has no due_date', async () => {
    const todo = await request.post('/api/todos').send({ text: 'no date' })
    const res = await request.post('/api/templates').send({ todo_id: todo.body.id, recurrence_type: 'daily' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for weekly with day_mask = 0', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId, recurrence_type: 'weekly', day_mask: 0,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for custom with interval_days < 1', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId, recurrence_type: 'custom', interval_days: 0,
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/templates returns created template', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    await request.post('/api/templates').send({ todo_id: todoId, recurrence_type: 'daily' })
    const res = await request.get('/api/templates')
    expect(res.body).toHaveLength(1)
    expect(res.body[0].recurrence_type).toBe('daily')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|templates)" | head -20
```
Expected: `FAIL` — routes not defined.

- [ ] **Step 3: Add `nextOccurrence` helper and new statements to `server.ts`**

Add the helper function after the `TemplateRow` interface (before `createApp`):

```typescript
function nextOccurrence(template: TemplateRow, currentDue: string): string {
  const d = new Date(currentDue + 'T12:00:00Z')
  switch (template.recurrence_type) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1)
      break
    case 'weekly': {
      const mask = template.day_mask!
      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(d)
        candidate.setUTCDate(d.getUTCDate() + i)
        if (mask & (1 << candidate.getUTCDay())) {
          return candidate.toISOString().slice(0, 10)
        }
      }
      break
    }
    case 'monthly': {
      d.setUTCMonth(d.getUTCMonth() + 1)
      d.setUTCDate(template.day_of_month!)
      break
    }
    case 'custom':
      d.setUTCDate(d.getUTCDate() + template.interval_days!)
      break
  }
  return d.toISOString().slice(0, 10)
}
```

Add to the `stmts` object inside `createApp`, after the existing statements:

```typescript
getAllTemplates:     db.prepare<[], TemplateRow>('SELECT * FROM recurring_templates ORDER BY id'),
getTemplateById:    db.prepare<[number], TemplateRow>('SELECT * FROM recurring_templates WHERE id = ?'),
insertTemplate:     db.prepare<[string, number | null, string | null, string, number | null, number | null, number | null], Database.RunResult>(
                      'INSERT INTO recurring_templates (text, category_id, description, recurrence_type, day_mask, interval_days, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)'),
getTodo:            db.prepare<[number], TodoRow>('SELECT * FROM todos WHERE id = ?'),
updateTodoTemplate: db.prepare<[number, number], Database.RunResult>('UPDATE todos SET template_id = ? WHERE id = ?'),
```

- [ ] **Step 4: Add GET and POST routes in `createApp`**

Add after the existing `DELETE /api/todos/:id` route:

```typescript
app.get('/api/templates', (_req: Request, res: Response) => {
  try {
    res.json(stmts.getAllTemplates.all())
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

app.post('/api/templates', (req: Request, res: Response) => {
  try {
    const { todo_id, recurrence_type, day_mask, interval_days } =
      req.body as { todo_id?: number; recurrence_type?: string; day_mask?: number; interval_days?: number }

    if (!todo_id) return res.status(400).json({ error: 'todo_id is required' })

    const validTypes = ['daily', 'weekly', 'monthly', 'custom']
    if (!recurrence_type || !validTypes.includes(recurrence_type)) {
      return res.status(400).json({ error: 'recurrence_type must be daily|weekly|monthly|custom' })
    }
    if (recurrence_type === 'weekly' && !(day_mask && day_mask > 0)) {
      return res.status(400).json({ error: 'day_mask required and non-zero for weekly' })
    }
    if (recurrence_type === 'custom' && (!interval_days || interval_days < 1)) {
      return res.status(400).json({ error: 'interval_days required and >= 1 for custom' })
    }

    const todo = stmts.getTodo.get(Number(todo_id))
    if (!todo) return res.status(400).json({ error: 'todo not found' })
    if (!todo.due_date) return res.status(400).json({ error: 'todo must have a due_date' })

    const dom = recurrence_type === 'monthly' ? Number(todo.due_date.slice(8, 10)) : null
    const maskVal = recurrence_type === 'weekly' ? (day_mask ?? null) : null
    const intervalVal = recurrence_type === 'custom' ? (interval_days ?? null) : null

    const result = db.transaction(() => {
      const tplResult = stmts.insertTemplate.run(
        todo.text, todo.category_id, todo.description,
        recurrence_type, maskVal, intervalVal, dom
      )
      const templateId = Number(tplResult.lastInsertRowid)
      stmts.updateTodoTemplate.run(templateId, Number(todo_id))
      const template = stmts.getTemplateById.get(templateId)!
      const updatedTodo = stmts.getTodo.get(Number(todo_id))!
      return { template, todo: { ...updatedTodo, done: !!updatedTodo.done } }
    })()

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all tests pass including the new POST/GET template tests.

- [ ] **Step 6: Commit**

```bash
git add server.ts server.test.ts
git commit -m "feat: add GET and POST /api/templates endpoints"
```

---

## Task 3: DELETE /api/templates/:id

**Files:**
- Modify: `server.ts`
- Modify: `server.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `server.test.ts`:

```typescript
describe('DELETE /api/templates/:id', () => {
  async function makeRecurringTodo() {
    const todo = await request.post('/api/todos').send({ text: 'standup' })
    await request.patch(`/api/todos/${todo.body.id}`).send({ due_date: '2026-04-28' })
    const tpl = await request.post('/api/templates').send({
      todo_id: todo.body.id, recurrence_type: 'daily',
    })
    return { todoId: todo.body.id as number, templateId: tpl.body.template.id as number }
  }

  it('deletes a template', async () => {
    const { templateId } = await makeRecurringTodo()
    const res = await request.delete(`/api/templates/${templateId}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const templates = await request.get('/api/templates')
    expect(templates.body).toHaveLength(0)
  })

  it('existing todos retain template_id as tombstone after delete', async () => {
    const { todoId, templateId } = await makeRecurringTodo()
    await request.delete(`/api/templates/${templateId}`)
    const todos = await request.get('/api/todos')
    const todo = todos.body.find((t: { id: number }) => t.id === todoId)
    expect(todo.template_id).toBe(templateId)
  })

  it('returns ok for non-existent id', async () => {
    const res = await request.delete('/api/templates/999')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|templates)" | head -10
```
Expected: `FAIL` on the delete tests.

- [ ] **Step 3: Add statement and route**

Add to the `stmts` object in `createApp`:

```typescript
deleteTemplate: db.prepare<[number], Database.RunResult>('DELETE FROM recurring_templates WHERE id = ?'),
```

Add the DELETE route after `POST /api/templates`:

```typescript
app.delete('/api/templates/:id', (req: Request, res: Response) => {
  try {
    stmts.deleteTemplate.run(Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server.ts server.test.ts
git commit -m "feat: add DELETE /api/templates/:id endpoint"
```

---

## Task 4: PATCH /api/todos/:id — spawn on completion

**Files:**
- Modify: `server.ts`
- Modify: `server.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `server.test.ts`:

```typescript
describe('PATCH /api/todos/:id — recurring spawn', () => {
  async function makeRecurring(opts: { due_date: string; recurrence_type: string; day_mask?: number; interval_days?: number }) {
    const todo = await request.post('/api/todos').send({ text: 'standup' })
    await request.patch(`/api/todos/${todo.body.id}`).send({ due_date: opts.due_date })
    const tpl = await request.post('/api/templates').send({ todo_id: todo.body.id, ...opts })
    return { todoId: todo.body.id as number, templateId: tpl.body.template.id as number }
  }

  it('spawns next daily instance on completion', async () => {
    const { todoId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'daily' })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned).not.toBeNull()
    expect(res.body.spawned.due_date).toBe('2026-04-29')
    expect(res.body.spawned.done).toBe(0)
    expect(res.body.spawned.text).toBe('standup')
  })

  it('spawns next weekly instance — advances to correct weekday', async () => {
    // 2026-04-28 is a Tuesday (day 2 = bit 4); day_mask 2 = Mon only (bit 1)
    // next Monday after Tuesday 2026-04-28 is 2026-05-04
    const { todoId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'weekly', day_mask: 2 })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned.due_date).toBe('2026-05-04')
  })

  it('spawns next monthly instance — same day next month', async () => {
    const { todoId } = await makeRecurring({ due_date: '2026-04-15', recurrence_type: 'monthly' })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned.due_date).toBe('2026-05-15')
  })

  it('spawns next custom instance — adds interval_days', async () => {
    const { todoId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'custom', interval_days: 14 })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned.due_date).toBe('2026-05-12')
  })

  it('returns spawned: null for non-recurring todo', async () => {
    const todo = await request.post('/api/todos').send({ text: 'one-off' })
    const res = await request.patch(`/api/todos/${todo.body.id}`).send({ done: true })
    expect(res.body.ok).toBe(true)
    expect(res.body.spawned).toBeNull()
  })

  it('does not spawn when un-checking a recurring todo', async () => {
    const { todoId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'daily' })
    await request.patch(`/api/todos/${todoId}`).send({ done: true })
    const countBefore = (await request.get('/api/todos')).body.length
    await request.patch(`/api/todos/${todoId}`).send({ done: false })
    const countAfter = (await request.get('/api/todos')).body.length
    expect(countAfter).toBe(countBefore)
  })

  it('spawned instance has same template_id', async () => {
    const { todoId, templateId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'daily' })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned.template_id).toBe(templateId)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|spawn)" | head -15
```
Expected: `FAIL` — `spawned` property not present in response.

- [ ] **Step 3: Add `spawnTodo` statement and `getTemplateById` statement**

Add to the `stmts` object in `createApp`:

```typescript
spawnTodo: db.prepare<[string, number | null, string | null, string, string, number], Database.RunResult>(
             'INSERT INTO todos (text, category_id, description, created_at, due_date, template_id) VALUES (?, ?, ?, ?, ?, ?)'),
```

- [ ] **Step 4: Modify the PATCH handler to spawn on completion**

In `server.ts`, find the `app.patch('/api/todos/:id', ...)` handler. Replace the section that handles `done`:

```typescript
// Find this block inside app.patch:
if (done !== undefined) {
  const completed_at = done ? new Date().toISOString() : null
  function updateTree(id: number) {
    stmts.update.run(done ? 1 : 0, completed_at, id)
    if (done) {
      for (const child of stmts.getChildren.all(id)) updateTree(child.id)
    }
  }
  db.transaction(updateTree)(Number(req.params.id))
}
```

Replace with:

```typescript
let spawned: TodoRow | null = null
if (done !== undefined) {
  const completed_at = done ? new Date().toISOString() : null
  function updateTree(id: number) {
    stmts.update.run(done ? 1 : 0, completed_at, id)
    if (done) {
      for (const child of stmts.getChildren.all(id)) updateTree(child.id)
    }
  }
  db.transaction(updateTree)(Number(req.params.id))

  if (done) {
    const todo = stmts.getTodo.get(Number(req.params.id))
    if (todo?.template_id && todo.due_date) {
      const template = stmts.getTemplateById.get(todo.template_id)
      if (template) {
        const nextDue = nextOccurrence(template, todo.due_date)
        const created_at = new Date().toISOString()
        const spawnResult = stmts.spawnTodo.run(
          template.text, template.category_id, template.description,
          created_at, nextDue, template.id
        )
        spawned = stmts.getTodo.get(Number(spawnResult.lastInsertRowid)) ?? null
      }
    }
  }
}
```

Also update the final `res.json` at the end of the handler — replace `res.json({ ok: true })` with:

```typescript
res.json({ ok: true, spawned: spawned ? { ...spawned, done: !!spawned.done } : null })
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all tests pass including the 7 new spawn tests.

- [ ] **Step 6: Commit**

```bash
git add server.ts server.test.ts
git commit -m "feat: spawn next recurring instance on todo completion"
```

---

## Task 5: API client functions

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: Update `patchTodo` return type and add template functions**

Replace the entire `src/api.ts` file:

```typescript
import type { Todo, Category, RecurringTemplate, RecurrenceType } from './types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const fetchTodos = () =>
  request<Todo[]>('/api/todos').then(todos => todos.map(t => ({ ...t, done: !!t.done })))

export const fetchCategories = () =>
  request<Category[]>('/api/categories')

export const createTodo = (text: string, category_id: number | null = null, parent_id: number | null = null) =>
  request<Todo>('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, category_id, parent_id }),
  })

export const patchTodo = (id: number, patch: Partial<Pick<Todo, 'done' | 'category_id' | 'due_date' | 'description'>>) =>
  request<{ ok: true; spawned: Todo | null }>(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

export const eraseTodo = (id: number) =>
  request<{ ok: true }>(`/api/todos/${id}`, { method: 'DELETE' })

export const createCategory = (name: string, color: string) =>
  request<Category>('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  })

export const eraseCategory = (id: number) =>
  request<{ ok: true }>(`/api/categories/${id}`, { method: 'DELETE' })

export type SetRecurrenceConfig = {
  recurrence_type: RecurrenceType
  day_mask?: number
  interval_days?: number
}

export const fetchTemplates = () =>
  request<RecurringTemplate[]>('/api/templates')

export const createTemplate = (todo_id: number, config: SetRecurrenceConfig) =>
  request<{ template: RecurringTemplate; todo: Todo }>('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ todo_id, ...config }),
  })

export const eraseTemplate = (id: number) =>
  request<{ ok: true }>(`/api/templates/${id}`, { method: 'DELETE' })
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```
Expected: build succeeds (or only pre-existing warnings).

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat: add template API client functions"
```

---

## Task 6: useTemplates hook

**Files:**
- Create: `src/hooks/useTemplates.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useTemplates.ts`:

```typescript
import { useState, useCallback, useEffect } from 'react'
import type { RecurringTemplate } from '../types'
import type { SetRecurrenceConfig } from '../api'
import * as api from '../api'

export function useTemplates() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTemplates(await api.fetchTemplates())
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createTemplate(todo_id: number, config: SetRecurrenceConfig) {
    try {
      const result = await api.createTemplate(todo_id, config)
      await load()
      return result
    } catch (err) {
      setError((err as Error).message)
      throw err
    }
  }

  async function deleteTemplate(id: number) {
    try {
      await api.eraseTemplate(id)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return {
    templates,
    error,
    clearError: () => setError(null),
    load,
    createTemplate,
    deleteTemplate,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTemplates.ts
git commit -m "feat: add useTemplates hook"
```

---

## Task 7: Recurrence label utility

**Files:**
- Create: `src/utils/recurrence.ts`

- [ ] **Step 1: Create the utility**

Create `src/utils/recurrence.ts`:

```typescript
import type { RecurringTemplate } from '../types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function recurrenceLabel(t: RecurringTemplate): string {
  switch (t.recurrence_type) {
    case 'daily':   return 'daily'
    case 'monthly': return 'monthly'
    case 'custom':  return `every ${t.interval_days}d`
    case 'weekly': {
      const days = DAY_NAMES.filter((_, i) => (t.day_mask! >> i) & 1)
      return days.length === 1 ? `every ${days[0]}` : days.join('/')
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/recurrence.ts
git commit -m "feat: add recurrenceLabel utility"
```

---

## Task 8: DueDateChip — recurrence badge

**Files:**
- Modify: `src/components/DueDateChip.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add `recurrenceLabel` prop and badge to `DueDateChip`**

In `src/components/DueDateChip.tsx`, update the `Props` interface:

```typescript
interface Props {
  dueDate: string | null
  onChange: (date: string | null) => void
  recurrenceLabel?: string
}
```

Update the function signature:

```typescript
export function DueDateChip({ dueDate, onChange, recurrenceLabel }: Props) {
```

Inside the JSX return, after the `due-chip-clear` button and before the `{open && createPortal(...)}`, add:

```tsx
{dueDate && recurrenceLabel && (
  <span className="recurrence-badge">{recurrenceLabel}</span>
)}
```

So the return block becomes:

```tsx
return (
  <div className="due-chip-wrap" ref={wrapRef}>
    <button
      type="button"
      className={`due-chip${dueDate ? (overdue ? ' overdue' : ' has-date') : ''}`}
      onClick={handleOpen}
    >
      {dueDate ? formatDisplay(dueDate) : '+ due date'}
    </button>
    {dueDate && (
      <button
        type="button"
        className="due-chip-clear"
        onClick={e => { e.stopPropagation(); onChange(null) }}
        aria-label="Clear due date"
      >
        ✕
      </button>
    )}
    {dueDate && recurrenceLabel && (
      <span className="recurrence-badge">{recurrenceLabel}</span>
    )}
    {open && createPortal(
      <div
        ref={popoverRef}
        className="due-chip-popover"
        style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 1000 }}
      >
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={handleSelect}
        />
      </div>,
      document.body
    )}
  </div>
)
```

- [ ] **Step 2: Add `.recurrence-badge` styles to `src/App.css`**

Append to `src/App.css`:

```css
.recurrence-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid var(--accent-border);
  margin-left: 4px;
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/DueDateChip.tsx src/App.css
git commit -m "feat: add recurrenceLabel badge to DueDateChip"
```

---

## Task 9: RecurrencePicker component

**Files:**
- Create: `src/components/RecurrencePicker.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create `RecurrencePicker.tsx`**

Create `src/components/RecurrencePicker.tsx`:

```tsx
import { useState } from 'react'
import type { RecurringTemplate, RecurrenceType } from '../types'
import type { SetRecurrenceConfig } from '../api'
import { recurrenceLabel } from '../utils/recurrence'

interface Props {
  dueDate: string | null
  template: RecurringTemplate | null
  onSet: (config: SetRecurrenceConfig) => Promise<void>
  onRemove: () => Promise<void>
}

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function RecurrencePicker({ dueDate, template, onSet, onRemove }: Props) {
  const [type, setType] = useState<RecurrenceType>(template?.recurrence_type ?? 'daily')
  const [dayMask, setDayMask] = useState<number>(template?.day_mask ?? 2)
  const [intervalDays, setIntervalDays] = useState<number>(template?.interval_days ?? 7)
  const [saving, setSaving] = useState(false)

  const dom = dueDate ? Number(dueDate.slice(8, 10)) : null
  const isValid = type !== 'weekly' || dayMask > 0

  async function handleSet() {
    setSaving(true)
    try {
      const config: SetRecurrenceConfig = { recurrence_type: type }
      if (type === 'weekly') config.day_mask = dayMask
      if (type === 'custom') config.interval_days = intervalDays
      await onSet(config)
    } finally {
      setSaving(false)
    }
  }

  if (!dueDate) {
    return (
      <div className="recurrence-row disabled">
        <span className="recurrence-row-label">🔁 Repeat</span>
        <span className="recurrence-hint">Set a due date first</span>
      </div>
    )
  }

  if (template) {
    return (
      <div className="recurrence-row">
        <span className="recurrence-row-label">🔁 Repeat</span>
        <span className="recurrence-current">{recurrenceLabel(template)}</span>
        <button type="button" className="recurrence-remove" onClick={onRemove}>
          Remove
        </button>
      </div>
    )
  }

  return (
    <div className="recurrence-row">
      <span className="recurrence-row-label">🔁 Repeat</span>
      <div className="recurrence-picker">
        <div className="rec-type-tabs">
          {(['daily', 'weekly', 'monthly', 'custom'] as RecurrenceType[]).map(t => (
            <button
              key={t}
              type="button"
              className={`rec-tab${type === t ? ' active' : ''}`}
              onClick={() => setType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {type === 'weekly' && (
          <div className="rec-days">
            {DAY_ABBR.map((d, i) => (
              <button
                key={d}
                type="button"
                className={`rec-day${(dayMask >> i) & 1 ? ' active' : ''}`}
                onClick={() => setDayMask(m => (m >> i) & 1 ? m & ~(1 << i) : m | (1 << i))}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        {type === 'monthly' && dom && (
          <span className="recurrence-hint">Repeats on the {ordinal(dom)}</span>
        )}
        {type === 'custom' && (
          <div className="rec-custom">
            <span>Every</span>
            <input
              type="number"
              min={1}
              max={365}
              value={intervalDays}
              onChange={e => setIntervalDays(Math.max(1, Number(e.target.value)))}
              className="rec-interval"
            />
            <span>days</span>
          </div>
        )}
        <button
          type="button"
          className="rec-set-btn"
          disabled={!isValid || saving}
          onClick={handleSet}
        >
          {saving ? '…' : 'Set'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add RecurrencePicker styles to `src/App.css`**

Append to `src/App.css`:

```css
.recurrence-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  flex-wrap: wrap;
}

.recurrence-row.disabled {
  opacity: 0.5;
}

.recurrence-row-label {
  color: var(--text);
  min-width: 72px;
  flex-shrink: 0;
}

.recurrence-hint {
  color: var(--text);
  font-size: 12px;
}

.recurrence-current {
  color: var(--accent);
  font-size: 13px;
}

.recurrence-remove {
  background: none;
  border: none;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0.6;

  &:hover {
    opacity: 1;
    background: var(--border);
  }
}

.recurrence-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rec-type-tabs {
  display: flex;
  gap: 3px;
}

.rec-tab {
  padding: 2px 9px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-family: var(--sans);

  &.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  &:hover:not(.active) {
    background: var(--accent-bg);
  }
}

.rec-days {
  display: flex;
  gap: 3px;
}

.rec-day {
  width: 28px;
  height: 28px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-family: var(--sans);
  padding: 0;

  &.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  &:hover:not(.active) {
    background: var(--accent-bg);
  }
}

.rec-custom {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--text);
}

.rec-interval {
  width: 50px;
  padding: 2px 6px;
  font-size: 13px;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text-h);
  font-family: var(--sans);
}

.rec-set-btn {
  padding: 3px 12px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-family: var(--sans);

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    opacity: 0.85;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/RecurrencePicker.tsx src/App.css
git commit -m "feat: add RecurrencePicker component"
```

---

## Task 10: TodoItem — wire RecurrencePicker

**Files:**
- Modify: `src/components/TodoItem.tsx`

- [ ] **Step 1: Update `Props` interface and component signature**

In `src/components/TodoItem.tsx`, replace the `Props` interface:

```typescript
interface Props {
  todo: Todo
  subtasks: Todo[]
  categories: Category[]
  templates: RecurringTemplate[]
  onToggle: (id: number, done: boolean) => void
  onDelete: (id: number) => void
  onAddChild: (text: string, parent_id: number) => void
  onChangeCategory: (id: number, category_id: number | null) => void
  onChangeDueDate: (id: number, due_date: string | null) => void
  onChangeDescription: (id: number, description: string | null) => void
  onSetRecurrence: (todoId: number, config: SetRecurrenceConfig) => Promise<void>
  onRemoveRecurrence: (templateId: number) => Promise<void>
  subtasksOf: (id: number) => Todo[]
  showDueDateChip: boolean
  forceExpanded?: boolean
}
```

Update imports at the top:

```typescript
import { useState } from 'react'
import type { Todo, Category, RecurringTemplate } from '../types'
import type { SetRecurrenceConfig } from '../api'
import { DueDateChip } from './DueDateChip'
import { DescriptionField } from './DescriptionField'
import { RecurrencePicker } from './RecurrencePicker'
import { recurrenceLabel } from '../utils/recurrence'
```

Update the function signature to destructure the new props:

```typescript
export function TodoItem({ todo, subtasks, categories, templates, onToggle, onDelete, onAddChild, onChangeCategory, onChangeDueDate, onChangeDescription, onSetRecurrence, onRemoveRecurrence, subtasksOf, showDueDateChip, forceExpanded = false }: Props) {
```

- [ ] **Step 2: Compute template and label, wire RecurrencePicker into JSX**

Add these two lines right after the existing `const cat = ...` line:

```typescript
const template = templates.find(t => t.id === todo.template_id) ?? null
const recLabel = template ? recurrenceLabel(template) : undefined
```

In the JSX, update the `DueDateChip` usage to pass the label:

```tsx
{showDueDateChip && (
  <DueDateChip
    dueDate={todo.due_date}
    onChange={due_date => onChangeDueDate(todo.id, due_date)}
    recurrenceLabel={recLabel}
  />
)}
```

Add `RecurrencePicker` after `<DescriptionField .../>` and before the `{adding && ...}` block. Only render for top-level todos (no parent):

```tsx
{todo.parent_id === null && (
  <RecurrencePicker
    dueDate={todo.due_date}
    template={template}
    onSet={config => onSetRecurrence(todo.id, config)}
    onRemove={() => template && onRemoveRecurrence(template.id)}
  />
)}
```

- [ ] **Step 3: Update the recursive `TodoItem` call inside the subtask list**

Find the recursive `<TodoItem ... />` call in the subtask `ul`. Add the new required props:

```tsx
<TodoItem
  key={child.id}
  todo={child}
  subtasks={subtasksOf(child.id)}
  categories={categories}
  templates={templates}
  onToggle={onToggle}
  onDelete={onDelete}
  onAddChild={onAddChild}
  onChangeCategory={onChangeCategory}
  onChangeDueDate={onChangeDueDate}
  onChangeDescription={onChangeDescription}
  onSetRecurrence={onSetRecurrence}
  onRemoveRecurrence={onRemoveRecurrence}
  subtasksOf={subtasksOf}
  showDueDateChip={false}
  forceExpanded={forceExpanded}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```
Expected: errors on `App.tsx` only (missing new props on `TodoItem` there — fixed in next task).

- [ ] **Step 5: Commit**

```bash
git add src/components/TodoItem.tsx
git commit -m "feat: wire RecurrencePicker into TodoItem"
```

---

## Task 11: App.tsx wiring + final build

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `useTemplates` and wire handlers**

In `src/App.tsx`, add the import:

```typescript
import { useTemplates } from './hooks/useTemplates'
import type { SetRecurrenceConfig } from './api'
```

Inside the `App` component, after the `useCategories()` call, add:

```typescript
const {
  templates,
  error: templateError,
  clearError: clearTemplateError,
  createTemplate,
  deleteTemplate,
} = useTemplates()
```

Update the combined error line:

```typescript
const error = todoError ?? catError ?? templateError
const clearError = () => { clearTodoError(); clearCatError(); clearTemplateError() }
```

Add the two handler functions after `handleDeleteCategory`:

```typescript
async function handleSetRecurrence(todoId: number, config: SetRecurrenceConfig) {
  await createTemplate(todoId, config)
  await loadTodos()
}

async function handleRemoveRecurrence(templateId: number) {
  await deleteTemplate(templateId)
  await loadTodos()
}
```

- [ ] **Step 2: Pass new props to `TodoItem`**

Find the `<TodoItem ... />` in the JSX and add the three new props:

```tsx
<TodoItem
  key={todo.id}
  todo={todo}
  subtasks={subtasksOf(todo.id)}
  categories={categories}
  templates={templates}
  onToggle={toggleTodo}
  onDelete={handleDeleteTodo}
  onAddChild={addChild}
  onChangeCategory={changeCategory}
  onChangeDueDate={changeDueDate}
  onChangeDescription={changeDescription}
  onSetRecurrence={handleSetRecurrence}
  onRemoveRecurrence={handleRemoveRecurrence}
  subtasksOf={subtasksOf}
  showDueDateChip={selectedDate === null}
  forceExpanded={selectedDate !== null}
/>
```

- [ ] **Step 3: Full build and type check**

```bash
npm run build 2>&1
```
Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire useTemplates and recurrence handlers into App"
```

---

## Manual Verification Checklist

With `npm run dev` running (http://localhost:5173):

- [ ] Create a todo, set a due date — "🔁 Repeat" row appears below description
- [ ] Without a due date — "🔁 Repeat" shows "Set a due date first" (disabled)
- [ ] Select "Weekly", pick Mon and Fri, click Set — recurrence chip shows "Mon/Fri" next to due date
- [ ] Repeat row now shows "Mon/Fri" and a Remove button
- [ ] Click Remove — chip disappears, row reverts to picker
- [ ] Select "Daily", click Set — chip shows "daily"
- [ ] Check off the recurring todo — a new instance appears immediately with next day's due date
- [ ] Select "Custom", enter 14 days — chip shows "every 14d", completion spawns +14 days out
- [ ] Select "Monthly" — hint shows "Repeats on the Nth", chip shows "monthly", completion spawns same day next month
- [ ] Un-checking a recurring todo does NOT spawn a duplicate
- [ ] Subtasks do NOT show the Repeat row
