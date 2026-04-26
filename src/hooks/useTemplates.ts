import { useState, useCallback, useEffect } from 'react'
import type { RecurringTemplate } from '../types'
import type { SetRecurrenceConfig } from '../api'
import * as api from '../api'

export function useTemplates() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTemplates(await api.fetchTemplates())
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createTemplate(todo_id: number, config: SetRecurrenceConfig) {
    try {
      const result = await api.createTemplate(todo_id, config)
      await load()
      return result
    } catch (err) {
      setError((err as Error).message)
      throw err
    }
  }

  async function deleteTemplate(id: number) {
    try {
      await api.eraseTemplate(id)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return {
    templates,
    error,
    clearError: () => setError(null),
    load,
    createTemplate,
    deleteTemplate,
  }
}
