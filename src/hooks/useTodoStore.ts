import { useState, useCallback, useEffect } from 'react'
import type { Todo, Category } from '../types'
import * as api from '../api'
import type { RecurringTemplate, SetRecurrenceConfig } from '../recurrence'
import { fetchTemplates, createTemplate, eraseTemplate } from '../recurrence'

export function useTodoStore() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTodos = useCallback(() => api.fetchTodos().then(setTodos), [])
  const loadCategories = useCallback(() => api.fetchCategories().then(setCategories), [])
  const loadTemplates = useCallback(() => fetchTemplates().then(setTemplates), [])

  useEffect(() => {
    Promise.all([loadTodos(), loadCategories(), loadTemplates()]).catch(err => {
      setError((err as Error).message)
    })
  }, [loadTodos, loadCategories, loadTemplates])

  async function withPending(fn: () => Promise<void>) {
    setPending(true)
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return {
    todos,
    categories,
    templates,
    pending,
    error,
    clearError: () => setError(null),

    addTodo: (text: string, category_id: number | null) =>
      withPending(async () => { await api.createTodo(text, category_id); await loadTodos() }),

    addChild: (text: string, parent_id: number) =>
      withPending(async () => { await api.createTodo(text, null, parent_id); await loadTodos() }),

    toggleTodo: (id: number, done: boolean) =>
      withPending(async () => { await api.patchTodo(id, { done: !done }); await loadTodos() }),

    deleteTodo: (id: number) =>
      withPending(async () => { await api.eraseTodo(id); await loadTodos() }),

    changeCategory: (id: number, category_id: number | null) =>
      withPending(async () => { await api.patchTodo(id, { category_id }); await loadTodos() }),

    changeDueDate: (id: number, due_date: string | null) =>
      withPending(async () => { await api.patchTodo(id, { due_date }); await loadTodos() }),

    changeDescription: (id: number, description: string | null) =>
      withPending(async () => { await api.patchTodo(id, { description }); await loadTodos() }),

    changePriority: (id: number, priority: 'high' | 'medium' | 'low' | null) =>
      withPending(async () => { await api.patchTodo(id, { priority }); await loadTodos() }),

    changeTitle: (id: number, text: string) =>
      withPending(async () => { await api.patchTodo(id, { text }); await loadTodos() }),

    addCategory: (name: string, color: string) =>
      withPending(async () => { await api.createCategory(name, color); await loadCategories() }),

    deleteCategory: (id: number) =>
      withPending(async () => {
        const { affectedTodoIds } = await api.eraseCategory(id)
        const affected = new Set(affectedTodoIds)
        setTodos(prev => prev.map(t => affected.has(t.id) ? { ...t, category_id: null } : t))
        await loadCategories()
      }),

    createTemplate: (todo_id: number, config: SetRecurrenceConfig) =>
      withPending(async () => {
        await createTemplate(todo_id, config)
        await Promise.all([loadTemplates(), loadTodos()])
      }),

    deleteTemplate: (id: number) =>
      withPending(async () => {
        await eraseTemplate(id)
        await Promise.all([loadTemplates(), loadTodos()])
      }),
  }
}
