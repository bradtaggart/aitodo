import { deriveRecurrenceFields, nextRecurrenceDate, validateRecurrenceConfig } from '../src/recurrence-rules.ts'
import {
  createTaskPersistence,
  type AccountTaskWorkspace,
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
  function deleteTree(workspace: AccountTaskWorkspace, id: number) {
    for (const child of workspace.getChildren(id)) deleteTree(workspace, child.id)
    workspace.deleteTodoRow(id)
  }

  return {
    completeTodo(id: number, done: boolean, userId?: number): { spawned: TodoRow | null } {
      const completedAt = done ? new Date().toISOString() : null

      const spawned = persistence.db.transaction((todoId: number) => {
        const initial = persistence.getTodo(todoId)
        if (!initial || (userId !== undefined && initial.user_id !== userId)) {
          throw new RecurringTaskOperationError('todo not found', 404)
        }
        const workspace = persistence.forAccount(initial.user_id)

        function updateTree(nodeId: number) {
          workspace.updateDone(nodeId, done, completedAt)
          if (done) {
            for (const child of workspace.getChildren(nodeId)) updateTree(child.id)
          }
        }
        updateTree(todoId)

        if (!done) return null

        const todo = workspace.getTodo(todoId)
        if (!todo?.template_id || !todo.due_date) return null

        const template = workspace.getTemplate(todo.template_id)
        if (!template) return null

        const nextDue = nextRecurrenceDate(template, todo.due_date)
        const createdAt = new Date().toISOString()
        const spawnedId = workspace.spawnTodo(
          template.text,
          template.category_id,
          template.description,
          createdAt,
          nextDue,
          template.id,
        )
        return workspace.getTodo(spawnedId)
      })(id)

      return { spawned }
    },

    setRecurrence(todoId: number, config: SetRecurrenceConfig, userId: number): { template: TemplateRow; todo: TodoResponseRow } {
      try {
        validateRecurrenceConfig(config)
      } catch (err) {
        throw new RecurringTaskOperationError((err as Error).message)
      }

      const workspace = persistence.forAccount(userId)
      const todo = workspace.getTodo(todoId)
      if (!todo) throw new RecurringTaskOperationError('todo not found', 404)
      if (!todo.due_date) throw new RecurringTaskOperationError('todo must have a due_date')

      const fields = deriveRecurrenceFields(config, todo.due_date)

      return persistence.db.transaction(() => {
        const templateId = workspace.insertTemplate(
          todo.text,
          todo.category_id,
          todo.description,
          fields.recurrence_type,
          fields.day_mask,
          fields.interval_days,
          fields.day_of_month,
        )
        workspace.updateTodoTemplate(templateId, todoId)
        const template = workspace.getTemplate(templateId)!
        const updatedTodo = workspace.getTodo(todoId)!
        return { template, todo: { ...updatedTodo, done: !!updatedTodo.done } }
      })()
    },

    deleteTodo(id: number, userId: number): void {
      persistence.db.transaction((todoId: number) => {
        const workspace = persistence.forAccount(userId)
        const todo = workspace.getTodo(todoId)
        if (!todo) throw new RecurringTaskOperationError('todo not found', 404)
        const templateId = todo?.template_id

        deleteTree(workspace, todoId)

        if (templateId && !todo!.done) {
          for (const { id: siblingId } of workspace.getUndoneTodosByTemplate(templateId)) {
            deleteTree(workspace, siblingId)
          }
          workspace.nullifyTemplateRef(templateId)
          workspace.deleteTemplateRow(templateId)
        }
      })(id)
    },

    deleteTemplate(id: number, userId: number): void {
      const workspace = persistence.forAccount(userId)
      const template = workspace.getTemplate(id)
      if (!template) throw new RecurringTaskOperationError('template not found', 404)
      try {
        persistence.db.pragma('foreign_keys = OFF')
        workspace.deleteTemplateRow(id)
      } finally {
        persistence.db.pragma('foreign_keys = ON')
      }
    },
  }
}
