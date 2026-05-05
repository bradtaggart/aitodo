import { describe, expect, it } from 'vitest'
import { deriveTaskList, sortTodos } from './task-list'
import type { RecurringTemplate } from './recurrence'
import type { Category, Todo } from './types'

const categories: Category[] = [
  { id: 1, name: 'Work', color: '#3366ff' },
  { id: 2, name: 'Home', color: '#44aa55' },
]

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

function ids(items: Todo[]) {
  return items.map(item => item.id)
}

describe('sortTodos', () => {
  it('keeps the default newest-first order', () => {
    const result = [
      todo({ id: 1, text: 'older' }),
      todo({ id: 3, text: 'newer' }),
      todo({ id: 2, text: 'middle' }),
    ].sort((a, b) => sortTodos(a, b, 'none', categories))

    expect(ids(result)).toEqual([3, 2, 1])
  })

  it('sorts dated tasks first by due date', () => {
    const result = [
      todo({ id: 1, text: 'undated' }),
      todo({ id: 2, text: 'later', due_date: '2026-05-10' }),
      todo({ id: 3, text: 'earlier', due_date: '2026-05-02' }),
    ].sort((a, b) => sortTodos(a, b, 'due_date', categories))

    expect(ids(result)).toEqual([3, 2, 1])
  })
})

describe('deriveTaskList', () => {
  it('filters top-level tasks by category and keeps subtasks addressable', () => {
    const parent = todo({ id: 1, text: 'parent', category_id: 1 })
    const child = todo({ id: 2, text: 'child', parent_id: 1 })
    const otherCategory = todo({ id: 3, text: 'other category', category_id: 2 })

    const result = deriveTaskList({
      todos: [parent, child, otherCategory],
      categories,
      templates: [],
      activeCategoryId: 1,
      selectedDate: null,
      sortBy: 'none',
    })

    expect(ids(result.topLevel)).toEqual([1])
    expect(ids(result.subtasksOf(1))).toEqual([2])
  })

  it('includes an active recurring task when the selected date is projected', () => {
    const weekly: RecurringTemplate = {
      id: 10,
      text: 'weekly task',
      category_id: null,
      description: null,
      recurrence_type: 'weekly',
      day_mask: 1 << 5,
      interval_days: null,
      day_of_month: null,
    }

    const result = deriveTaskList({
      todos: [
        todo({ id: 1, text: 'weekly task', due_date: '2026-05-01', template_id: weekly.id }),
        todo({ id: 2, text: 'unrelated', due_date: '2026-05-02' }),
      ],
      categories,
      templates: [weekly],
      activeCategoryId: null,
      selectedDate: new Date(2026, 4, 8),
      sortBy: 'none',
    })

    expect(ids(result.topLevel)).toEqual([1])
  })
})
