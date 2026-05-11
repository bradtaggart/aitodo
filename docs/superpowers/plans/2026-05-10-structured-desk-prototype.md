# Structured Desk Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the existing AiTodo interface into the selected Structured Desk visual direction without changing product behavior.

**Architecture:** Keep the existing React component structure and state flow intact. Implement the prototype by making small JSX changes in the main layout and applying most of the redesign through CSS variables, section wrappers, and targeted component styling.

**Tech Stack:** React 19, TypeScript, Vite, CSS, Vitest, ESLint

---

## File Structure

- Modify: `src/App.tsx`
  Purpose: add minimal structural wrappers and headings needed for the desktop editorial layout.
- Modify: `src/App.css`
  Purpose: implement most of the Structured Desk component styling and page layout.
- Modify: `src/index.css`
  Purpose: redefine global tokens, background treatment, typography defaults, and top-level page atmosphere.
- Modify: `src/components/CalendarPanel.tsx`
  Purpose: add any tiny markup hooks needed for the calendar rail styling if CSS alone is not sufficient.
- Modify: `src/components/AuthForm.tsx`
  Purpose: keep the auth entry screen visually aligned with the new direction.
- Verify: `src/components/CategoryBar.tsx`, `src/components/TodoItem.tsx`, `src/components/SortDropdown.tsx`, `src/components/DueDateChip.tsx`
  Purpose: reuse existing markup where possible and avoid behavioral changes.

### Task 1: Reshape the top-level layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Update the main app markup with minimal new structure**

Wrap the header, composer, filters, and task list in clearer editorial sections. Keep all handlers and props unchanged.

- [ ] **Step 2: Implement the page layout styles**

Create a stronger desktop composition with:
- a warmer page background
- a clearer main content column
- flatter section containers
- improved spacing between header, composer, filter banners, and list

- [ ] **Step 3: Verify the app still renders the same data flow**

Check that login state, greeting, task count, selected date, and filters still render as before.

### Task 2: Restyle controls and list presentation

**Files:**
- Modify: `src/App.css`
- Verify: `src/components/CategoryBar.tsx`
- Verify: `src/components/SortDropdown.tsx`
- Verify: `src/components/DueDateChip.tsx`
- Verify: `src/components/TodoItem.tsx`

- [ ] **Step 1: Redefine shared visual tokens**

Adjust border radius, accent usage, panel backgrounds, and typography emphasis to move away from the current soft default look.

- [ ] **Step 2: Restyle the composer and category controls**

Make the add-task form, sort dropdown, category chips, add-category form, and filter banners feel flatter and more editorial while preserving current behavior.

- [ ] **Step 3: Restyle task rows and related controls**

Update list items, metadata, category indicator, due date chip, child form, and supporting controls so tasks read as structured rows/blocks instead of mobile-like cards.

- [ ] **Step 4: Verify interaction affordances remain clear**

Check hover/focus states for keyboard and mouse use, especially for edit title, set category, due date, recurrence, add subtask, and delete.

### Task 3: Align the calendar rail and auth view

**Files:**
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: `src/components/CalendarPanel.tsx`
- Modify: `src/components/AuthForm.tsx`

- [ ] **Step 1: Restyle the calendar panel as a desktop side rail**

Keep its current behavior and visibility toggle, but make it read as part of the Structured Desk layout instead of a generic app sidebar.

- [ ] **Step 2: Bring the auth screen into the same visual family**

Update the auth page/card/tabs/form styling so first impression matches the prototype.

- [ ] **Step 3: Verify mobile collapse still works**

Check the layout at narrower widths and make sure the hierarchy stays legible without overlapping or clipping.

### Task 4: Verify and polish

**Files:**
- Modify: `src/App.css`
- Modify: `src/index.css`

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 3: Run the app and visually verify the prototype**

Run: `npm run dev`
Expected: local app starts and the Structured Desk styling appears in the browser without broken interactions.

- [ ] **Step 4: Make any small CSS-only corrections discovered during verification**

Limit polish to issues found during verification. Do not expand scope into new features or unrelated refactors.
