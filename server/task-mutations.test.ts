import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { initDb } from '../server'
import { createTaskMutations, TaskMutationError } from './task-mutations'
import { createTaskPersistence, type TaskPersistence } from './task-persistence'
import { createRecurringTaskOperations } from './recurring-task-operations'

let db: Database.Database
let persistence: TaskPersistence
let mutations: ReturnType<typeof createTaskMutations>

beforeEach(() => {
  db = new Database(':memory:')
  initDb(db)
  persistence = createTaskPersistence(db)
  mutations = createTaskMutations(persistence)
})

afterEach(() => {
  db.close()
})

function createTodo(text = 'task') {
  return persistence.createTodo({ text })
}

function createChild(text: string, parentId: number) {
  return persistence.createTodo({ text, parent_id: parentId })
}

function setDueDate(id: number, dueDate: string) {
  persistence.updateDueDate(id, dueDate)
}

describe('task mutations', () => {
  it('throws 404 when patching a missing todo', () => {
    try {
      mutations.applyPatch(999, { done: true })
      throw new Error('expected missing todo to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(TaskMutationError)
      expect((err as TaskMutationError).message).toBe('todo not found')
      expect((err as TaskMutationError).status).toBe(404)
    }
  })

  it('cascades done=true to children and spawns the next recurring instance', () => {
    const parent = createTodo('parent')
    const child = createChild('child', parent.id)
    setDueDate(parent.id, '2026-04-28')
    const recurringTasks = createRecurringTaskOperations(persistence)
    const { template } = recurringTasks.setRecurrence(parent.id, { recurrence_type: 'weekly', day_mask: 2 })

    const result = mutations.applyPatch(parent.id, { done: true })

    expect(persistence.getTodo(parent.id)?.done).toBe(1)
    expect(persistence.getTodo(child.id)?.done).toBe(1)
    expect(result.spawned?.due_date).toBe('2026-05-04')
    expect(result.spawned?.template_id).toBe(template.id)
    expect(result.spawned?.done).toBe(false)
  })

  it('clears only the target completion state when done=false and does not spawn', () => {
    const parent = createTodo('parent')
    const child = createChild('child', parent.id)
    mutations.applyPatch(parent.id, { done: true })

    const result = mutations.applyPatch(parent.id, { done: false })

    expect(persistence.getTodo(parent.id)?.done).toBe(0)
    expect(persistence.getTodo(parent.id)?.completed_at).toBeNull()
    expect(persistence.getTodo(child.id)?.done).toBe(1)
    expect(result.spawned).toBeNull()
  })

  it('applies valid task field mutations and trims text', () => {
    const category = persistence.createCategory('Work', '#3366ff')
    const todo = createTodo('original')

    const result = mutations.applyPatch(todo.id, {
      category_id: category.id,
      due_date: '2026-05-01',
      description: 'details',
      priority: 'high',
      text: '  updated  ',
    })

    const updated = persistence.getTodo(todo.id)
    expect(result).toEqual({ ok: true, spawned: null })
    expect(updated?.category_id).toBe(category.id)
    expect(updated?.due_date).toBe('2026-05-01')
    expect(updated?.description).toBe('details')
    expect(updated?.priority).toBe('high')
    expect(updated?.text).toBe('updated')
  })

  it('rejects invalid due_date, priority, and blank text with existing messages', () => {
    const todo = createTodo()

    expect(() => mutations.applyPatch(todo.id, { due_date: '05/01/2026' }))
      .toThrow('due_date must be YYYY-MM-DD or null')
    expect(() => mutations.applyPatch(todo.id, { priority: 'urgent' as never }))
      .toThrow('priority must be high, medium, low, or null')
    expect(() => mutations.applyPatch(todo.id, { text: '   ' }))
      .toThrow('text must be a non-empty string')
  })

  it('allows an empty patch on an existing todo', () => {
    const todo = createTodo()

    expect(mutations.applyPatch(todo.id, {})).toEqual({ ok: true, spawned: null })
  })
})
