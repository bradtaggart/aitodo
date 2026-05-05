import { describe, expect, it } from 'vitest'
import type { Todo } from './types'
import { applyTodoPatch, clearCategoryFromTodos, loadTodoData } from './todo-workflow'

function todo(overrides: Partial<Todo> & Pick<Todo, 'id' | 'text'>): Todo {
  return {
    done: false,
    completed_at: null,
    created_at: '2026-05-01T00:00:00.000Z',
    parent_id: null,
    category_id: null,
    due_date: null,
    description: null,
    template_id: null,
    priority: null,
    ...overrides,
  }
}

describe('todo workflow', () => {
  it('applies a local todo patch without changing other todos', () => {
    const todos = [
      todo({ id: 1, text: 'first', priority: null }),
      todo({ id: 2, text: 'second', priority: null }),
    ]

    expect(applyTodoPatch(todos, 2, { priority: 'high' })).toEqual([
      todos[0],
      { ...todos[1], priority: 'high' },
    ])
  })

  it('clears deleted category ids from affected todos', () => {
    const todos = [
      todo({ id: 1, text: 'first', category_id: 10 }),
      todo({ id: 2, text: 'second', category_id: 10 }),
      todo({ id: 3, text: 'third', category_id: 20 }),
    ]

    expect(clearCategoryFromTodos(todos, [1, 2])).toEqual([
      { ...todos[0], category_id: null },
      { ...todos[1], category_id: null },
      todos[2],
    ])
  })

  it('loads todos, categories, and templates through one workflow call', async () => {
    const data = await loadTodoData({
      loadTodos: async () => [todo({ id: 1, text: 'task' })],
      loadCategories: async () => [{ id: 1, name: 'Work', color: '#3366ff' }],
      loadTemplates: async () => [],
    })

    expect(data.todos).toHaveLength(1)
    expect(data.categories[0].name).toBe('Work')
    expect(data.templates).toEqual([])
  })
})
