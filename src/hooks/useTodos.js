import { useState, useCallback, useEffect } from 'react'
import * as api from '../api'

export function useTodos() {
  const [todos, setTodos] = useState([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setTodos(await api.fetchTodos())
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function withPending(fn) {
    setPending(true)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  const addTodo = (text, category_id) =>
    withPending(() => api.createTodo(text, category_id))

  const addChild = (text, parent_id) =>
    withPending(() => api.createTodo(text, null, parent_id))

  const toggleTodo = (id, done) =>
    withPending(() => api.patchTodo(id, { done: !done }))

  const deleteTodo = id =>
    withPending(() => api.eraseTodo(id))

  const changeCategory = (id, category_id) =>
    withPending(() => api.patchTodo(id, { category_id }))

  const subtasksOf = useCallback(
    id => todos.filter(t => t.parent_id === id),
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
  }
}
