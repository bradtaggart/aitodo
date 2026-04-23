# Task Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plain-text, always-visible, click-to-edit description field to every todo item (parent and child).

**Architecture:** Description is stored as a nullable TEXT column in SQLite, exposed via the existing PATCH endpoint, surfaced through a new `DescriptionField` component rendered inside `TodoItem` below the task row. Editing state lives entirely in `DescriptionField` — saves on blur, cancels on Escape.

**Tech Stack:** Express + better-sqlite3 (backend), React 19 + TypeScript + Vite (frontend), plain CSS custom properties for theming.

> **Note:** No test runner is configured in this project (`CLAUDE.md`). TDD steps are replaced with dev-server manual verification. After each task that changes runtime behaviour, start the server and verify the change works before committing.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `server.ts` | DB migration, prepared stmt, PATCH handler |
| Modify | `src/types.ts` | Add `description` to `Todo` interface |
| Modify | `src/api.ts` | Add `description` to `patchTodo` Pick type |
| Modify | `src/hooks/useTodos.ts` | Add `changeDescription` function |
| Modify | `src/App.css` | Styles for description field, display, textarea |
| **Create** | `src/components/DescriptionField.tsx` | Isolated editing component |
| Modify | `src/components/TodoItem.tsx` | Render `DescriptionField`, add prop |
| Modify | `src/App.tsx` | Wire `changeDescription` into `TodoItem` |

---

## Task 1: Add `description` column + PATCH support to the server

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Add `description` to `TodoRow` interface**

In `server.ts`, update the `TodoRow` interface (lines 7–16):

```ts
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
}
```

- [ ] **Step 2: Add migration guard in `initDb`**

In `initDb`, after the `due_date` migration guard (line 55), add:

```ts
if (!todoCols.includes('description')) db.exec('ALTER TABLE todos ADD COLUMN description TEXT')
```

- [ ] **Step 3: Add `updateDescription` prepared statement**

In the `stmts` object inside `createApp`, after `updateDueDate`:

```ts
updateDescription: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET description = ? WHERE id = ?'),
```

- [ ] **Step 4: Update PATCH body destructuring**

Replace line 111 in the PATCH handler:

```ts
// before
const { done, category_id, due_date } = req.body as { done?: boolean; category_id?: number | null; due_date?: string | null }

// after
const { done, category_id, due_date, description } = req.body as {
  done?: boolean
  category_id?: number | null
  due_date?: string | null
  description?: string | null
}
```

- [ ] **Step 5: Add description branch in PATCH handler**

After the `due_date` branch (after line 130), add:

```ts
if ('description' in req.body) {
  stmts.updateDescription.run(description ?? null, Number(req.params.id))
}
```

- [ ] **Step 6: Verify server changes manually**

Start the API server:
```bash
npx ts-node --esm server.ts
# or however you normally start it — check package.json for the server script
```

In a second terminal, create a todo and patch its description:
```bash
# Create a todo
curl -s -X POST http://localhost:3001/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"text":"test task"}' | jq .

# Note the returned id (e.g. 1), then patch description
curl -s -X PATCH http://localhost:3001/api/todos/1 \
  -H 'Content-Type: application/json' \
  -d '{"description":"hello world"}' | jq .
# Expected: {"ok":true}

# Verify it was saved
curl -s http://localhost:3001/api/todos | jq '.[] | select(.id==1) | .description'
# Expected: "hello world"
```

Stop the server after verifying.

- [ ] **Step 7: Commit**

```bash
git add server.ts
git commit -m "feat: add description column to todos and expose via PATCH endpoint"
```

---

## Task 2: Update TypeScript types and API client

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api.ts`

- [ ] **Step 1: Add `description` to the `Todo` interface**

In `src/types.ts`, update the `Todo` interface:

```ts
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
}
```

- [ ] **Step 2: Add `description` to `patchTodo`'s Pick type**

In `src/api.ts`, update the `patchTodo` export:

```ts
export const patchTodo = (id: number, patch: Partial<Pick<Todo, 'done' | 'category_id' | 'due_date' | 'description'>>) =>
  request<{ ok: true }>(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
```

- [ ] **Step 3: Check for TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: no errors. If there are errors they will be in files that reference `Todo` — fix them before committing.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/api.ts
git commit -m "feat: add description field to Todo type and patchTodo API"
```

---

## Task 3: Add `changeDescription` to the `useTodos` hook

**Files:**
- Modify: `src/hooks/useTodos.ts`

- [ ] **Step 1: Add `changeDescription` function**

In `src/hooks/useTodos.ts`, add after `changeDueDate`:

```ts
const changeDescription = (id: number, description: string | null) =>
  withPending(() => api.patchTodo(id, { description }))
```

- [ ] **Step 2: Export it from the hook's return object**

Add `changeDescription` to the return statement:

```ts
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
  changeDescription,
}
```

- [ ] **Step 3: Check for TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTodos.ts
git commit -m "feat: add changeDescription to useTodos hook"
```

---

## Task 4: Add CSS styles for the description field

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add description styles**

Append to the end of `src/App.css`:

```css
.description-field {
  padding: 0 14px 10px 50px;
}

.description-display {
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  line-height: 1.5;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;

  &.empty {
    color: var(--border);
    font-style: italic;
  }

  &:hover {
    background: var(--code-bg);
  }
}

.description-textarea {
  width: 100%;
  box-sizing: border-box;
  font-size: 13px;
  font-family: var(--sans);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 6px 8px;
  resize: vertical;
  min-height: 56px;
  color: var(--text-h);
  background: var(--bg);
  display: block;

  &:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

.description-hint {
  font-size: 11px;
  color: var(--text);
  margin-top: 4px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.css
git commit -m "feat: add description field CSS styles"
```

---

## Task 5: Create the `DescriptionField` component

**Files:**
- Create: `src/components/DescriptionField.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState } from 'react'

interface Props {
  value: string | null
  onChange: (v: string | null) => void
}

export function DescriptionField({ value, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  function startEditing() {
    setDraft(value ?? '')
    setEditing(true)
  }

  function handleBlur() {
    onChange(draft.trim() || null)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(value ?? '')
      setEditing(false)
    }
  }

  return (
    <div className="description-field">
      {editing ? (
        <>
          <textarea
            autoFocus
            className="description-textarea"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <div className="description-hint">Click away to save · Esc to cancel</div>
        </>
      ) : (
        <div
          className={`description-display${value ? '' : ' empty'}`}
          onClick={startEditing}
          role="button"
          aria-label={value ? 'Edit description' : 'Add description'}
        >
          {value || 'Add a description…'}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check for TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DescriptionField.tsx
git commit -m "feat: add DescriptionField component"
```

---

## Task 6: Wire `DescriptionField` into `TodoItem`

**Files:**
- Modify: `src/components/TodoItem.tsx`

- [ ] **Step 1: Add import**

Add to the imports at the top of `src/components/TodoItem.tsx`:

```ts
import { DescriptionField } from './DescriptionField'
```

- [ ] **Step 2: Add `onChangeDescription` to the Props interface**

```ts
interface Props {
  todo: Todo
  subtasks: Todo[]
  categories: Category[]
  onToggle: (id: number, done: boolean) => void
  onDelete: (id: number) => void
  onAddChild: (text: string, parent_id: number) => void
  onChangeCategory: (id: number, category_id: number | null) => void
  onChangeDueDate: (id: number, due_date: string | null) => void
  onChangeDescription: (id: number, description: string | null) => void
  subtasksOf: (id: number) => Todo[]
  showDueDateChip: boolean
  forceExpanded?: boolean
}
```

- [ ] **Step 3: Destructure the new prop in the component signature**

```ts
export function TodoItem({ todo, subtasks, categories, onToggle, onDelete, onAddChild, onChangeCategory, onChangeDueDate, onChangeDescription, subtasksOf, showDueDateChip, forceExpanded = false }: Props) {
```

- [ ] **Step 4: Render `DescriptionField` below `.todo-row`**

After the closing `</div>` of `.todo-row` and before the `{adding && ...}` block, add:

```tsx
<DescriptionField
  value={todo.description}
  onChange={description => onChangeDescription(todo.id, description)}
/>
```

The `return` block should look like:

```tsx
return (
  <li>
    <div className={`todo-row${todo.done ? ' done' : ''}`}>
      {/* ... existing row content unchanged ... */}
    </div>
    <DescriptionField
      value={todo.description}
      onChange={description => onChangeDescription(todo.id, description)}
    />
    {adding && (
      <form onSubmit={handleAddChild} className="child-form">
        {/* ... unchanged ... */}
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
            onChangeDescription={onChangeDescription}
            subtasksOf={subtasksOf}
            showDueDateChip={false}
            forceExpanded={forceExpanded}
          />
        ))}
      </ul>
    )}
  </li>
)
```

- [ ] **Step 5: Check for TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: error in `src/App.tsx` — `onChangeDescription` prop missing on `<TodoItem>`. This is expected and will be fixed in Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/components/TodoItem.tsx
git commit -m "feat: render DescriptionField in TodoItem"
```

---

## Task 7: Wire into `App.tsx` and verify end-to-end

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Destructure `changeDescription` from `useTodos`**

In `src/App.tsx`, update the `useTodos` destructure block:

```ts
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
  changeDescription,
} = useTodos()
```

- [ ] **Step 2: Pass `onChangeDescription` to `<TodoItem>`**

In the `topLevel.map(...)` JSX, add the new prop:

```tsx
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
  onChangeDescription={changeDescription}
  subtasksOf={subtasksOf}
  showDueDateChip={selectedDate === null}
  forceExpanded={selectedDate !== null}
/>
```

- [ ] **Step 3: Check for TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Start dev server and verify end-to-end**

```bash
npm run dev
```

Open http://localhost:5173 and verify:

1. Every task shows an "Add a description…" placeholder below the task text.
2. Clicking the placeholder opens a textarea with an accent border.
3. Typing text and clicking away saves it — text appears on the card after saving.
4. Clicking saved text re-opens the textarea with existing content.
5. Pressing Escape while editing discards changes and shows the previous value.
6. Clearing all text and clicking away removes the description (placeholder reappears).
7. A child/subtask also has a working description field.
8. Reload the page — descriptions persist (stored in DB).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire task descriptions end-to-end"
```

- [ ] **Step 6: Push**

```bash
git push
```
