# Task Descriptions

**Date:** 2026-04-22

## Summary

Add a plain-text description field to every todo item (parent and child). The description is always visible below the task title — showing a dim placeholder when empty — and is edited in-place by clicking it.

## Interaction Model

- Description sits below the task row, indented ~50px to align under the task title text.
- **Empty state:** light italic placeholder "Add a description…"
- **Resting state (has text):** plain text rendered in a subdued color, cursor pointer.
- **Editing state:** textarea with accent border replaces the text. A hint below reads "Click away to save · Esc to cancel".
- **Save:** on blur — trims whitespace; saves null if empty.
- **Cancel:** Escape key — resets draft to the last saved value without saving.
- Applies to both parent and child tasks.
- No markdown or rich text — plain text only.

## Data Layer

### Database (`server.ts`)

- Add `description TEXT` column to the `todos` table, nullable, default null.
- Add migration guard using the existing column-check pattern:
  ```ts
  if (!todoCols.includes('description')) db.exec('ALTER TABLE todos ADD COLUMN description TEXT')
  ```
- Include `description` in the `TodoRow` interface.
- Include `description` in the `SELECT *` response (already covered by `SELECT *`).
- Expose `description` through `PATCH /api/todos/:id` — add a `description` branch alongside the existing `done`, `category_id`, and `due_date` branches. Validate that description is a string or null.
- Add a `updateDescription` prepared statement:
  ```ts
  updateDescription: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET description = ? WHERE id = ?')
  ```

### Types (`src/types.ts`)

Add `description: string | null` to the `Todo` interface.

### API client (`src/api.ts`)

Add `description` to `patchTodo`'s `Partial<Pick<Todo, ...>>` union.

### Hook (`src/hooks/useTodos.ts`)

Add `changeDescription(id: number, description: string | null)` — calls `api.patchTodo(id, { description })` via `withPending`.

## Components

### `src/components/DescriptionField.tsx` (new)

Props:
```ts
interface Props {
  value: string | null
  onChange: (v: string | null) => void
}
```

- Manages local `editing: boolean` and `draft: string` state.
- Clicking the display text sets `editing = true`.
- `onBlur`: calls `onChange(draft.trim() || null)`, sets `editing = false`.
- `onKeyDown` Escape: resets `draft` to current `value`, sets `editing = false`.
- Renders a `<textarea>` in editing state, a `<div>` otherwise.
- When not editing and value is null/empty, renders placeholder text in italic/dim style.

### `src/components/TodoItem.tsx` (modified)

- Add `onChangeDescription: (id: number, description: string | null) => void` to Props.
- Render `<DescriptionField value={todo.description} onChange={d => onChangeDescription(todo.id, d)} />` below `.todo-row`.
- Pass `onChangeDescription` down to child `<TodoItem>` instances.

### `src/App.tsx` (modified)

- Wire `changeDescription` from `useTodos` into `TodoItem` as `onChangeDescription`.

## Styling (`src/App.css`)

- `.description-field` — padding `0 14px 10px 50px`, no top padding (sits directly below the row).
- `.description-display` — `font-size: 13px`, `color: var(--text)`, `cursor: pointer`, `line-height: 1.5`, `border-radius: 4px`.
- `.description-display.empty` — `color: var(--border)`, `font-style: italic`.
- `.description-display:hover` — subtle background highlight (`var(--code-bg)`).
- `.description-textarea` — full width, `box-sizing: border-box`, `font-size: 13px`, `font-family: var(--sans)`, `border: 1px solid var(--accent)`, `border-radius: 6px`, `padding: 6px 8px`, `resize: vertical`, `min-height: 56px`, `color: var(--text-h)`, `background: var(--bg)`.
- `.description-hint` — `font-size: 11px`, `color: var(--text)`, `margin-top: 4px`.

## Error Handling

- Save errors surface through the existing `useTodos` error state (shown in the top-level error banner in `App.tsx`).
- If the PATCH fails, the optimistic local state is not updated — the hook re-fetches the full todo list via `load()` after every `withPending` call, so the UI will revert to the server value automatically.

## Out of Scope

- Markdown / rich text rendering.
- Title editing.
- Description search or filtering.
