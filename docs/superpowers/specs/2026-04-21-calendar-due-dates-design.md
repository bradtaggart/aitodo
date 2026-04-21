# Calendar & Due Dates — Design Spec

**Date:** 2026-04-21

## Overview

Add due dates to top-level tasks and a collapsible calendar side panel that lets users navigate to tasks by date. Selecting a date in the calendar filters the main task view to show only tasks due that day, with their full child trees expanded.

---

## Data Layer

### Database

- Add `due_date TEXT` column to `todos` table (nullable, ISO date format `YYYY-MM-DD`)
- Migration added to `initDb` using the existing ALTER TABLE pattern (safe to run on populated databases)
- Only top-level tasks expose due dates in the UI; the column exists on all rows but child task due dates are never set or read

### API

- **GET `/api/todos`** — no change; `due_date` returned automatically via `SELECT *`
- **PATCH `/api/todos/:id`** — extended to accept `due_date: string | null`; follows the existing `category_id` pattern (check `'due_date' in req.body` to distinguish unset from null)

### Types (`src/types.ts`)

Add `due_date: string | null` to the `Todo` interface.

---

## Components

### `CalendarPanel.tsx` (new)

Wraps `react-day-picker`'s `<DayPicker>` in single-select mode.

**Props:**
- `todos: Todo[]` — derives highlighted dates from top-level todos with a non-null `due_date`
- `selectedDate: Date | null`
- `onDateSelect: (date: Date | null) => void` — called with `null` when the selected date is clicked again (deselect)
- `open: boolean`
- `onToggle: () => void`

**Behavior:**
- Days with at least one due task get a blue dot via react-day-picker `modifiers` + `modifiersStyles`
- Selected day gets a solid blue highlight (themed to match the app)
- Collapsed state: panel shrinks to a narrow strip with just the toggle button (◀ / ▶); full width when open (~200px)
- Month navigation built into react-day-picker

### `DueDateChip.tsx` (new)

**Props:**
- `dueDate: string | null`
- `onChange: (date: string | null) => void`

**Behavior:**
- Three visual states:
  - **No date:** faint dashed chip, `+ due date`
  - **Date set, not overdue:** blue chip with `MMM D` formatted date and `✕`
  - **Overdue:** red chip with same layout
- Clicking chip (except `✕`) opens a react-day-picker popover pre-selected to current date
- Clicking `✕` calls `onChange(null)` immediately, no popover
- Popover dismisses on outside click

### `TodoItem.tsx` (modified)

- Accepts new prop `showDueDateChip: boolean`
- Renders `<DueDateChip>` after the task text when `showDueDateChip` is true
- `showDueDateChip` is true only for top-level items when no date filter is active

### `App.tsx` (modified)

**New state:**
- `selectedDate: Date | null` — currently selected calendar date
- `calendarOpen: boolean` — whether the calendar panel is expanded

**Layout:**
- Flex row: `<CalendarPanel>` (left, fixed width when open) + task list (right, flex-grow)

**Filtering logic:**
- `selectedDate === null` → show all todos (current behavior)
- `selectedDate` set → filter top-level todos to those whose `due_date` matches the selected date (compare as `YYYY-MM-DD` strings); render with children always expanded (collapse toggle hidden in this view)
- Filter header: "Tasks due [Apr 21]" · "[N] tasks" · `✕ clear filter` button

**`showDueDateChip` logic:**
- `true` when: item is top-level (`parent_id === null`) AND `selectedDate === null`
- `false` otherwise (date is obvious in filtered view; never shown on child tasks)

---

## File Inventory

| File | Change |
|------|--------|
| `server.ts` | Add `due_date` migration; extend PATCH handler |
| `server.test.ts` | Add tests for due_date PATCH |
| `src/types.ts` | Add `due_date: string \| null` to `Todo` |
| `src/api.ts` | Extend `patchTodo` to accept `due_date` |
| `src/hooks/useTodos.ts` | Minor type updates |
| `src/App.tsx` | Two-panel layout, `selectedDate` + `calendarOpen` state, filtering logic |
| `src/components/TodoItem.tsx` | Add `showDueDateChip` prop, render `DueDateChip` |
| `src/components/CalendarPanel.tsx` | New |
| `src/components/DueDateChip.tsx` | New |

**New dependency:** `react-day-picker` (for both calendar panel and date picker popover)

---

## Out of Scope

- Child tasks do not have due dates
- No recurring due dates
- No reminders or notifications
- Due dates on the "all tasks" view remain visible (chip on each top-level task); the calendar is an additional navigation layer, not a replacement view
