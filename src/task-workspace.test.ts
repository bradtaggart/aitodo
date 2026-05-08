import { describe, expect, it, vi } from 'vitest'
import type { Category, Todo } from './types'
import type { RecurringTemplate } from './recurrence'
import { createTaskWorkspace, type TaskWorkspaceAdapter } from './task-workspace'

function todo(id: number, patch: Partial<Todo> = {}): Todo {
  return {
    id,
    text: `task ${id}`,
    done: false,
    completed_at: null,
    created_at: '2026-05-01T00:00:00.000Z',
    parent_id: null,
    category_id: null,
    due_date: null,
    description: null,
    template_id: null,
    priority: null,
    ...patch,
  }
}

function makeWorkspace(initialTodos: Todo[] = [todo(1)]): {
  adapter: TaskWorkspaceAdapter
  todos: () => Todo[]
  categories: () => Category[]
  templates: () => RecurringTemplate[]
  workspace: ReturnType<typeof createTaskWorkspace>
} {
  let todos = initialTodos
  let categories: Category[] = []
  let templates: RecurringTemplate[] = []
  const adapter: TaskWorkspaceAdapter = {
    fetchTodos: vi.fn(async () => [todo(10)]),
    fetchCategories: vi.fn(async () => [{ id: 1, name: 'Work', color: '#3366ff' }]),
    fetchTemplates: vi.fn(async () => []),
    createTodo: vi.fn(async () => todo(2)),
    patchTodo: vi.fn(async () => ({ ok: true, spawned: null })),
    eraseTodo: vi.fn(async () => ({ ok: true })),
    createCategory: vi.fn(async () => ({ id: 1, name: 'Work', color: '#3366ff' })),
    eraseCategory: vi.fn(async () => ({ ok: true, affectedTodoIds: [1] })),
    createTemplate: vi.fn(async () => ({ template: templates[0], todo: todos[0] })),
    eraseTemplate: vi.fn(async () => ({ ok: true })),
  }
  const workspace = createTaskWorkspace(adapter, {
    setTodos: value => { todos = typeof value === 'function' ? value(todos) : value },
    setCategories: value => { categories = typeof value === 'function' ? value(categories) : value },
    setTemplates: value => { templates = typeof value === 'function' ? value(templates) : value },
  })
  return { adapter, todos: () => todos, categories: () => categories, templates: () => templates, workspace }
}

describe('task workspace', () => {
  it('patches category locally after changing a task category', async () => {
    const { adapter, todos, workspace } = makeWorkspace([todo(1)])

    await workspace.changeCategory(1, 9)

    expect(adapter.patchTodo).toHaveBeenCalledWith(1, { category_id: 9 })
    expect(adapter.fetchTodos).not.toHaveBeenCalled()
    expect(todos()[0].category_id).toBe(9)
  })

  it('clears deleted categories locally and reloads categories', async () => {
    const { adapter, todos, categories, workspace } = makeWorkspace([todo(1, { category_id: 1 })])

    await workspace.deleteCategory(1)

    expect(adapter.eraseCategory).toHaveBeenCalledWith(1)
    expect(todos()[0].category_id).toBeNull()
    expect(categories()).toEqual([{ id: 1, name: 'Work', color: '#3366ff' }])
  })

  it('reloads Tasks and Templates after creating recurrence', async () => {
    const { adapter, todos, templates, workspace } = makeWorkspace([todo(1)])

    await workspace.createTemplate(1, { recurrence_type: 'daily' })

    expect(adapter.createTemplate).toHaveBeenCalledWith(1, { recurrence_type: 'daily' })
    expect(adapter.fetchTodos).toHaveBeenCalled()
    expect(adapter.fetchTemplates).toHaveBeenCalled()
    expect(todos()).toEqual([todo(10)])
    expect(templates()).toEqual([])
  })
})
