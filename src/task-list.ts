import type { Category, Todo } from './types'
import type { RecurringTemplate } from './recurrence'
import { isProjectedDate } from './recurrence'
import { toDateStr } from './utils/dates'
import { buildTree } from './utils/tree'

export type SortBy = 'none' | 'due_date' | 'category' | 'priority'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export interface TaskListInput {
  todos: Todo[]
  categories: Category[]
  templates: RecurringTemplate[]
  activeCategoryId: number | null
  selectedDate: Date | null
  sortBy: SortBy
}

export function deriveTaskList({
  todos,
  categories,
  templates,
  activeCategoryId,
  selectedDate,
  sortBy,
}: TaskListInput): ReturnType<typeof buildTree> {
  const { topLevel, subtasksOf } = buildTree(todos)
  const selectedDateStr = selectedDate ? toDateStr(selectedDate) : null

  return {
    topLevel: topLevel
      .filter(todo => shouldShowTopLevelTodo(todo, {
        templates,
        activeCategoryId,
        selectedDateStr,
      }))
      .sort((a, b) => sortTodos(a, b, sortBy, categories)),
    subtasksOf,
  }
}

function shouldShowTopLevelTodo(
  todo: Todo,
  {
    templates,
    activeCategoryId,
    selectedDateStr,
  }: Pick<TaskListInput, 'templates' | 'activeCategoryId'> & { selectedDateStr: string | null },
): boolean {
  if (activeCategoryId !== null && todo.category_id !== activeCategoryId) return false
  if (selectedDateStr === null) return true
  if (todo.due_date === selectedDateStr) return true

  if (todo.template_id && !todo.done && todo.due_date) {
    const template = templates.find(tmpl => tmpl.id === todo.template_id)
    return template ? isProjectedDate(template, todo.due_date, selectedDateStr) : false
  }

  return false
}

export function sortTodos(a: Todo, b: Todo, sortBy: SortBy, categories: Category[]): number {
  if (sortBy === 'priority') {
    const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
    const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
    return pa - pb
  }

  if (sortBy === 'due_date') {
    if (!a.due_date && !b.due_date) return b.id - a.id
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
  }

  if (sortBy === 'category') {
    const nameOf = (todo: Todo) => categories.find(category => category.id === todo.category_id)?.name ?? ''
    const na = nameOf(a)
    const nb = nameOf(b)
    if (!na && !nb) return b.id - a.id
    if (!na) return 1
    if (!nb) return -1
    return na.localeCompare(nb)
  }

  return b.id - a.id
}
