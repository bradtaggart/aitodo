import { createRecurringTaskOperations } from './recurring-task-operations.ts'
import type { TaskPersistence, TodoResponseRow } from './task-persistence.ts'

export type TaskPatch = {
  done?: boolean
  category_id?: number | null
  due_date?: string | null
  description?: string | null
  priority?: 'high' | 'medium' | 'low' | null
  text?: string
}

export class TaskMutationError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export function createTaskMutations(persistence: TaskPersistence) {
  const recurringTasks = createRecurringTaskOperations(persistence)

  return {
    applyPatch(id: number, patch: TaskPatch, userId: number): { ok: true; spawned: TodoResponseRow | null } {
      const workspace = persistence.forAccount(userId)
      const todo = workspace.getTodo(id)
      if (!todo) {
        throw new TaskMutationError('todo not found', 404)
      }

      let spawned: TodoResponseRow | null = null

      if (patch.done !== undefined) {
        const result = recurringTasks.completeTodo(id, patch.done, userId).spawned
        spawned = result ? { ...result, done: !!result.done } : null
      }
      if ('category_id' in patch) {
        if (patch.category_id !== null && patch.category_id !== undefined && !workspace.getCategory(patch.category_id)) {
          throw new TaskMutationError('category not found')
        }
        workspace.updateCategory(id, patch.category_id ?? null)
      }
      if ('due_date' in patch) {
        if (patch.due_date !== null && patch.due_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.due_date)) {
          throw new TaskMutationError('due_date must be YYYY-MM-DD or null')
        }
        workspace.updateDueDate(id, patch.due_date ?? null)
      }
      if ('description' in patch) {
        workspace.updateDescription(id, patch.description ?? null)
      }
      if ('priority' in patch) {
        const { priority } = patch
        if (priority !== null && priority !== undefined && !['high', 'medium', 'low'].includes(priority)) {
          throw new TaskMutationError('priority must be high, medium, low, or null')
        }
        workspace.updatePriority(id, priority ?? null)
      }
      if ('text' in patch) {
        const { text } = patch
        if (!text || typeof text !== 'string' || !text.trim()) {
          throw new TaskMutationError('text must be a non-empty string')
        }
        workspace.updateText(id, text.trim())
      }

      return { ok: true, spawned }
    },
  }
}
