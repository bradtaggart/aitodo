# Calendar & Due Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add due dates to top-level tasks and a collapsible calendar side panel for date-based navigation.

**Architecture:** Backend gains a `due_date TEXT` column on `todos` with a safe ALTER TABLE migration and an extended PATCH handler. The frontend adds a `CalendarPanel` (react-day-picker month grid, left panel) and `DueDateChip` (inline date picker on each top-level task row). `App.tsx` gains two-panel flex layout, `selectedDate` state, and filtering logic that narrows the task list to a chosen date.

**Tech Stack:** Express + better-sqlite3 (backend), React 19 + Vite (frontend), react-day-picker v9 (calendar and date picker), vitest + supertest (backend tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server.ts` | Modify | Add `due_date` migration, `updateDueDate` statement, extend PATCH handler |
| `server.test.ts` | Modify | Add tests for `due_date` PATCH set/clear |
| `src/types.ts` | Modify | Add `due_date: string \| null` to `Todo` |
| `src/api.ts` | Modify | Add `due_date` to `patchTodo` pick type |
| `src/hooks/useTodos.ts` | Modify | Add `changeDueDate` action |
| `src/components/DueDateChip.tsx` | Create | Chip + popover date picker for top-level tasks |
| `src/components/CalendarPanel.tsx` | Create | Month grid, highlighted days, collapse toggle |
| `src/components/TodoItem.tsx` | Modify | Add `showDueDateChip` + `forceExpanded` props |
| `src/App.tsx` | Modify | Two-panel layout, `selectedDate`/`calendarOpen` state, date filtering |
| `src/App.css` | Modify | Calendar panel, due chip, app layout styles |

---

## Task 1: Backend — add `due_date` column and extend PATCH

**Files:**
- Modify: `server.ts`
- Modify: `server.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `server.test.ts` after the existing `PATCH /api/todos/:id` describe block:

```typescript
describe('PATCH /api/todos/:id due_date', () => {
  it('sets a due date', async () => {
    const created = await request.post('/api/todos').send({ text: 'task' })
    await request.patch(`/api/todos/${created.body.id}`).send({ due_date: '2026-05-01' })
    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === created.body.id)
    expect(updated.due_date).toBe('2026-05-01')
  })

  it('clears a due date when set to null', async () => {
    const created = await request.post('/api/todos').send({ text: 'task' })
    await request.patch(`/api/todos/${created.body.id}`).send({ due_date: '2026-05-01' })
    await request.patch(`/api/todos/${created.body.id}`).send({ due_date: null })
    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === created.body.id)
    expect(updated.due_date).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: 2 new failures — `updated.due_date` is `undefined` (column doesn't exist yet).

- [ ] **Step 3: Add `due_date` to `TodoRow` interface in `server.ts`**

Change the `TodoRow` interface (around line 8):

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
}
```

- [ ] **Step 4: Add `due_date` migration in `initDb`**

Add after the existing `category_id` migration line inside `initDb` (after `if (!todoCols.includes('category_id'))...`):

```typescript
if (!todoCols.includes('due_date')) db.exec('ALTER TABLE todos ADD COLUMN due_date TEXT')
```

- [ ] **Step 5: Add `updateDueDate` statement and extend PATCH handler**

In `createApp`, add to the `stmts` object (after `clearTodoCat`):

```typescript
updateDueDate: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET due_date = ? WHERE id = ?'),
```

In the PATCH handler, change the destructuring line from:

```typescript
const { done, category_id } = req.body as { done?: boolean; category_id?: number | null }
```

to:

```typescript
const { done, category_id, due_date } = req.body as { done?: boolean; category_id?: number | null; due_date?: string | null }
```

Then add after the existing `if ('category_id' in req.body)` block:

```typescript
if ('due_date' in req.body) {
  stmts.updateDueDate.run(due_date ?? null, Number(req.params.id))
}
```

Also update the `POST /api/todos` response to include `due_date: null` — change line ~100:

```typescript
res.json({ id: result.lastInsertRowid, text: text.trim(), done: 0, completed_at: null, created_at, parent_id, category_id, due_date: null })
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test
```

Expected: all 32 tests pass.

- [ ] **Step 7: Commit**

```bash
git add server.ts server.test.ts
git commit -m "feat: add due_date column and PATCH support"
```

---

## Task 2: Types and API layer

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api.ts`
- Modify: `src/hooks/useTodos.ts`

No automated tests for this task — verify by running `npm run build` (TypeScript will catch type errors).

- [ ] **Step 1: Add `due_date` to the `Todo` interface**

In `src/types.ts`, add the field to `Todo`:

```typescript
export interface Todo {
  id: number
  text: string
  done: boolean
  completed_at: string | null
  created_at: string
  parent_id: number | null
  category_id: number | null
  due_date: string | null
}
```

- [ ] **Step 2: Extend `patchTodo` in `src/api.ts`**

Change the `patchTodo` signature from:

```typescript
export const patchTodo = (id: number, patch: Partial<Pick<Todo, 'done' | 'category_id'>>) =>
```

to:

```typescript
export const patchTodo = (id: number, patch: Partial<Pick<Todo, 'done' | 'category_id' | 'due_date'>>) =>
```

- [ ] **Step 3: Add `changeDueDate` action to `useTodos.ts`**

Add after the `changeCategory` function:

```typescript
const changeDueDate = (id: number, due_date: string | null) =>
  withPending(() => api.patchTodo(id, { due_date }))
```

Add `changeDueDate` to the return object:

```typescript
return {
  todos,
  pending,
  error,
  clearError: () => setError(null),
  load,
  subtasksOf,
  addTodo,
  addChild,
  toggleTodo,
  deleteTodo,
  changeCategory,
  changeDueDate,
}
```

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/api.ts src/hooks/useTodos.ts
git commit -m "feat: add due_date to Todo type and API layer"
```

---

## Task 3: `DueDateChip` component

**Files:**
- Create: `src/components/DueDateChip.tsx`
- Modify: `src/App.css` (chip styles only — layout styles come in Task 6)

- [ ] **Step 1: Install react-day-picker**

```bash
npm install react-day-picker
```

- [ ] **Step 2: Create `src/components/DueDateChip.tsx`**

```typescript
import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

interface Props {
  dueDate: string | null
  onChange: (date: string | null) => void
}

function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(dateStr: string): string {
  return toDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr: string): boolean {
  const due = toDate(dateStr)
  due.setHours(23, 59, 59, 999)
  return due < new Date()
}

export function DueDateChip({ dueDate, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = dueDate ? toDate(dueDate) : undefined
  const overdue = dueDate ? isOverdue(dueDate) : false

  function handleSelect(date: Date | undefined) {
    if (!date) return
    onChange(toDateStr(date))
    setOpen(false)
  }

  return (
    <div className="due-chip-wrap" ref={ref}>
      <button
        type="button"
        className={`due-chip${dueDate ? (overdue ? ' overdue' : ' has-date') : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        {dueDate ? formatDisplay(dueDate) : '+ due date'}
        {dueDate && (
          <span
            className="due-chip-clear"
            onClick={e => { e.stopPropagation(); onChange(null) }}
            role="button"
            aria-label="Clear due date"
          >
            ✕
          </span>
        )}
      </button>
      {open && (
        <div className="due-chip-popover">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add due chip styles to `src/App.css`**

Append to the end of `src/App.css`:

```css
.due-chip-wrap {
  position: relative;
  flex-shrink: 0;
}

.due-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1.5px dashed var(--border);
  background: none;
  color: var(--text);
  font-family: var(--sans);
  white-space: nowrap;

  &.has-date {
    border-style: solid;
    border-color: var(--accent-border);
    background: var(--accent-bg);
    color: var(--accent);
  }

  &.overdue {
    border-style: solid;
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  &:hover { opacity: 0.8; }
}

.due-chip-clear {
  font-size: 11px;
  line-height: 1;
  opacity: 0.7;

  &:hover { opacity: 1; }
}

.due-chip-popover {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 100;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 4px;
}
```

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/DueDateChip.tsx src/App.css package.json package-lock.json
git commit -m "feat: add DueDateChip component"
```

---

## Task 4: Update `TodoItem` — `showDueDateChip` and `forceExpanded`

**Files:**
- Modify: `src/components/TodoItem.tsx`

- [ ] **Step 1: Add the two new props to the `Props` interface**

Change the interface at the top of `TodoItem.tsx`:

```typescript
interface Props {
  todo: Todo
  subtasks: Todo[]
  categories: Category[]
  onToggle: (id: number, done: boolean) => void
  onDelete: (id: number) => void
  onAddChild: (text: string, parent_id: number) => void
  onChangeCategory: (id: number, category_id: number | null) => void
  onChangeDueDate: (id: number, due_date: string | null) => void
  subtasksOf: (id: number) => Todo[]
  showDueDateChip: boolean
  forceExpanded?: boolean
}
```

- [ ] **Step 2: Update the component signature and body**

Replace the function signature and add the two new prop usages. The full updated component:

```typescript
import { useState } from 'react'
import type { Todo, Category } from '../types'
import { DueDateChip } from './DueDateChip'

interface Props {
  todo: Todo
  subtasks: Todo[]
  categories: Category[]
  onToggle: (id: number, done: boolean) => void
  onDelete: (id: number) => void
  onAddChild: (text: string, parent_id: number) => void
  onChangeCategory: (id: number, category_id: number | null) => void
  onChangeDueDate: (id: number, due_date: string | null) => void
  subtasksOf: (id: number) => Todo[]
  showDueDateChip: boolean
  forceExpanded?: boolean
}

export function TodoItem({ todo, subtasks, categories, onToggle, onDelete, onAddChild, onChangeCategory, onChangeDueDate, subtasksOf, showDueDateChip, forceExpanded = false }: Props) {
  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`collapsed:${todo.id}`) === 'true'
  )
  const [input, setInput] = useState('')

  const cat = categories.find(c => c.id === todo.category_id) ?? null
  const isExpanded = forceExpanded || !collapsed

  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    await onAddChild(text, todo.id)
    setInput('')
    setAdding(false)
  }

  function toggleCollapse() {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem(`collapsed:${todo.id}`, String(next))
      return next
    })
  }

  return (
    <li>
      <div className={`todo-row${todo.done ? ' done' : ''}`}>
        <button
          className="check"
          onClick={() => onToggle(todo.id, todo.done)}
          aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
        >
          {todo.done ? '✓' : ''}
        </button>
        <span className="todo-text">
          <span className="todo-label">{todo.text}</span>
          {todo.created_at && (
            <time className="created-at">Created {new Date(todo.created_at).toLocaleString()}</time>
          )}
          {todo.done && todo.completed_at && (
            <time className="completed-at">Completed {new Date(todo.completed_at).toLocaleString()}</time>
          )}
        </span>
        {showDueDateChip && (
          <DueDateChip
            dueDate={todo.due_date}
            onChange={due_date => onChangeDueDate(todo.id, due_date)}
          />
        )}
        {categories.length > 0 && (
          <span className={`todo-cat${cat ? ' has-cat' : ''}`}>
            <select
              value={todo.category_id ?? ''}
              onChange={e => onChangeCategory(todo.id, e.target.value ? Number(e.target.value) : null)}
              aria-label="Set category"
            >
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {cat && <span className="cat-dot" style={{ background: cat.color }} />}
            {cat ? cat.name : '+'}
          </span>
        )}
        {subtasks.length > 0 && !forceExpanded && (
          <button className="collapse" onClick={toggleCollapse} aria-label={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '▶' : '▼'}
          </button>
        )}
        {!todo.done && (
          <button className="add-child" onClick={() => setAdding(v => !v)} aria-label="Add subtask">+</button>
        )}
        <button className="delete" onClick={() => onDelete(todo.id)} aria-label="Delete task">×</button>
      </div>
      {adding && (
        <form onSubmit={handleAddChild} className="child-form">
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Add subtask..."
            aria-label="New subtask"
          />
          <button type="submit">Add</button>
          <button type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      )}
      {subtasks.length > 0 && isExpanded && (
        <ul className="todo-list child-list">
          {subtasks.map(child => (
            <TodoItem
              key={child.id}
              todo={child}
              subtasks={subtasksOf(child.id)}
              categories={categories}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onChangeCategory={onChangeCategory}
              onChangeDueDate={onChangeDueDate}
              subtasksOf={subtasksOf}
              showDueDateChip={false}
              forceExpanded={forceExpanded}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npm run build
```

Expected: build fails with errors about missing `onChangeDueDate` and `showDueDateChip` props in `App.tsx` — this is expected; those are added in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/components/TodoItem.tsx
git commit -m "feat: add showDueDateChip and forceExpanded to TodoItem"
```

---

## Task 5: `CalendarPanel` component

**Files:**
- Create: `src/components/CalendarPanel.tsx`
- Modify: `src/App.css` (calendar panel styles only)

- [ ] **Step 1: Create `src/components/CalendarPanel.tsx`**

```typescript
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import type { Todo } from '../types'

interface Props {
  todos: Todo[]
  selectedDate: Date | null
  onDateSelect: (date: Date | null) => void
  open: boolean
  onToggle: () => void
}

function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function CalendarPanel({ todos, selectedDate, onDateSelect, open, onToggle }: Props) {
  const dueDates = todos
    .filter(t => t.parent_id === null && t.due_date !== null)
    .map(t => toDate(t.due_date!))

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onDateSelect(null)
      return
    }
    onDateSelect(date)
  }

  return (
    <aside className={`calendar-panel${open ? ' open' : ''}`}>
      <button
        className="calendar-toggle"
        onClick={onToggle}
        aria-label={open ? 'Collapse calendar' : 'Expand calendar'}
      >
        {open ? '◀' : '▶'}
      </button>
      {open && (
        <DayPicker
          mode="single"
          selected={selectedDate ?? undefined}
          onSelect={handleSelect}
          modifiers={{ hasTasks: dueDates }}
          modifiersClassNames={{ hasTasks: 'day-has-tasks' }}
        />
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Add calendar panel styles to `src/App.css`**

Append to the end of `src/App.css` (after the due-chip styles added in Task 3):

```css
.app-layout {
  display: flex;
  align-items: flex-start;
  min-height: 100vh;
}

.calendar-panel {
  width: 44px;
  flex-shrink: 0;
  padding: 60px 8px 0;
  border-right: 1px solid var(--border);
  position: sticky;
  top: 0;
  min-height: 100vh;
  box-sizing: border-box;

  &.open {
    width: 280px;
    padding: 60px 16px 0;
  }
}

.calendar-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  font-size: 11px;
  padding: 4px 7px;
  display: block;
  margin-bottom: 12px;
  font-family: var(--sans);

  &:hover {
    color: var(--text-h);
    border-color: var(--text-h);
  }
}

.day-has-tasks {
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    display: block;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: still fails on `App.tsx` type errors from Task 4 — that's fine; wired up in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/components/CalendarPanel.tsx src/App.css
git commit -m "feat: add CalendarPanel component"
```

---

## Task 6: App layout, state, and date filtering

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css` (main panel styles)

- [ ] **Step 1: Update `src/App.css` — change `main` to `main-panel`**

Replace the existing `main` rule at the top of `App.css`:

```css
/* replace: */
main {
  width: 540px;
  max-width: 100%;
  margin: 60px auto;
  padding: 0 20px;
  box-sizing: border-box;
}
```

with:

```css
.main-panel {
  flex: 1;
  min-width: 0;
  max-width: 580px;
  padding: 60px 24px 0;
  box-sizing: border-box;
}
```

- [ ] **Step 2: Rewrite `src/App.tsx`**

```typescript
import { useState } from 'react'
import { CategoryBar } from './components/CategoryBar'
import { TodoItem } from './components/TodoItem'
import { CalendarPanel } from './components/CalendarPanel'
import { useTodos } from './hooks/useTodos'
import { useCategories } from './hooks/useCategories'
import './App.css'

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function App() {
  const [input, setInput] = useState('')
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(true)

  const {
    todos,
    pending,
    error: todoError,
    clearError: clearTodoError,
    load: loadTodos,
    subtasksOf,
    addTodo,
    addChild,
    toggleTodo,
    deleteTodo,
    changeCategory,
    changeDueDate,
  } = useTodos()

  const {
    categories,
    error: catError,
    clearError: clearCatError,
    addCategory,
    deleteCategory: deleteCategoryBase,
  } = useCategories()

  const error = todoError ?? catError
  const clearError = () => { clearTodoError(); clearCatError() }

  async function handleAddTodo(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    await addTodo(text, activeCat)
  }

  async function handleDeleteTodo(id: number) {
    if (!window.confirm('Delete this task and all its subtasks?')) return
    await deleteTodo(id)
  }

  async function handleDeleteCategory(id: number) {
    await deleteCategoryBase(id)
    await loadTodos()
    if (activeCat === id) setActiveCat(null)
  }

  const topLevel = todos.filter(t => {
    if (t.parent_id) return false
    if (activeCat !== null && t.category_id !== activeCat) return false
    if (selectedDate !== null && t.due_date !== toDateStr(selectedDate)) return false
    return true
  })

  const activeCatObj = categories.find(c => c.id === activeCat) ?? null

  return (
    <div className="app-layout">
      <CalendarPanel
        todos={todos}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        open={calendarOpen}
        onToggle={() => setCalendarOpen(v => !v)}
      />
      <main className="main-panel">
        <h1>TODO Build by Claude Code</h1>
        {error && (
          <p className="error">
            {error}
            <button onClick={clearError}>×</button>
          </p>
        )}
        <form onSubmit={handleAddTodo} className="add-form">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Add a task..."
            aria-label="New task"
            disabled={pending}
          />
          <button type="submit" disabled={pending}>Add</button>
        </form>
        <CategoryBar
          categories={categories}
          activeCat={activeCat}
          onSelect={setActiveCat}
          onAdd={addCategory}
          onDelete={handleDeleteCategory}
        />
        {activeCatObj && (
          <div className="filter-banner">
            <span className="cat-dot" style={{ background: activeCatObj.color }} />
            Showing tasks in <strong>{activeCatObj.name}</strong>
            <button onClick={() => setActiveCat(null)} aria-label="Clear filter">× Clear filter</button>
          </div>
        )}
        {selectedDate && (
          <div className="filter-banner">
            Tasks due <strong>{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
            <span style={{ marginLeft: 4 }}>· {topLevel.length} {topLevel.length === 1 ? 'task' : 'tasks'}</span>
            <button onClick={() => setSelectedDate(null)}>✕ Clear filter</button>
          </div>
        )}
        {topLevel.length === 0 && <p className="empty">{selectedDate ? 'No tasks due on this day.' : 'No tasks yet.'}</p>}
        <ul className="todo-list">
          {topLevel.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              subtasks={subtasksOf(todo.id)}
              categories={categories}
              onToggle={toggleTodo}
              onDelete={handleDeleteTodo}
              onAddChild={addChild}
              onChangeCategory={changeCategory}
              onChangeDueDate={changeDueDate}
              subtasksOf={subtasksOf}
              showDueDateChip={selectedDate === null}
              forceExpanded={selectedDate !== null}
            />
          ))}
        </ul>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Run the backend tests to confirm nothing broke**

```bash
npm test
```

Expected: all 32 tests pass.

- [ ] **Step 5: Manual smoke test**

Start the dev server (`npm run dev`) and verify:
1. Calendar panel appears on the left, toggle button collapses it to a narrow strip
2. Adding a task shows a `+ due date` chip on the row
3. Clicking the chip opens a date picker; selecting a date shows the formatted date in the chip
4. The selected date now shows a blue dot on the calendar
5. Clicking that date in the calendar filters the main panel to show only that task with its children expanded and no collapse toggle
6. `✕ Clear filter` returns to the full list
7. Clicking `✕` on the chip clears the due date (dot disappears from calendar)
8. Overdue tasks show a red chip

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: wire up calendar panel, date filtering, and due date layout"
```

---

## Done

All tasks complete. The feature is live at `http://localhost:5173`.
