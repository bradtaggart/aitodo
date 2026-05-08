import type { Category, Todo } from './types'
import type { RecurringTemplate, SetRecurrenceConfig } from './recurrence'

type StateValue<T> = T[] | ((prev: T[]) => T[])

export interface TaskWorkspaceAdapter {
  fetchTodos: () => Promise<Todo[]>
  fetchCategories: () => Promise<Category[]>
  fetchTemplates: () => Promise<RecurringTemplate[]>
  createTodo: (text: string, category_id?: number | null, parent_id?: number | null) => Promise<Todo>
  patchTodo: (id: number, patch: Partial<Pick<Todo, 'text' | 'done' | 'category_id' | 'due_date' | 'description' | 'priority'>>) => Promise<{ ok: true; spawned: Todo | null }>
  eraseTodo: (id: number) => Promise<{ ok: true }>
  createCategory: (name: string, color: string) => Promise<Category>
  eraseCategory: (id: number) => Promise<{ ok: true; affectedTodoIds: number[] }>
  createTemplate: (todo_id: number, config: SetRecurrenceConfig) => Promise<{ template: RecurringTemplate; todo: Todo }>
  eraseTemplate: (id: number) => Promise<{ ok: true }>
}

export interface TaskWorkspaceState {
  setTodos: (value: StateValue<Todo>) => void
  setCategories: (value: StateValue<Category>) => void
  setTemplates: (value: StateValue<RecurringTemplate>) => void
}

function applyTodoPatch(todos: Todo[], id: number, patch: Partial<Todo>): Todo[] {
  return todos.map(todo => todo.id === id ? { ...todo, ...patch } : todo)
}

function clearCategoryFromTodos(todos: Todo[], affectedTodoIds: number[]): Todo[] {
  const affected = new Set(affectedTodoIds)
  return todos.map(todo => affected.has(todo.id) ? { ...todo, category_id: null } : todo)
}

export function createTaskWorkspace(adapter: TaskWorkspaceAdapter, state: TaskWorkspaceState) {
  const loadTodos = async () => state.setTodos(await adapter.fetchTodos())
  const loadCategories = async () => state.setCategories(await adapter.fetchCategories())
  const loadTemplates = async () => state.setTemplates(await adapter.fetchTemplates())

  return {
    loadAll: async () => {
      const [todos, categories, templates] = await Promise.all([
        adapter.fetchTodos(),
        adapter.fetchCategories(),
        adapter.fetchTemplates(),
      ])
      state.setTodos(todos)
      state.setCategories(categories)
      state.setTemplates(templates)
    },

    addTodo: async (text: string, category_id: number | null) => {
      await adapter.createTodo(text, category_id)
      await loadTodos()
    },

    addChild: async (text: string, parent_id: number) => {
      await adapter.createTodo(text, null, parent_id)
      await loadTodos()
    },

    toggleTodo: async (id: number, done: boolean) => {
      await adapter.patchTodo(id, { done: !done })
      await loadTodos()
    },

    deleteTodo: async (id: number) => {
      await adapter.eraseTodo(id)
      await loadTodos()
    },

    changeCategory: async (id: number, category_id: number | null) => {
      await adapter.patchTodo(id, { category_id })
      state.setTodos(prev => applyTodoPatch(prev, id, { category_id }))
    },

    changeDueDate: async (id: number, due_date: string | null) => {
      await adapter.patchTodo(id, { due_date })
      state.setTodos(prev => applyTodoPatch(prev, id, { due_date }))
    },

    changeDescription: async (id: number, description: string | null) => {
      await adapter.patchTodo(id, { description })
      state.setTodos(prev => applyTodoPatch(prev, id, { description }))
    },

    changePriority: async (id: number, priority: 'high' | 'medium' | 'low' | null) => {
      await adapter.patchTodo(id, { priority })
      state.setTodos(prev => applyTodoPatch(prev, id, { priority }))
    },

    changeTitle: async (id: number, text: string) => {
      await adapter.patchTodo(id, { text })
      state.setTodos(prev => applyTodoPatch(prev, id, { text }))
    },

    addCategory: async (name: string, color: string) => {
      await adapter.createCategory(name, color)
      await loadCategories()
    },

    deleteCategory: async (id: number) => {
      const { affectedTodoIds } = await adapter.eraseCategory(id)
      state.setTodos(prev => clearCategoryFromTodos(prev, affectedTodoIds))
      await loadCategories()
    },

    createTemplate: async (todo_id: number, config: SetRecurrenceConfig) => {
      await adapter.createTemplate(todo_id, config)
      await Promise.all([loadTemplates(), loadTodos()])
    },

    deleteTemplate: async (id: number) => {
      await adapter.eraseTemplate(id)
      await Promise.all([loadTemplates(), loadTodos()])
    },
  }
}
