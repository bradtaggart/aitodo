# Feature Roadmap Plan

> **For agentic workers:** Use this as a product roadmap. Convert any selected feature into a dedicated implementation plan before making broad code changes.

**Goal:** Improve the AI Todo app beyond its current task, subtask, category, due date, description, priority, calendar, and recurrence features.

**Current Product Baseline:** Local-first React/Vite todo app backed by Express + SQLite. Existing capabilities include top-level tasks, nested subtasks, categories, due dates, calendar filtering, descriptions, priority flags, and recurring task templates.

---

## Recommended First Feature

- [ ] **Search and Smart Filters**

Add a search box plus quick filters:

- Today
- Overdue
- Upcoming
- Completed
- No date
- High priority

**Why first:** High user value, low implementation risk, and it fits naturally into the existing filtering logic in `src/App.tsx`.

---

## Feature Backlog

- [ ] **Task Editing**

Allow inline editing of the main task title. Tasks can already be created, categorized, dated, described, prioritized, and deleted, but the title itself is not currently editable.

- [ ] **Completed Task View**

Add a dedicated completed/history view so completed tasks can be moved out of the main active list while still making use of `completed_at`.

- [ ] **Drag-and-Drop Ordering**

Add manual task ordering in addition to newest-first and priority sorting. This would make daily planning and task triage more practical.

- [ ] **Today / Planning Dashboard**

Add a focused planning view showing:

- overdue tasks
- tasks due today
- high-priority open tasks
- upcoming recurring tasks

- [ ] **Recurring Task Management Page**

Add a central view for all recurring templates. It should list recurring tasks, show their schedules, allow schedule edits, and display the next due date.

- [ ] **Task Notes / Activity Timeline**

Extend task details with notes or lightweight activity history:

- created
- completed
- reopened
- due date changed
- priority changed

- [ ] **Bulk Actions**

Support selecting multiple tasks and applying actions:

- mark selected complete
- assign category
- set due date
- delete selected
- archive completed

- [ ] **Import / Export**

Add CSV or JSON import/export for backup and portability of the local SQLite-backed data.

- [ ] **Basic AI Assist**

Add an AI-assisted workflow that can:

- break a task into subtasks
- suggest due dates
- summarize today's plan

Start with a local UI affordance and define the provider boundary before wiring in an AI API.

---

## Project Polish

- [ ] **Rewrite README**

Replace the default Vite template content with actual project documentation:

- app purpose
- current features
- local development commands
- test commands
- deployment notes
- database path/configuration

- [ ] **Update AGENTS.md**

Bring `AGENTS.md` in line with the current project. It currently references JSX-era file names and says no test runner is configured, but the app now uses TypeScript and Vitest.

