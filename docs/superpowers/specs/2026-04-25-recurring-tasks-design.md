# Recurring Tasks Design

**Date:** 2026-04-25
**Status:** Approved

## Overview

Add support for recurring tasks (e.g. daily standups, weekly reviews). When a recurring task is completed, a new instance is automatically spawned for the next occurrence. Recurrence is configured on the todo item itself, consistent with how due dates and descriptions are set today.

## Key Decisions

- **Spawn trigger:** Auto-spawn on completion (not pre-generated, not time-based)
- **Scheduling:** Strict — next due date calculated from the current instance's `due_date`, not from the completion date
- **Recurrence patterns:** Daily, Weekly (specific days via bitmask), Monthly (by day-of-month), Custom (every N days)
- **Creation UX:** Recurrence is configured on the todo item after creation, via a "🔁 Repeat" row in the expanded controls (same pattern as due date and description)
- **List indicator:** A chip badge alongside the due date chip (e.g. "weekly", "daily")

## Data Model

### New table: `recurring_templates`

```sql
CREATE TABLE recurring_templates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  text            TEXT NOT NULL,
  category_id     INTEGER REFERENCES categories(id),
  description     TEXT,
  recurrence_type TEXT NOT NULL,   -- 'daily' | 'weekly' | 'monthly' | 'custom'
  day_mask        INTEGER,         -- bitmask Sun=1,Mon=2,Tue=4,Wed=8,Thu=16,Fri=32,Sat=64 (weekly only)
  interval_days   INTEGER,         -- every N days (custom only)
  day_of_month    INTEGER          -- 1–28 (monthly only)
)
```

### Modified table: `todos`

New column: `template_id INTEGER REFERENCES recurring_templates(id)`

Links a todo instance back to its template. When a template is deleted, existing todos retain the `template_id` as a tombstone — no more spawns occur since the template row is gone.

### Next-occurrence calculation (strict, from current instance's `due_date`)

| Type    | Rule |
|---------|------|
| daily   | current due + 1 day |
| weekly  | next day-of-week with its bit set in `day_mask`, after the current due's weekday |
| monthly | same `day_of_month` in the following month |
| custom  | current due + `interval_days` |

`day_of_month` is capped at 28 to avoid February edge cases.

## API

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/templates` | List all recurring templates |
| `POST` | `/api/templates` | Create template + first todo instance |
| `DELETE` | `/api/templates/:id` | Delete template (future spawns stop; existing todos unaffected) |

**`POST /api/templates` request body:**
```json
{
  "text": "Daily standup",
  "category_id": null,
  "description": null,
  "recurrence_type": "weekly",
  "day_mask": 62,
  "due_date": "2026-04-28"
}
```
Response: `{ template: RecurringTemplate, todo: Todo }` — the template row and the first spawned instance.

### Modified endpoint

**`PATCH /api/todos/:id`** — when `done: true` and the todo has a `template_id`:
1. Mark the current todo as done (existing behavior)
2. Look up the template
3. Calculate next due date from the current todo's `due_date`
4. Insert a new todo in the same DB transaction
5. Return `{ ok: true, spawned: Todo }` — client merges the new instance into state without a separate fetch

If the todo has no `template_id`, response is unchanged: `{ ok: true, spawned: null }`.

**Validation:**
- `POST /api/templates`: `recurrence_type` must be one of the four values; `day_mask` required and non-zero for `weekly`; `interval_days` required and ≥ 1 for `custom`; `day_of_month` required and in range 1–28 for `monthly`; `due_date` required (first instance anchor)
- Weekly with empty `day_mask` (0 or null) is rejected 400

## Frontend

### New / modified files

| File | Change |
|------|--------|
| `src/types.ts` | Add `RecurringTemplate` interface; add `template_id: number \| null` to `Todo` |
| `src/api.ts` | Add `getTemplates`, `createTemplate`, `deleteTemplate` |
| `src/hooks/useTemplates.ts` | New hook: `createTemplate` (returns `{ template, todo }`), `deleteTemplate` |
| `src/hooks/useTodos.ts` | Add `insertTodo` action (merge externally-created todo into state); merge `spawned` todo into state after toggle-done |
| `src/components/RecurrencePicker.tsx` | New inline picker component (see below) |
| `src/components/TodoItem.tsx` | Add "🔁 Repeat" row in expanded controls; show recurrence chip on due date row |
| `src/components/DueDateChip.tsx` | Accept optional `recurrenceLabel` prop to render badge alongside date |

### RecurrencePicker component

Rendered inline inside `TodoItem`'s expanded controls, directly below the due date row. Only shown when the todo has a `due_date`.

**Layout:**
1. Segmented control: `Daily | Weekly | Monthly | Custom`
2. Contextual sub-controls (shown only for selected type):
   - **Weekly:** 7 day-toggle buttons (Su Mo Tu We Th Fr Sa), multi-select
   - **Monthly:** read-only label showing the due date's day-of-month ("Repeats on the 28th")
   - **Custom:** number input + "days" label ("Every [14] days")
   - **Daily:** no sub-controls needed
3. Summary line: "↳ Repeats every Monday and Thursday"
4. Explicit **Set** button to confirm and save the recurrence (calls `POST /api/templates`); disabled when configuration is invalid (e.g. no days selected for weekly)
5. If template already exists: picker shows the current pattern (read-only display) plus a "Remove recurrence" link. Removing calls `DELETE /api/templates/:id` — the current todo becomes a plain non-recurring todo (its `template_id` becomes an inert tombstone); no todos are deleted.

### Recurrence chip

`DueDateChip` gains an optional `recurrenceLabel` string prop. When present, a small pill badge (`daily`, `weekly`, `Mon/Wed/Fri`, `monthly`, `every 14d`) renders alongside the date chip.

### State flow on template creation

```
user clicks Set in RecurrencePicker → createTemplate(config)
  → POST /api/templates { text, due_date, recurrence_type, ... }
  → response: { template: RecurringTemplate, todo: Todo }
  → useTemplates adds template to templates state
  → TodoItem calls insertTodo(todo) → useTodos appends to todos state
```

### State flow on completion

```
user checks todo → toggleTodo(id)
  → PATCH /api/todos/:id { done: true }
  → response: { ok: true, spawned: Todo | null }
  → if spawned: append to todos state
```

No loading flash; the new instance appears immediately.

## Edge Cases

- **Recurring todo without due_date:** Cannot happen — `RecurrencePicker` is only accessible when a due date is set. The "🔁 Repeat" row is hidden until a due date is chosen.
- **Undo completion (un-check):** Does not delete the spawned instance. The completed instance and the new instance coexist. This is acceptable — the user can delete the duplicate manually if needed.
- **Template deleted mid-series:** Existing todos with the orphaned `template_id` simply never spawn again. No cascading deletes.
- **Monthly on the 31st:** Prevented at creation — `day_of_month` max is 28.
- **Weekly: all days deselected:** API rejects with 400; client disables the Save button when no days are selected.

## Out of Scope

- End date / "repeat N times" limit
- Subtasks on recurring tasks
- Editing recurrence pattern after creation (delete and recreate)
- Push notifications or reminders
