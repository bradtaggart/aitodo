import { advanceByRecurrence } from '../src/utils/recurrence-math.ts'
import {
  createTaskPersistence,
  type TaskPersistence,
  type TemplateRow,
  type TodoResponseRow,
  type TodoRow,
} from './task-persistence.ts'

export interface SetRecurrenceConfig {
  recurrence_type?: string
  day_mask?: number
  interval_days?: number
}

export class RecurringTaskOperationError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export function createRecurringTaskOperations(persistence: TaskPersistence): ReturnType<typeof buildRecurringTaskOperations>
export function createRecurringTaskOperations(db: Parameters<typeof createTaskPersistence>[0]): ReturnType<typeof buildRecurringTaskOperations>
export function createRecurringTaskOperations(input: TaskPersistence | Parameters<typeof createTaskPersistence>[0]) {
  const persistence = 'listTodos' in input ? input : createTaskPersistence(input)
  return buildRecurringTaskOperations(persistence)
}

function buildRecurringTaskOperations(persistence: TaskPersistence) {
  function deleteTree(id: number) {
    for (const child of persistence.getChildren(id)) deleteTree(child.id)
    persistence.deleteTodoRow(id)
  }

  return {
    completeTodo(id: number, done: boolean): { spawned: TodoRow | null } {
      const completedAt = done ? new Date().toISOString() : null

      const spawned = persistence.db.transaction((todoId: number) => {
        function updateTree(nodeId: number) {
          persistence.updateDone(nodeId, done, completedAt)
          if (done) {
            for (const child of persistence.getChildren(nodeId)) updateTree(child.id)
          }
        }
        updateTree(todoId)

        if (!done) return null

        const todo = persistence.getTodo(todoId)
        if (!todo?.template_id || !todo.due_date) return null

        const template = persistence.getTemplate(todo.template_id)
        if (!template) return null

        const nextDue = advanceByRecurrence(template, todo.due_date)
        const createdAt = new Date().toISOString()
        const spawnedId = persistence.spawnTodo(
          template.text,
          template.category_id,
          template.description,
          createdAt,
          nextDue,
          template.id,
        )
        return persistence.getTodo(spawnedId)
      })(id)

      return { spawned }
    },

    setRecurrence(todoId: number, config: SetRecurrenceConfig): { template: TemplateRow; todo: TodoResponseRow } {
      const { recurrence_type, day_mask, interval_days } = config

      const validTypes = ['daily', 'weekly', 'monthly', 'custom']
      if (!recurrence_type || !validTypes.includes(recurrence_type)) {
        throw new RecurringTaskOperationError('recurrence_type must be daily|weekly|monthly|custom')
      }
      if (recurrence_type === 'weekly' && !(day_mask && day_mask > 0)) {
        throw new RecurringTaskOperationError('day_mask required and non-zero for weekly')
      }
      if (recurrence_type === 'custom' && (!interval_days || interval_days < 1)) {
        throw new RecurringTaskOperationError('interval_days required and >= 1 for custom')
      }

      const todo = persistence.getTodo(todoId)
      if (!todo) throw new RecurringTaskOperationError('todo not found')
      if (!todo.due_date) throw new RecurringTaskOperationError('todo must have a due_date')

      const dayOfMonth = recurrence_type === 'monthly' ? Number(todo.due_date.slice(8, 10)) : null
      const maskValue = recurrence_type === 'weekly' ? (day_mask ?? null) : null
      const intervalValue = recurrence_type === 'custom' ? (interval_days ?? null) : null

      return persistence.db.transaction(() => {
        const templateId = persistence.insertTemplate(
          todo.text,
          todo.category_id,
          todo.description,
          recurrence_type,
          maskValue,
          intervalValue,
          dayOfMonth,
        )
        persistence.updateTodoTemplate(templateId, todoId)
        const template = persistence.getTemplate(templateId)!
        const updatedTodo = persistence.getTodo(todoId)!
        return { template, todo: { ...updatedTodo, done: !!updatedTodo.done } }
      })()
    },

    deleteTodo(id: number): void {
      persistence.db.transaction((todoId: number) => {
        const todo = persistence.getTodo(todoId)
        const templateId = todo?.template_id

        deleteTree(todoId)

        if (templateId && !todo!.done) {
          for (const { id: siblingId } of persistence.getUndoneTodosByTemplate(templateId)) {
            deleteTree(siblingId)
          }
          persistence.nullifyTemplateRef(templateId)
          persistence.deleteTemplateRow(templateId)
        }
      })(id)
    },

    deleteTemplate(id: number): void {
      try {
        persistence.db.pragma('foreign_keys = OFF')
        persistence.deleteTemplateRow(id)
      } finally {
        persistence.db.pragma('foreign_keys = ON')
      }
    },
  }
}
