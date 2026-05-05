import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { initDb } from '../server'
import { createTaskPersistence, TaskPersistenceError } from './task-persistence'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  initDb(db)
})

afterEach(() => {
  db.close()
})

describe('task persistence', () => {
  it('creates a trimmed todo after validating parent and category ids', () => {
    const persistence = createTaskPersistence(db)
    const category = persistence.createCategory(' Work ', '#3366ff')
    const parent = persistence.createTodo({ text: ' Parent ', parent_id: null, category_id: category.id })

    const child = persistence.createTodo({ text: ' Child ', parent_id: parent.id, category_id: category.id })

    expect(child.text).toBe('Child')
    expect(child.parent_id).toBe(parent.id)
    expect(child.category_id).toBe(category.id)
  })

  it('rejects missing parent and category ids with the existing messages', () => {
    const persistence = createTaskPersistence(db)

    expect(() => persistence.createTodo({ text: 'orphan', parent_id: 999, category_id: null }))
      .toThrow(new TaskPersistenceError('parent not found'))
    expect(() => persistence.createTodo({ text: 'task', parent_id: null, category_id: 999 }))
      .toThrow(new TaskPersistenceError('category not found'))
  })

  it('deletes a category and clears it from assigned todos', () => {
    const persistence = createTaskPersistence(db)
    const category = persistence.createCategory('Work', '#3366ff')
    const todo = persistence.createTodo({ text: 'task', parent_id: null, category_id: category.id })

    const result = persistence.deleteCategory(category.id)

    expect(result.affectedTodoIds).toEqual([todo.id])
    expect(persistence.getTodo(todo.id)?.category_id).toBeNull()
    expect(persistence.listCategories()).toEqual([])
  })
})
