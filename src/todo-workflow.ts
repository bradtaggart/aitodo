import type { Category, Todo } from './types'
import type { RecurringTemplate } from './recurrence'

export interface TodoDataLoaders {
  loadTodos: () => Promise<Todo[]>
  loadCategories: () => Promise<Category[]>
  loadTemplates: () => Promise<RecurringTemplate[]>
}

export interface TodoData {
  todos: Todo[]
  categories: Category[]
  templates: RecurringTemplate[]
}

export function applyTodoPatch(todos: Todo[], id: number, patch: Partial<Todo>): Todo[] {
  return todos.map(todo => todo.id === id ? { ...todo, ...patch } : todo)
}

export function clearCategoryFromTodos(todos: Todo[], affectedTodoIds: number[]): Todo[] {
  const affected = new Set(affectedTodoIds)
  return todos.map(todo => affected.has(todo.id) ? { ...todo, category_id: null } : todo)
}

export async function loadTodoData(loaders: TodoDataLoaders): Promise<TodoData> {
  const [todos, categories, templates] = await Promise.all([
    loaders.loadTodos(),
    loaders.loadCategories(),
    loaders.loadTemplates(),
  ])

  return { todos, categories, templates }
}
