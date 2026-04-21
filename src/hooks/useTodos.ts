import { useState, useCallback, useEffect } from 'react'
import type { Todo } from '../types'
import * as api from '../api'

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTodos(await api.fetchTodos())
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function withPending(fn: () => Promise<unknown>) {
    setPending(true)
    try {
      await fn()
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  const addTodo = (text: string, category_id: number | null) =>
    withPending(() => api.createTodo(text, category_id))

  const addChild = (text: string, parent_id: number) =>
    withPending(() => api.createTodo(text, null, parent_id))

  const toggleTodo = (id: number, done: boolean) =>
    withPending(() => api.patchTodo(id, { done: !done }))

  const deleteTodo = (id: number) =>
    withPending(() => api.eraseTodo(id))

  const changeCategory = (id: number, category_id: number | null) =>
    withPending(() => api.patchTodo(id, { category_id }))

  const changeDueDate = (id: number, due_date: string | null) =>
    withPending(() => api.patchTodo(id, { due_date }))

  const subtasksOf = useCallback(
    (id: number) => todos.filter(t => t.parent_id === id),
    [todos]
  )

  return {
    todos,
    pending,
    error,
    clearError: () => setError(null),
    load,
    subtasksOf,
    addTodo,
    addChild,
    toggleTodo,
    deleteTodo,
    changeCategory,
    changeDueDate,
  }
}
