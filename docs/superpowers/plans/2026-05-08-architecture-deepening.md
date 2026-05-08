# Architecture Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the app architecture around Account-owned Tasks, Categories, Templates, Sessions, recurrence rules, and client Task workspace state without changing product behavior.

**Architecture:** Move schema setup into a database Module, expose an Account-scoped persistence workspace, collect Account and Session behavior behind a product-shaped Module, centralize Template recurrence rules in shared pure code, and make `useTodoStore` a React Adapter over a testable client workspace core.

**Tech Stack:** React 19, Vite 8, TypeScript, Express, better-sqlite3, Vitest, supertest.

---

### Task 1: Database Schema Module

**Files:**
- Create: `server/database.ts`
- Modify: `server.ts`
- Modify tests importing `initDb`

- [ ] Write/adjust tests so persistence tests import `initDb` from `server/database.ts`.
- [ ] Move `initDb` into `server/database.ts`.
- [ ] Re-export or import `initDb` from the HTTP server only where needed.
- [ ] Run `npm run test -- server/task-persistence.test.ts server/recurring-task-operations.test.ts server/task-mutations.test.ts server.test.ts`.

### Task 2: Account-Scoped Persistence Workspace

**Files:**
- Modify: `server/task-persistence.ts`
- Modify: `server/task-mutations.ts`
- Modify: `server/recurring-task-operations.ts`
- Modify: `server.ts`
- Modify server tests for cross-Account invariants.

- [ ] Add tests proving another Account cannot patch, delete, categorize, or template an Account's Task/Category/Template through the lower-level Modules.
- [ ] Add `forAccount(accountId)` to persistence and move Account ownership checks behind that Interface.
- [ ] Update mutation, recurrence, and route code to use the Account-scoped workspace.
- [ ] Run server tests.

### Task 3: Account + Session Module

**Files:**
- Create: `server/account-session.ts`
- Modify: `server.ts`
- Test: `server/account-session.test.ts`

- [ ] Add tests for register, login, current Account response shaping, preference patching, and invalid credentials.
- [ ] Move password validation, hashing, Account response shaping, and preference merging into `createAccountSession`.
- [ ] Keep JWT cookie creation in `server/auth.ts` per ADR-0001.
- [ ] Update auth routes to delegate to the Account/Session Module.
- [ ] Run account/session and server tests.

### Task 4: Template Recurrence Rules Module

**Files:**
- Create: `src/recurrence-rules.ts`
- Modify: `src/recurrence.ts`
- Modify: `src/utils/recurrence-math.ts`
- Modify: `server/recurring-task-operations.ts`
- Test: `src/recurrence-rules.test.ts`

- [ ] Add tests for validation, Template field derivation, next date, future projection, and date membership.
- [ ] Move recurrence rule behavior behind shared pure functions.
- [ ] Update server and client modules to call the shared recurrence rules.
- [ ] Run recurrence and server tests.

### Task 5: Client Task Workspace Core

**Files:**
- Create: `src/task-workspace.ts`
- Modify: `src/hooks/useTodoStore.ts`
- Test: `src/task-workspace.test.ts`

- [ ] Add tests using a fake Adapter to prove reload/local-patch decisions for Task, Category, and Template operations.
- [ ] Move non-React operation orchestration into `createTaskWorkspace`.
- [ ] Keep `useTodoStore` as a small React Adapter that owns state setters and pending/error handling.
- [ ] Run client tests.

### Task 6: Verification

- [ ] Run `npm run test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
