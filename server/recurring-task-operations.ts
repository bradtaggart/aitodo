import Database from 'better-sqlite3'
import { advanceByRecurrence } from '../src/utils/recurrence-math.ts'

export interface TodoRow {
  id: number
  text: string
  done: number
  completed_at: string | null
  created_at: string
  parent_id: number | null
  category_id: number | null
  due_date: string | null
  description: string | null
  template_id: number | null
  priority: string | null
}

export interface TemplateRow {
  id: number
  text: string
  category_id: number | null
  description: string | null
  recurrence_type: string
  day_mask: number | null
  interval_days: number | null
  day_of_month: number | null
}

export type TodoResponseRow = Omit<TodoRow, 'done'> & { done: boolean }

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

export function createRecurringTaskOperations(db: Database.Database) {
  const stmts = {
    getChildren: db.prepare<[number], { id: number }>('SELECT id FROM todos WHERE parent_id = ?'),
    updateDone: db.prepare<[number, string | null, number], Database.RunResult>('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?'),
    deleteTodo: db.prepare<[number], Database.RunResult>('DELETE FROM todos WHERE id = ?'),
    getTodo: db.prepare<[number], TodoRow>('SELECT * FROM todos WHERE id = ?'),
    getTemplateById: db.prepare<[number], TemplateRow>('SELECT * FROM recurring_templates WHERE id = ?'),
    insertTemplate: db.prepare<[string, number | null, string | null, string, number | null, number | null, number | null], Database.RunResult>(
      'INSERT INTO recurring_templates (text, category_id, description, recurrence_type, day_mask, interval_days, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    deleteTemplate: db.prepare<[number], Database.RunResult>('DELETE FROM recurring_templates WHERE id = ?'),
    getUndoneTodosByTemplate: db.prepare<[number], { id: number }>('SELECT id FROM todos WHERE template_id = ? AND done = 0'),
    nullifyTemplateRef: db.prepare<[number], Database.RunResult>('UPDATE todos SET template_id = NULL WHERE template_id = ?'),
    updateTodoTemplate: db.prepare<[number, number], Database.RunResult>('UPDATE todos SET template_id = ? WHERE id = ?'),
    spawnTodo: db.prepare<[string, number | null, string | null, string, string, number], Database.RunResult>(
      'INSERT INTO todos (text, category_id, description, created_at, due_date, template_id) VALUES (?, ?, ?, ?, ?, ?)',
    ),
  }

  function deleteTree(id: number) {
    for (const child of stmts.getChildren.all(id)) deleteTree(child.id)
    stmts.deleteTodo.run(id)
  }

  return {
    completeTodo(id: number, done: boolean): { spawned: TodoRow | null } {
      const completedAt = done ? new Date().toISOString() : null

      const spawned = db.transaction((todoId: number) => {
        function updateTree(nodeId: number) {
          stmts.updateDone.run(done ? 1 : 0, completedAt, nodeId)
          if (done) {
            for (const child of stmts.getChildren.all(nodeId)) updateTree(child.id)
          }
        }
        updateTree(todoId)

        if (!done) return null

        const todo = stmts.getTodo.get(todoId)
        if (!todo?.template_id || !todo.due_date) return null

        const template = stmts.getTemplateById.get(todo.template_id)
        if (!template) return null

        const nextDue = advanceByRecurrence(template, todo.due_date)
        const createdAt = new Date().toISOString()
        const spawnResult = stmts.spawnTodo.run(
          template.text,
          template.category_id,
          template.description,
          createdAt,
          nextDue,
          template.id,
        )
        return stmts.getTodo.get(Number(spawnResult.lastInsertRowid)) ?? null
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

      const todo = stmts.getTodo.get(todoId)
      if (!todo) throw new RecurringTaskOperationError('todo not found')
      if (!todo.due_date) throw new RecurringTaskOperationError('todo must have a due_date')

      const dayOfMonth = recurrence_type === 'monthly' ? Number(todo.due_date.slice(8, 10)) : null
      const maskValue = recurrence_type === 'weekly' ? (day_mask ?? null) : null
      const intervalValue = recurrence_type === 'custom' ? (interval_days ?? null) : null

      return db.transaction(() => {
        const templateResult = stmts.insertTemplate.run(
          todo.text,
          todo.category_id,
          todo.description,
          recurrence_type,
          maskValue,
          intervalValue,
          dayOfMonth,
        )
        const templateId = Number(templateResult.lastInsertRowid)
        stmts.updateTodoTemplate.run(templateId, todoId)
        const template = stmts.getTemplateById.get(templateId)!
        const updatedTodo = stmts.getTodo.get(todoId)!
        return { template, todo: { ...updatedTodo, done: !!updatedTodo.done } }
      })()
    },

    deleteTodo(id: number): void {
      db.transaction((todoId: number) => {
        const todo = stmts.getTodo.get(todoId)
        const templateId = todo?.template_id

        deleteTree(todoId)

        if (templateId && !todo!.done) {
          for (const { id: siblingId } of stmts.getUndoneTodosByTemplate.all(templateId)) {
            deleteTree(siblingId)
          }
          stmts.nullifyTemplateRef.run(templateId)
          stmts.deleteTemplate.run(templateId)
        }
      })(id)
    },

    deleteTemplate(id: number): void {
      try {
        db.pragma('foreign_keys = OFF')
        stmts.deleteTemplate.run(id)
      } finally {
        db.pragma('foreign_keys = ON')
      }
    },
  }
}
