# Sort Dropdown Design

**Date:** 2026-05-01  
**Status:** Approved

## Summary

Replace the existing `🚩 Sort` priority toggle button with a `<select>` dropdown that lets the user choose how the task list is sorted. Sorting is client-side only and resets to default on page load.

## Sort Options

| Value | Label | Behavior |
|-------|-------|----------|
| `none` | Default | Newest first (current default: `b.id - a.id`) |
| `due_date` | Due Date | Ascending by due date; tasks with no due date go last |
| `category` | Category | Alphabetical by category name; uncategorized tasks go last |
| `priority` | Priority | High → Medium → Low → no priority |

## Architecture

**New component:** `src/components/SortDropdown.tsx`  
A small controlled `<select>` that receives `value` and `onChange` props. No internal state.

```
type SortBy = 'none' | 'due_date' | 'category' | 'priority'

interface Props {
  value: SortBy
  onChange: (sort: SortBy) => void
}
```

**State in `App.tsx`:**  
Replace `sortByPriority: boolean` with `sortBy: SortBy`, defaulting to `'none'`.

**Sort comparator in `App.tsx`** (inline, next to `topLevel`):  
A `sortTodos` function that takes `(a, b, sortBy, categories)` and returns a number. Lives in `App.tsx` because it needs the `categories` array and is only used in one place.

**Placement:**  
`SortDropdown` replaces the `🚩 Sort` button in the `.add-form` row in `App.tsx`.

## Styling

Match the visual style of the existing `.sort-priority-btn`: same border, border-radius, font-size, and color tokens. Use a `<select>` styled to look like the other compact controls in the form row. No custom dropdown chrome needed.

## What's Removed

- `sortByPriority: boolean` state in `App.tsx`
- `.sort-priority-btn` and `.sort-priority-btn.active` CSS rules in `App.css`
- The `🚩 Sort` button JSX in `App.tsx`

## Out of Scope

- Sort direction toggle (ascending/descending)
- Persistence across page loads
- Server-side sorting
