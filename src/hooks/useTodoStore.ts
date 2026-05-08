import { useMemo, useState, useEffect } from 'react'
import type { Todo, Category } from '../types'
import * as api from '../api'
import type { RecurringTemplate, SetRecurrenceConfig } from '../recurrence'
import { fetchTemplates, createTemplate, eraseTemplate } from '../recurrence'
import { createTaskWorkspace } from '../task-workspace'

export function useTodoStore() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workspace = useMemo(() => createTaskWorkspace({
    fetchTodos: api.fetchTodos,
    fetchCategories: api.fetchCategories,
    fetchTemplates,
    createTodo: api.createTodo,
    patchTodo: api.patchTodo,
    eraseTodo: api.eraseTodo,
    createCategory: api.createCategory,
    eraseCategory: api.eraseCategory,
    createTemplate,
    eraseTemplate,
  }, {
    setTodos,
    setCategories,
    setTemplates,
  }), [])

  useEffect(() => {
    workspace.loadAll().catch(err => {
      setError((err as Error).message)
    })
  }, [workspace])

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

    addTodo: (text: string, category_id: number | null) => withPending(() => workspace.addTodo(text, category_id)),

    addChild: (text: string, parent_id: number) => withPending(() => workspace.addChild(text, parent_id)),

    toggleTodo: (id: number, done: boolean) => withPending(() => workspace.toggleTodo(id, done)),

    deleteTodo: (id: number) => withPending(() => workspace.deleteTodo(id)),

    changeCategory: (id: number, category_id: number | null) => withPending(() => workspace.changeCategory(id, category_id)),

    changeDueDate: (id: number, due_date: string | null) => withPending(() => workspace.changeDueDate(id, due_date)),

    changeDescription: (id: number, description: string | null) => withPending(() => workspace.changeDescription(id, description)),

    changePriority: (id: number, priority: 'high' | 'medium' | 'low' | null) => withPending(() => workspace.changePriority(id, priority)),

    changeTitle: (id: number, text: string) => withPending(() => workspace.changeTitle(id, text)),

    addCategory: (name: string, color: string) => withPending(() => workspace.addCategory(name, color)),

    deleteCategory: (id: number) => withPending(() => workspace.deleteCategory(id)),

    createTemplate: (todo_id: number, config: SetRecurrenceConfig) => withPending(() => workspace.createTemplate(todo_id, config)),

    deleteTemplate: (id: number) => withPending(() => workspace.deleteTemplate(id)),
  }
}
