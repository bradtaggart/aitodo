import { useState, useCallback, useEffect } from 'react'
import type { Category } from '../types'
import * as api from '../api'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setCategories(await api.fetchCategories())
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addCategory(name: string, color: string) {
    try {
      await api.createCategory(name, color)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function deleteCategory(id: number) {
    try {
      await api.eraseCategory(id)
      await load()
    } catch (err) {
      setError((err as Error).message)
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
