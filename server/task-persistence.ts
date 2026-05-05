import Database from 'better-sqlite3'

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

export interface CategoryRow {
  id: number
  name: string
  color: string
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

export interface UserRow {
  id: number
  name: string
  preferences: string
}

export type TodoResponseRow = Omit<TodoRow, 'done'> & { done: boolean }

export class TaskPersistenceError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export function createTaskPersistence(db: Database.Database) {
  const stmts = {
    listTodos: db.prepare<[], TodoRow>('SELECT * FROM todos ORDER BY id'),
    getTodoId: db.prepare<[number], { id: number }>('SELECT id FROM todos WHERE id = ?'),
    getCategoryId: db.prepare<[number], { id: number }>('SELECT id FROM categories WHERE id = ?'),
    getChildren: db.prepare<[number], { id: number }>('SELECT id FROM todos WHERE parent_id = ?'),
    insertTodo: db.prepare<[string, number | null, string, number | null], Database.RunResult>('INSERT INTO todos (text, parent_id, created_at, category_id) VALUES (?, ?, ?, ?)'),
    updateDone: db.prepare<[number, string | null, number], Database.RunResult>('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?'),
    updateCategory: db.prepare<[number | null, number], Database.RunResult>('UPDATE todos SET category_id = ? WHERE id = ?'),
    updateDueDate: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET due_date = ? WHERE id = ?'),
    updateDescription: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET description = ? WHERE id = ?'),
    updatePriority: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET priority = ? WHERE id = ?'),
    updateText: db.prepare<[string, number], Database.RunResult>('UPDATE todos SET text = ? WHERE id = ?'),
    deleteTodo: db.prepare<[number], Database.RunResult>('DELETE FROM todos WHERE id = ?'),
    getTodo: db.prepare<[number], TodoRow>('SELECT * FROM todos WHERE id = ?'),
    listCategories: db.prepare<[], CategoryRow>('SELECT * FROM categories ORDER BY id'),
    insertCategory: db.prepare<[string, string], Database.RunResult>('INSERT INTO categories (name, color) VALUES (?, ?)'),
    deleteCategory: db.prepare<[number], Database.RunResult>('DELETE FROM categories WHERE id = ?'),
    clearTodoCategory: db.prepare<[number], { id: number }>('UPDATE todos SET category_id = NULL WHERE category_id = ? RETURNING id'),
    listTemplates: db.prepare<[], TemplateRow>('SELECT * FROM recurring_templates ORDER BY id'),
    getTemplate: db.prepare<[number], TemplateRow>('SELECT * FROM recurring_templates WHERE id = ?'),
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
    getMe: db.prepare<[], UserRow>('SELECT * FROM users WHERE id = 1'),
    updateMe: db.prepare<[string], Database.RunResult>('UPDATE users SET preferences = ? WHERE id = 1'),
  }

  return {
    db,

    listTodos: () => stmts.listTodos.all(),

    getTodo: (id: number) => stmts.getTodo.get(id) ?? null,

    createTodo({ text, parent_id = null, category_id = null }: { text: string; parent_id?: number | null; category_id?: number | null }): TodoRow {
      if (!text || typeof text !== 'string' || !text.trim()) {
        throw new TaskPersistenceError('text is required')
      }
      if (parent_id !== null && !stmts.getTodoId.get(parent_id)) {
        throw new TaskPersistenceError('parent not found')
      }
      if (category_id !== null && !stmts.getCategoryId.get(category_id)) {
        throw new TaskPersistenceError('category not found')
      }

      const created_at = new Date().toISOString()
      const trimmed = text.trim()
      const result = stmts.insertTodo.run(trimmed, parent_id, created_at, category_id)
      return {
        id: Number(result.lastInsertRowid),
        text: trimmed,
        done: 0,
        completed_at: null,
        created_at,
        parent_id,
        category_id,
        due_date: null,
        description: null,
        template_id: null,
        priority: null,
      }
    },

    getChildren: (id: number) => stmts.getChildren.all(id),
    updateDone: (id: number, done: boolean, completedAt: string | null) => stmts.updateDone.run(done ? 1 : 0, completedAt, id),
    updateCategory: (id: number, categoryId: number | null) => stmts.updateCategory.run(categoryId, id),
    updateDueDate: (id: number, dueDate: string | null) => stmts.updateDueDate.run(dueDate, id),
    updateDescription: (id: number, description: string | null) => stmts.updateDescription.run(description, id),
    updatePriority: (id: number, priority: string | null) => stmts.updatePriority.run(priority, id),
    updateText: (id: number, text: string) => stmts.updateText.run(text, id),
    deleteTodoRow: (id: number) => stmts.deleteTodo.run(id),

    listCategories: () => stmts.listCategories.all(),

    createCategory(name: string, color: string): CategoryRow {
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new TaskPersistenceError('name is required')
      }
      if (!color || typeof color !== 'string') {
        throw new TaskPersistenceError('color is required')
      }

      const trimmed = name.trim()
      const result = stmts.insertCategory.run(trimmed, color)
      return { id: Number(result.lastInsertRowid), name: trimmed, color }
    },

    deleteCategory(id: number): { ok: true; affectedTodoIds: number[] } {
      const affected = stmts.clearTodoCategory.all(id)
      stmts.deleteCategory.run(id)
      return { ok: true, affectedTodoIds: affected.map(row => row.id) }
    },

    listTemplates: () => stmts.listTemplates.all(),
    getTemplate: (id: number) => stmts.getTemplate.get(id) ?? null,

    insertTemplate(
      text: string,
      categoryId: number | null,
      description: string | null,
      recurrenceType: string,
      dayMask: number | null,
      intervalDays: number | null,
      dayOfMonth: number | null,
    ): number {
      return Number(stmts.insertTemplate.run(text, categoryId, description, recurrenceType, dayMask, intervalDays, dayOfMonth).lastInsertRowid)
    },

    deleteTemplateRow: (id: number) => stmts.deleteTemplate.run(id),
    getUndoneTodosByTemplate: (id: number) => stmts.getUndoneTodosByTemplate.all(id),
    nullifyTemplateRef: (id: number) => stmts.nullifyTemplateRef.run(id),
    updateTodoTemplate: (templateId: number, todoId: number) => stmts.updateTodoTemplate.run(templateId, todoId),

    spawnTodo(text: string, categoryId: number | null, description: string | null, createdAt: string, dueDate: string, templateId: number): number {
      return Number(stmts.spawnTodo.run(text, categoryId, description, createdAt, dueDate, templateId).lastInsertRowid)
    },

    getMe: () => stmts.getMe.get(),
    updateMe: (preferences: string) => stmts.updateMe.run(preferences),
  }
}

export type TaskPersistence = ReturnType<typeof createTaskPersistence>
