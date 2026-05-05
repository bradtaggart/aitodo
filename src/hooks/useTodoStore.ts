import { useState, useCallback, useEffect } from 'react'
import type { Todo, Category } from '../types'
import * as api from '../api'
import type { RecurringTemplate, SetRecurrenceConfig } from '../recurrence'
import { fetchTemplates, createTemplate, eraseTemplate } from '../recurrence'
import { applyTodoPatch, clearCategoryFromTodos, loadTodoData } from '../todo-workflow'

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
    loadTodoData({
      loadTodos: api.fetchTodos,
      loadCategories: api.fetchCategories,
      loadTemplates: fetchTemplates,
    }).then(data => {
      setTodos(data.todos)
      setCategories(data.categories)
      setTemplates(data.templates)
    }).catch(err => {
      setError((err as Error).message)
    })
  }, [])

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
      withPending(async () => { await api.patchTodo(id, { category_id }); setTodos(prev => applyTodoPatch(prev, id, { category_id })) }),

    changeDueDate: (id: number, due_date: string | null) =>
      withPending(async () => { await api.patchTodo(id, { due_date }); setTodos(prev => applyTodoPatch(prev, id, { due_date })) }),

    changeDescription: (id: number, description: string | null) =>
      withPending(async () => { await api.patchTodo(id, { description }); setTodos(prev => applyTodoPatch(prev, id, { description })) }),

    changePriority: (id: number, priority: 'high' | 'medium' | 'low' | null) =>
      withPending(async () => { await api.patchTodo(id, { priority }); setTodos(prev => applyTodoPatch(prev, id, { priority })) }),

    changeTitle: (id: number, text: string) =>
      withPending(async () => { await api.patchTodo(id, { text }); setTodos(prev => applyTodoPatch(prev, id, { text })) }),

    addCategory: (name: string, color: string) =>
      withPending(async () => { await api.createCategory(name, color); await loadCategories() }),

    deleteCategory: (id: number) =>
      withPending(async () => {
        const { affectedTodoIds } = await api.eraseCategory(id)
        setTodos(prev => clearCategoryFromTodos(prev, affectedTodoIds))
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
