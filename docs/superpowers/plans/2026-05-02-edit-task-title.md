# Edit Task Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to click a task's title to edit it inline, saving on blur and cancelling on Esc.

**Architecture:** Inline edit state lives in `TodoItem` (same pattern as `DescriptionField`). A new `updateText` prepared statement is added to the server's PATCH handler. `patchTodo` in the API client gains `text` in its type, `useTodos` gains `changeTitle`, and `App` passes `onChangeTitle` down to `TodoItem`.

**Tech Stack:** React 19, TypeScript, Express, better-sqlite3, Vitest + Supertest

---

### Task 1: Server — add `updateText` statement and handle `text` in PATCH

**Files:**
- Modify: `server.ts`
- Modify: `server.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `server.test.ts` inside a new `describe('PATCH /api/todos/:id text', ...)` block after the existing PATCH tests:

```ts
describe('PATCH /api/todos/:id text', () => {
  it('updates the text of a todo', async () => {
    const create = await request.post('/api/todos').send({ text: 'original' })
    const id = create.body.id
    const patch = await request.patch(`/api/todos/${id}`).send({ text: 'updated title' })
    expect(patch.status).toBe(200)
    expect(patch.body.ok).toBe(true)
    const todos = await request.get('/api/todos')
    const todo = (todos.body as { id: number; text: string }[]).find(t => t.id === id)
    expect(todo?.text).toBe('updated title')
  })

  it('trims whitespace from updated text', async () => {
    const create = await request.post('/api/todos').send({ text: 'original' })
    const id = create.body.id
    await request.patch(`/api/todos/${id}`).send({ text: '  trimmed  ' })
    const todos = await request.get('/api/todos')
    const todo = (todos.body as { id: number; text: string }[]).find(t => t.id === id)
    expect(todo?.text).toBe('trimmed')
  })

  it('rejects blank text with 400', async () => {
    const create = await request.post('/api/todos').send({ text: 'original' })
    const id = create.body.id
    const patch = await request.patch(`/api/todos/${id}`).send({ text: '   ' })
    expect(patch.status).toBe(400)
    expect(patch.body.error).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: 3 new tests fail — `updateText` not implemented yet.

- [ ] **Step 3: Add `updateText` prepared statement to `stmts` in `server.ts`**

In `createApp`, inside the `stmts` object (around line 122), add after `updatePriority`:

```ts
updateText: db.prepare<[string, number], Database.RunResult>('UPDATE todos SET text = ? WHERE id = ?'),
```

- [ ] **Step 4: Handle `text` in the PATCH handler in `server.ts`**

In `app.patch('/api/todos/:id', ...)`, after the `if ('priority' in req.body)` block (around line 235) and before `res.json(...)`, add:

```ts
if ('text' in req.body) {
  const { text } = req.body as { text?: string }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text must be a non-empty string' })
  }
  stmts.updateText.run(text.trim(), Number(req.params.id))
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass including the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add server.ts server.test.ts
git commit -m "feat: accept text in PATCH /api/todos/:id"
```

---

### Task 2: API client — extend `patchTodo` type to include `text`

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: Update `patchTodo` type signature**

In `src/api.ts` at line 25, change:

```ts
export const patchTodo = (id: number, patch: Partial<Pick<Todo, 'done' | 'category_id' | 'due_date' | 'description' | 'priority'>>) =>
```

to:

```ts
export const patchTodo = (id: number, patch: Partial<Pick<Todo, 'text' | 'done' | 'category_id' | 'due_date' | 'description' | 'priority'>>) =>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat: allow patching todo text via API client"
```

---

### Task 3: Hook — add `changeTitle` to `useTodos`

**Files:**
- Modify: `src/hooks/useTodos.ts`

- [ ] **Step 1: Add `changeTitle` function**

In `src/hooks/useTodos.ts`, after the `changePriority` definition (around line 53), add:

```ts
const changeTitle = (id: number, text: string) =>
  withPending(() => api.patchTodo(id, { text }))
```

- [ ] **Step 2: Add `changeTitle` to the return value**

In the return object at the bottom of `useTodos`, add `changeTitle` after `changePriority`:

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
  changePriority,
  changeTitle,
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTodos.ts
git commit -m "feat: add changeTitle to useTodos hook"
```

---

### Task 4: App — wire `changeTitle` into `TodoItem`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Destructure `changeTitle` from `useTodos`**

In `src/App.tsx`, add `changeTitle` to the destructured values from `useTodos()` (around line 48–63):

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
  changePriority,
  changeTitle,
} = useTodos()
```

- [ ] **Step 2: Pass `onChangeTitle` to each `<TodoItem>`**

In the JSX where `<TodoItem>` is rendered (around line 176), add the prop:

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
  onChangePriority={changePriority}
  onChangeTitle={changeTitle}
  onSetRecurrence={handleSetRecurrence}
  onRemoveRecurrence={handleRemoveRecurrence}
  subtasksOf={subtasksOf}
  showDueDateChip={selectedDate === null}
  forceExpanded={selectedDate !== null}
/>
```

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build 2>&1 | head -20
```

Expected: build succeeds. Vite transpiles TypeScript without type-checking, so the missing `onChangeTitle` prop type in `TodoItem` doesn't block the build; it will be added in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: pass onChangeTitle prop to TodoItem"
```

---

### Task 5: TodoItem — inline title editing UI

**Files:**
- Modify: `src/components/TodoItem.tsx`

- [ ] **Step 1: Add `onChangeTitle` to the `Props` interface**

In `src/components/TodoItem.tsx`, add to the `Props` interface (after `onChangePriority`, around line 19):

```ts
onChangeTitle: (id: number, text: string) => void
```

- [ ] **Step 2: Destructure `onChangeTitle` in the function signature**

In the function signature (line 27), add `onChangeTitle` alongside the other props:

```ts
export function TodoItem({ todo, subtasks, categories, templates, onToggle, onDelete, onAddChild, onChangeCategory, onChangeDueDate, onChangeDescription, onChangePriority, onChangeTitle, onSetRecurrence, onRemoveRecurrence, subtasksOf, showDueDateChip, forceExpanded = false }: Props) {
```

- [ ] **Step 3: Add `editingTitle` and `titleDraft` state**

After the existing `useState` declarations at the top of the function body (after line 32), add:

```ts
const [editingTitle, setEditingTitle] = useState(false)
const [titleDraft, setTitleDraft] = useState(todo.text)
```

- [ ] **Step 4: Add title save and cancel handlers**

After the `cyclePriority` function (around line 38), add:

```ts
function handleTitleBlur() {
  const trimmed = titleDraft.trim()
  if (trimmed && trimmed !== todo.text) {
    onChangeTitle(todo.id, trimmed)
  } else {
    setTitleDraft(todo.text)
  }
  setEditingTitle(false)
}

function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Escape') {
    e.preventDefault()
    setTitleDraft(todo.text)
    setEditingTitle(false)
  }
  if (e.key === 'Enter') {
    e.currentTarget.blur()
  }
}
```

- [ ] **Step 5: Pass `onChangeTitle` in the recursive subtask render**

In `TodoItem.tsx`, find the recursive `<TodoItem>` calls in the subtask list (around line 148). Add `onChangeTitle={onChangeTitle}` alongside the other handler props:

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
  onChangePriority={onChangePriority}
  onChangeTitle={onChangeTitle}
  onSetRecurrence={onSetRecurrence}
  onRemoveRecurrence={onRemoveRecurrence}
  subtasksOf={subtasksOf}
  showDueDateChip={false}
  forceExpanded={forceExpanded}
/>
```

- [ ] **Step 6: Replace the title `<span>` with the inline edit UI**

Replace this block in the JSX (around lines 79–87):

```tsx
<span className="todo-text">
  <span className="todo-label">{todo.text}</span>
  {todo.created_at && (
    <time className="created-at">Created {new Date(todo.created_at).toLocaleString()}</time>
  )}
  {todo.done && todo.completed_at && (
    <time className="completed-at">Completed {new Date(todo.completed_at).toLocaleString()}</time>
  )}
</span>
```

with:

```tsx
<span className="todo-text">
  {editingTitle ? (
    <input
      className="todo-label-input"
      autoFocus
      value={titleDraft}
      onChange={e => setTitleDraft(e.target.value)}
      onBlur={handleTitleBlur}
      onKeyDown={handleTitleKeyDown}
      aria-label="Edit task title"
    />
  ) : (
    <button
      className="todo-label"
      onClick={() => { setTitleDraft(todo.text); setEditingTitle(true) }}
      aria-label="Edit task title"
    >
      {todo.text}
    </button>
  )}
  {todo.created_at && (
    <time className="created-at">Created {new Date(todo.created_at).toLocaleString()}</time>
  )}
  {todo.done && todo.completed_at && (
    <time className="completed-at">Completed {new Date(todo.completed_at).toLocaleString()}</time>
  )}
</span>
```

- [ ] **Step 7: Add CSS for the title input in `src/App.css`**

Find the `.todo-label` style and add `.todo-label-input` alongside it. Add after the existing `.todo-label` rule:

```css
.todo-label-input {
  font: inherit;
  font-size: inherit;
  color: inherit;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--accent, #646cff);
  outline: none;
  padding: 0;
  width: 100%;
  min-width: 8ch;
}
```

- [ ] **Step 8: Verify TypeScript compiles and run tests**

```bash
npm run build 2>&1 | head -20 && npm test
```

Expected: clean build, all tests pass.

- [ ] **Step 9: Verify in browser**

Open http://localhost:5173, click a task title, edit it, and confirm:
- Blur saves the new title.
- Esc reverts to the original.
- Blanking the title reverts on blur.
- Works on subtasks too.

- [ ] **Step 10: Commit**

```bash
git add src/components/TodoItem.tsx src/App.css
git commit -m "feat: inline edit task title on click"
```
