import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { initDb } from '../server'
import { createRecurringTaskOperations } from './recurring-task-operations'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  initDb(db)
})

afterEach(() => {
  db.close()
})

function createTodo(text = 'standup') {
  const createdAt = new Date().toISOString()
  const result = db.prepare<[string, string], Database.RunResult>(
    'INSERT INTO todos (text, created_at) VALUES (?, ?)',
  ).run(text, createdAt)
  return Number(result.lastInsertRowid)
}

function setDueDate(id: number, dueDate: string) {
  db.prepare<[string, number]>('UPDATE todos SET due_date = ? WHERE id = ?').run(dueDate, id)
}

describe('recurring task operations', () => {
  it('sets recurrence for a dated todo and returns the linked template and todo', () => {
    const todoId = createTodo()
    setDueDate(todoId, '2026-04-28')
    const ops = createRecurringTaskOperations(db)

    const result = ops.setRecurrence(todoId, { recurrence_type: 'daily' })

    expect(result.template.recurrence_type).toBe('daily')
    expect(result.template.text).toBe('standup')
    expect(result.todo.id).toBe(todoId)
    expect(result.todo.template_id).toBe(result.template.id)
  })

  it('completes a recurring todo and spawns the next instance', () => {
    const todoId = createTodo()
    setDueDate(todoId, '2026-04-28')
    const ops = createRecurringTaskOperations(db)
    const { template } = ops.setRecurrence(todoId, { recurrence_type: 'weekly', day_mask: 2 })

    const result = ops.completeTodo(todoId, true)

    expect(result.spawned?.due_date).toBe('2026-05-04')
    expect(result.spawned?.template_id).toBe(template.id)
    expect(result.spawned?.done).toBe(0)
  })

  it('does not spawn when completing a non-recurring todo', () => {
    const todoId = createTodo('one-off')
    const ops = createRecurringTaskOperations(db)

    const result = ops.completeTodo(todoId, true)

    expect(result.spawned).toBeNull()
  })

  it('does not spawn when unchecking a recurring todo', () => {
    const todoId = createTodo()
    setDueDate(todoId, '2026-04-28')
    const ops = createRecurringTaskOperations(db)
    ops.setRecurrence(todoId, { recurrence_type: 'daily' })
    ops.completeTodo(todoId, true)
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM todos').get() as { count: number }

    const result = ops.completeTodo(todoId, false)
    const countAfter = db.prepare('SELECT COUNT(*) as count FROM todos').get() as { count: number }

    expect(result.spawned).toBeNull()
    expect(countAfter.count).toBe(countBefore.count)
  })

  it('deletes an active recurring todo series and its template', () => {
    const todoId = createTodo()
    setDueDate(todoId, '2026-04-28')
    const ops = createRecurringTaskOperations(db)
    const { template } = ops.setRecurrence(todoId, { recurrence_type: 'daily' })
    const spawned = ops.completeTodo(todoId, true).spawned!

    ops.deleteTodo(spawned.id)

    const remainingTodos = db.prepare('SELECT * FROM todos ORDER BY id').all()
    const remainingTemplates = db.prepare('SELECT * FROM recurring_templates').all()
    expect(remainingTodos).toHaveLength(1)
    expect(remainingTemplates).toHaveLength(0)
    expect(template.id).toBeGreaterThan(0)
  })

  it('deletes a template while preserving todo template_id tombstones', () => {
    const todoId = createTodo()
    setDueDate(todoId, '2026-04-28')
    const ops = createRecurringTaskOperations(db)
    const { template } = ops.setRecurrence(todoId, { recurrence_type: 'daily' })

    ops.deleteTemplate(template.id)

    const todo = db.prepare<[number]>('SELECT template_id FROM todos WHERE id = ?').get(todoId) as { template_id: number | null }
    const templateCount = db.prepare('SELECT COUNT(*) as count FROM recurring_templates').get() as { count: number }
    expect(todo.template_id).toBe(template.id)
    expect(templateCount.count).toBe(0)
  })
})
