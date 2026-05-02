# Edit Task Title

**Date:** 2026-05-02

## Overview

Allow users to edit a task's title inline by clicking on it — consistent with the existing `DescriptionField` click-to-edit pattern.

## Approach

Inline editing state lives directly in `TodoItem`. No new component is introduced.

## Changes

### `src/components/TodoItem.tsx`

- Add `onChangeTitle: (id: number, text: string) => void` to the `Props` interface.
- Add `editing: boolean` and `draft: string` local state.
- Replace `<span className="todo-label">{todo.text}</span>` with:
  - When not editing: a `<button>` that sets `editing = true` on click.
  - When editing: a text `<input>` with `autoFocus`, pre-filled with the current title.
- **Save (blur):** if `draft.trim()` is non-empty and differs from `todo.text`, call `onChangeTitle(todo.id, draft.trim())`. Then exit edit mode.
- **Cancel (Esc):** revert draft to `todo.text`, exit edit mode without saving.
- **Empty value:** reject save, revert to original.
- Applies to both top-level tasks and subtasks.

### `src/hooks/useTodos.ts`

- Add `changeTitle(id: number, text: string)` that calls `patchTodo(id, { text })`.
- Expose `changeTitle` in the hook's return value.

### `src/api.ts`

- Extend the `patchTodo` type to include `text` in its `Partial<Pick<Todo, ...>>`.

### `server.ts`

- Accept `text` in `PATCH /api/todos/:id`.
- If `text` is present, include it in the SQL UPDATE (validated server-side: must be non-empty string).

### `src/App.tsx`

- Pass `onChangeTitle={changeTitle}` to each `<TodoItem>`.

## Edge Cases

- Blank title → revert, no API call.
- Unchanged title → no API call on blur.
- Done tasks → remain editable.
