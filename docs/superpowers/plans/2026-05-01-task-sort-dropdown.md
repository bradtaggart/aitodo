# Task Sort Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current priority-only sort toggle with a dropdown that sorts top-level tasks by newest first, due date, category, or priority.

**Architecture:** Keep sorting client-side. Extract sorting into a pure utility so behavior is testable without rendering React, then wire `App.tsx` to the helper and replace the existing sort button with a select control.

**Tech Stack:** React 19, Vite 8, TypeScript, Vitest, ESLint.

---

## File Structure

- Modify `src/App.tsx`: replace `sortByPriority` boolean state and inline sort with a `sortMethod` select.
- Create `src/utils/sortTodos.ts`: pure task sorting helper and `SortMethod` type.
- Create `src/utils/sortTodos.test.ts`: unit tests for sort behavior.
- Modify `src/App.css`: replace `.sort-priority-btn` styles with compact sort-select styles.
- Modify `vitest.config.ts`: exclude `.claude/**` so local worktree copies are not discovered as duplicate tests.

### Task 1: Add Pure Sort Helper

**Files:**
- Create: `src/utils/sortTodos.ts`
- Test: `src/utils/sortTodos.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/sortTodos.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Category, Todo } from '../types'
import { sortTodos, type SortMethod } from './sortTodos'

const baseTodo = (overrides: Partial<Todo>): Todo => ({
  id: 1,
  text: 'task',
  done: false,
  completed_at: null,
  created_at: '2026-05-01T00:00:00.000Z',
  parent_id: null,
  category_id: null,
  due_date: null,
  description: null,
  template_id: null,
  priority: null,
  ...overrides,
})

const ids = (method: SortMethod, todos: Todo[], categories: Category[] = []) =>
  sortTodos(todos, categories, method).map(t => t.id)

describe('sortTodos', () => {
  it('sorts newest first by id', () => {
    expect(ids('newest', [
      baseTodo({ id: 1 }),
      baseTodo({ id: 3 }),
      baseTodo({ id: 2 }),
    ])).toEqual([3, 2, 1])
  })

  it('sorts due dates ascending and places missing due dates last', () => {
    expect(ids('dueDate', [
      baseTodo({ id: 1, due_date: null }),
      baseTodo({ id: 2, due_date: '2026-05-03' }),
      baseTodo({ id: 3, due_date: '2026-05-01' }),
      baseTodo({ id: 4, due_date: null }),
    ])).toEqual([3, 2, 4, 1])
  })

  it('sorts categories by category bar order and places uncategorized last', () => {
    const categories: Category[] = [
      { id: 20, name: 'Home', color: '#22c55e' },
      { id: 10, name: 'Work', color: '#3b82f6' },
    ]

    expect(ids('category', [
      baseTodo({ id: 1, category_id: null }),
      baseTodo({ id: 2, category_id: 10 }),
      baseTodo({ id: 3, category_id: 20 }),
      baseTodo({ id: 4, category_id: 10 }),
    ], categories)).toEqual([3, 4, 2, 1])
  })

  it('sorts priority high, medium, low, then no priority', () => {
    expect(ids('priority', [
      baseTodo({ id: 1, priority: null }),
      baseTodo({ id: 2, priority: 'low' }),
      baseTodo({ id: 3, priority: 'high' }),
      baseTodo({ id: 4, priority: 'medium' }),
      baseTodo({ id: 5, priority: 'high' }),
    ])).toEqual([5, 3, 4, 2, 1])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- src/utils/sortTodos.test.ts
```

Expected: FAIL because `src/utils/sortTodos.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/utils/sortTodos.ts`:

```ts
import type { Category, Todo } from '../types'

export type SortMethod = 'newest' | 'dueDate' | 'category' | 'priority'

const PRIORITY_ORDER: Record<NonNullable<Todo['priority']>, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const newestFirst = (a: Todo, b: Todo) => b.id - a.id

export function sortTodos(todos: Todo[], categories: Category[], method: SortMethod): Todo[] {
  const categoryOrder = new Map(categories.map((cat, index) => [cat.id, index]))

  return [...todos].sort((a, b) => {
    switch (method) {
      case 'dueDate': {
        if (a.due_date && b.due_date && a.due_date !== b.due_date) {
          return a.due_date.localeCompare(b.due_date)
        }
        if (a.due_date && !b.due_date) return -1
        if (!a.due_date && b.due_date) return 1
        return newestFirst(a, b)
      }
      case 'category': {
        const ca = a.category_id === null ? Number.POSITIVE_INFINITY : categoryOrder.get(a.category_id) ?? Number.POSITIVE_INFINITY
        const cb = b.category_id === null ? Number.POSITIVE_INFINITY : categoryOrder.get(b.category_id) ?? Number.POSITIVE_INFINITY
        if (ca !== cb) return ca - cb
        return newestFirst(a, b)
      }
      case 'priority': {
        const pa = a.priority ? PRIORITY_ORDER[a.priority] : Number.POSITIVE_INFINITY
        const pb = b.priority ? PRIORITY_ORDER[b.priority] : Number.POSITIVE_INFINITY
        if (pa !== pb) return pa - pb
        return newestFirst(a, b)
      }
      case 'newest':
        return newestFirst(a, b)
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- src/utils/sortTodos.test.ts
```

Expected: PASS for `src/utils/sortTodos.test.ts`.

### Task 2: Wire Dropdown Into App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace sorting state and imports**

Update imports and state in `src/App.tsx`:

```tsx
import { sortTodos, type SortMethod } from './utils/sortTodos'
```

Replace:

```tsx
const [sortByPriority, setSortByPriority] = useState(false)
```

With:

```tsx
const [sortMethod, setSortMethod] = useState<SortMethod>('newest')
```

- [ ] **Step 2: Replace inline sort logic**

Remove `PRIORITY_ORDER` from `App.tsx`.

Replace the existing `.sort(...)` chain with:

```tsx
const topLevel = sortTodos(
  todos.filter(t => {
    if (t.parent_id) return false
    if (activeCat !== null && t.category_id !== activeCat) return false
    if (selectedDate !== null && t.due_date !== toDateStr(selectedDate)) return false
    return true
  }),
  categories,
  sortMethod
)
```

- [ ] **Step 3: Replace sort button with select**

Replace the current `sort-priority-btn` button in the add form with:

```tsx
<label className="sort-select-wrap">
  <span>Sort</span>
  <select
    value={sortMethod}
    onChange={e => setSortMethod(e.target.value as SortMethod)}
    aria-label="Sort tasks"
  >
    <option value="newest">Newest first</option>
    <option value="dueDate">Date due</option>
    <option value="category">Category</option>
    <option value="priority">Priority</option>
  </select>
</label>
```

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no unused variables or import errors.

### Task 3: Style Dropdown and Stabilize Test Discovery

**Files:**
- Modify: `src/App.css`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Replace old sort button CSS**

Remove the `.sort-priority-btn` rules and add:

```css
.sort-select-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.45rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 0.9rem;
}

.sort-select-wrap span {
  font-weight: 600;
}

.sort-select-wrap select {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  outline: none;
}
```

- [ ] **Step 2: Exclude local worktree copies from Vitest**

Update `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run lint
npm run build
npm run test
```

Expected:
- Lint passes.
- Build passes.
- Test output discovers only the intended repo tests, including `server.test.ts` and `src/utils/sortTodos.test.ts`, not `.claude/worktrees/**`.

### Task 4: Commit

**Files:**
- Commit all implementation files after verification.

- [ ] **Step 1: Review diff**

Run:

```bash
git diff -- src/App.tsx src/App.css src/utils/sortTodos.ts src/utils/sortTodos.test.ts vitest.config.ts
```

Expected: diff only contains the sort dropdown feature, pure helper, tests, and Vitest exclude.

- [ ] **Step 2: Commit**

Run:

```bash
git add src/App.tsx src/App.css src/utils/sortTodos.ts src/utils/sortTodos.test.ts vitest.config.ts
git commit -m "feat: add task sort dropdown"
```

Expected: commit succeeds.

## Acceptance Criteria

- The app starts with tasks sorted newest-first.
- The add form includes a dropdown with `Newest first`, `Date due`, `Category`, and `Priority`.
- Due-date sorting puts dated tasks first in ascending date order and undated tasks last.
- Category sorting follows the existing category bar order and puts uncategorized tasks last.
- Priority sorting orders high, medium, low, then no priority.
- Category/date filters still apply before sorting.
- Subtasks retain existing behavior and are not independently sorted by the dropdown.
