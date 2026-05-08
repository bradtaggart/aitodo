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
  user_id: number
}

export interface CategoryRow {
  id: number
  name: string
  color: string
  user_id: number
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
  user_id: number
}

export interface UserRow {
  id: number
  name: string
  email: string | null
  password_hash: string | null
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
    listTodos: db.prepare<[number], TodoRow>('SELECT * FROM todos WHERE user_id = ? ORDER BY id'),
    getTodo: db.prepare<[number], TodoRow>('SELECT * FROM todos WHERE id = ?'),
    getTodoId: db.prepare<[number, number], { id: number }>('SELECT id FROM todos WHERE id = ? AND user_id = ?'),
    getCategoryId: db.prepare<[number, number], { id: number }>('SELECT id FROM categories WHERE id = ? AND user_id = ?'),
    getChildren: db.prepare<[number], { id: number }>('SELECT id FROM todos WHERE parent_id = ?'),
    insertTodo: db.prepare<[string, number | null, string, number | null, number], Database.RunResult>(
      'INSERT INTO todos (text, parent_id, created_at, category_id, user_id) VALUES (?, ?, ?, ?, ?)',
    ),
    updateDone: db.prepare<[number, string | null, number], Database.RunResult>('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?'),
    updateCategory: db.prepare<[number | null, number], Database.RunResult>('UPDATE todos SET category_id = ? WHERE id = ?'),
    updateDueDate: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET due_date = ? WHERE id = ?'),
    updateDescription: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET description = ? WHERE id = ?'),
    updatePriority: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET priority = ? WHERE id = ?'),
    updateText: db.prepare<[string, number], Database.RunResult>('UPDATE todos SET text = ? WHERE id = ?'),
    deleteTodo: db.prepare<[number], Database.RunResult>('DELETE FROM todos WHERE id = ?'),
    listCategories: db.prepare<[number], CategoryRow>('SELECT * FROM categories WHERE user_id = ? ORDER BY id'),
    getCategory: db.prepare<[number], CategoryRow>('SELECT * FROM categories WHERE id = ?'),
    insertCategory: db.prepare<[string, string, number], Database.RunResult>('INSERT INTO categories (name, color, user_id) VALUES (?, ?, ?)'),
    deleteCategory: db.prepare<[number], Database.RunResult>('DELETE FROM categories WHERE id = ?'),
    clearTodoCategory: db.prepare<[number], { id: number }>('UPDATE todos SET category_id = NULL WHERE category_id = ? RETURNING id'),
    listTemplates: db.prepare<[number], TemplateRow>('SELECT * FROM recurring_templates WHERE user_id = ? ORDER BY id'),
    getTemplate: db.prepare<[number], TemplateRow>('SELECT * FROM recurring_templates WHERE id = ?'),
    insertTemplate: db.prepare<[string, number | null, string | null, string, number | null, number | null, number | null, number], Database.RunResult>(
      'INSERT INTO recurring_templates (text, category_id, description, recurrence_type, day_mask, interval_days, day_of_month, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    deleteTemplate: db.prepare<[number], Database.RunResult>('DELETE FROM recurring_templates WHERE id = ?'),
    getUndoneTodosByTemplate: db.prepare<[number], { id: number }>('SELECT id FROM todos WHERE template_id = ? AND done = 0'),
    nullifyTemplateRef: db.prepare<[number], Database.RunResult>('UPDATE todos SET template_id = NULL WHERE template_id = ?'),
    updateTodoTemplate: db.prepare<[number, number], Database.RunResult>('UPDATE todos SET template_id = ? WHERE id = ?'),
    spawnTodo: db.prepare<[string, number | null, string | null, string, string, number, number], Database.RunResult>(
      'INSERT INTO todos (text, category_id, description, created_at, due_date, template_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    getMe: db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?'),
    updateMe: db.prepare<[string, number], Database.RunResult>('UPDATE users SET preferences = ? WHERE id = ?'),
    getUserByEmail: db.prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?'),
    insertUser: db.prepare<[string, string, string], Database.RunResult>('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'),
    claimDefaultUser: db.prepare<[string, string, string, number], Database.RunResult>('UPDATE users SET email = ?, password_hash = ?, name = ? WHERE id = ?'),
    getUnclaimedDefault: db.prepare<[], { id: number } | undefined>('SELECT id FROM users WHERE email IS NULL LIMIT 1'),
  }

  return {
    db,

    listTodos: (userId: number) => stmts.listTodos.all(userId),

    getTodo: (id: number) => stmts.getTodo.get(id) ?? null,

    createTodo({ text, parent_id = null, category_id = null, user_id }: { text: string; parent_id?: number | null; category_id?: number | null; user_id: number }): TodoRow {
      if (!text || typeof text !== 'string' || !text.trim()) {
        throw new TaskPersistenceError('text is required')
      }
      if (parent_id !== null && !stmts.getTodoId.get(parent_id, user_id)) {
        throw new TaskPersistenceError('parent not found')
      }
      if (category_id !== null && !stmts.getCategoryId.get(category_id, user_id)) {
        throw new TaskPersistenceError('category not found')
      }

      const created_at = new Date().toISOString()
      const trimmed = text.trim()
      const result = stmts.insertTodo.run(trimmed, parent_id, created_at, category_id, user_id)
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
        user_id,
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

    listCategories: (userId: number) => stmts.listCategories.all(userId),

    getCategory: (id: number) => stmts.getCategory.get(id) ?? null,

    createCategory(name: string, color: string, userId: number): CategoryRow {
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new TaskPersistenceError('name is required')
      }
      if (!color || typeof color !== 'string') {
        throw new TaskPersistenceError('color is required')
      }

      const trimmed = name.trim()
      const result = stmts.insertCategory.run(trimmed, color, userId)
      return { id: Number(result.lastInsertRowid), name: trimmed, color, user_id: userId }
    },

    deleteCategory(id: number): { ok: true; affectedTodoIds: number[] } {
      const affected = stmts.clearTodoCategory.all(id)
      stmts.deleteCategory.run(id)
      return { ok: true, affectedTodoIds: affected.map(row => row.id) }
    },

    listTemplates: (userId: number) => stmts.listTemplates.all(userId),
    getTemplate: (id: number) => stmts.getTemplate.get(id) ?? null,

    insertTemplate(
      text: string,
      categoryId: number | null,
      description: string | null,
      recurrenceType: string,
      dayMask: number | null,
      intervalDays: number | null,
      dayOfMonth: number | null,
      userId: number,
    ): number {
      return Number(stmts.insertTemplate.run(text, categoryId, description, recurrenceType, dayMask, intervalDays, dayOfMonth, userId).lastInsertRowid)
    },

    deleteTemplateRow: (id: number) => stmts.deleteTemplate.run(id),
    getUndoneTodosByTemplate: (id: number) => stmts.getUndoneTodosByTemplate.all(id),
    nullifyTemplateRef: (id: number) => stmts.nullifyTemplateRef.run(id),
    updateTodoTemplate: (templateId: number, todoId: number) => stmts.updateTodoTemplate.run(templateId, todoId),

    spawnTodo(text: string, categoryId: number | null, description: string | null, createdAt: string, dueDate: string, templateId: number, userId: number): number {
      return Number(stmts.spawnTodo.run(text, categoryId, description, createdAt, dueDate, templateId, userId).lastInsertRowid)
    },

    getMe: (userId: number) => stmts.getMe.get(userId) ?? null,
    updateMe: (userId: number, preferences: string) => stmts.updateMe.run(preferences, userId),

    getUserByEmail: (email: string) => stmts.getUserByEmail.get(email) ?? null,

    createUser(email: string, passwordHash: string, name: string): UserRow {
      const unclaimed = stmts.getUnclaimedDefault.get()
      if (unclaimed) {
        stmts.claimDefaultUser.run(email, passwordHash, name, unclaimed.id)
        return { id: unclaimed.id, email, password_hash: passwordHash, name, preferences: '{}' }
      }
      const result = stmts.insertUser.run(email, passwordHash, name)
      return { id: Number(result.lastInsertRowid), email, password_hash: passwordHash, name, preferences: '{}' }
    },

    forAccount(accountId: number) {
      function getTodo(id: number): TodoRow | null {
        const todo = stmts.getTodo.get(id)
        return todo?.user_id === accountId ? todo : null
      }

      function getCategory(id: number): CategoryRow | null {
        const category = stmts.getCategory.get(id)
        return category?.user_id === accountId ? category : null
      }

      function getTemplate(id: number): TemplateRow | null {
        const template = stmts.getTemplate.get(id)
        return template?.user_id === accountId ? template : null
      }

      return {
        db,
        accountId,
        listTodos: () => stmts.listTodos.all(accountId),
        getTodo,
        createTodo({ text, parent_id = null, category_id = null }: { text: string; parent_id?: number | null; category_id?: number | null }) {
          if (!text || typeof text !== 'string' || !text.trim()) {
            throw new TaskPersistenceError('text is required')
          }
          if (parent_id !== null && !getTodo(parent_id)) {
            throw new TaskPersistenceError('parent not found')
          }
          if (category_id !== null && !getCategory(category_id)) {
            throw new TaskPersistenceError('category not found')
          }

          const created_at = new Date().toISOString()
          const trimmed = text.trim()
          const result = stmts.insertTodo.run(trimmed, parent_id, created_at, category_id, accountId)
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
            user_id: accountId,
          }
        },
        listCategories: () => stmts.listCategories.all(accountId),
        getCategory,
        createCategory(name: string, color: string): CategoryRow {
          if (!name || typeof name !== 'string' || !name.trim()) {
            throw new TaskPersistenceError('name is required')
          }
          if (!color || typeof color !== 'string') {
            throw new TaskPersistenceError('color is required')
          }

          const trimmed = name.trim()
          const result = stmts.insertCategory.run(trimmed, color, accountId)
          return { id: Number(result.lastInsertRowid), name: trimmed, color, user_id: accountId }
        },
        deleteCategory(id: number): { ok: true; affectedTodoIds: number[] } {
          if (!getCategory(id)) throw new TaskPersistenceError('category not found', 404)
          const affected = stmts.clearTodoCategory.all(id)
          stmts.deleteCategory.run(id)
          return { ok: true, affectedTodoIds: affected.map(row => row.id) }
        },
        listTemplates: () => stmts.listTemplates.all(accountId),
        getTemplate,
        getChildren: (id: number) => stmts.getChildren.all(id).filter(child => getTodo(child.id)),
        updateDone: (id: number, done: boolean, completedAt: string | null) => stmts.updateDone.run(done ? 1 : 0, completedAt, id),
        updateCategory(id: number, categoryId: number | null) {
          if (!getTodo(id)) throw new TaskPersistenceError('todo not found', 404)
          if (categoryId !== null && !getCategory(categoryId)) throw new TaskPersistenceError('category not found')
          return stmts.updateCategory.run(categoryId, id)
        },
        updateDueDate: (id: number, dueDate: string | null) => stmts.updateDueDate.run(dueDate, id),
        updateDescription: (id: number, description: string | null) => stmts.updateDescription.run(description, id),
        updatePriority: (id: number, priority: string | null) => stmts.updatePriority.run(priority, id),
        updateText: (id: number, text: string) => stmts.updateText.run(text, id),
        deleteTodoRow: (id: number) => stmts.deleteTodo.run(id),
        insertTemplate(
          text: string,
          categoryId: number | null,
          description: string | null,
          recurrenceType: string,
          dayMask: number | null,
          intervalDays: number | null,
          dayOfMonth: number | null,
        ): number {
          if (categoryId !== null && !getCategory(categoryId)) throw new TaskPersistenceError('category not found')
          return Number(stmts.insertTemplate.run(text, categoryId, description, recurrenceType, dayMask, intervalDays, dayOfMonth, accountId).lastInsertRowid)
        },
        deleteTemplateRow: (id: number) => stmts.deleteTemplate.run(id),
        getUndoneTodosByTemplate: (id: number) => stmts.getUndoneTodosByTemplate.all(id).filter(todo => getTodo(todo.id)),
        nullifyTemplateRef: (id: number) => stmts.nullifyTemplateRef.run(id),
        updateTodoTemplate: (templateId: number, todoId: number) => stmts.updateTodoTemplate.run(templateId, todoId),
        spawnTodo(text: string, categoryId: number | null, description: string | null, createdAt: string, dueDate: string, templateId: number): number {
          return Number(stmts.spawnTodo.run(text, categoryId, description, createdAt, dueDate, templateId, accountId).lastInsertRowid)
        },
      }
    },
  }
}

export type TaskPersistence = ReturnType<typeof createTaskPersistence>
export type AccountTaskWorkspace = ReturnType<TaskPersistence['forAccount']>
