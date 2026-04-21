import { useState, useCallback, useEffect } from 'react'
import * as api from '../api'

export function useCategories() {
  const [categories, setCategories] = useState([])
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setCategories(await api.fetchCategories())
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addCategory(name, color) {
    try {
      await api.createCategory(name, color)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteCategory(id) {
    try {
      await api.eraseCategory(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return {
    categories,
    error,
    clearError: () => setError(null),
    load,
    addCategory,
    deleteCategory,
  }
}
