import express, { Request, Response } from 'express'
import Database from 'better-sqlite3'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import {
  createRecurringTaskOperations,
  RecurringTaskOperationError,
} from './server/recurring-task-operations.ts'
import { createTaskMutations, TaskMutationError, type TaskPatch } from './server/task-mutations.ts'
import { createTaskPersistence, TaskPersistenceError } from './server/task-persistence.ts'

export function initDb(db: Database.Database) {
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      parent_id INTEGER REFERENCES todos(id),
      category_id INTEGER REFERENCES categories(id)
    )
  `)

  const todoCols = (db.prepare("PRAGMA table_info(todos)").all() as { name: string }[]).map(c => c.name)
  if (!todoCols.includes('completed_at')) db.exec('ALTER TABLE todos ADD COLUMN completed_at TEXT')
  if (!todoCols.includes('created_at')) {
    db.exec('ALTER TABLE todos ADD COLUMN created_at TEXT')
    db.exec("UPDATE todos SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE created_at IS NULL")
  }
  if (!todoCols.includes('parent_id')) db.exec('ALTER TABLE todos ADD COLUMN parent_id INTEGER REFERENCES todos(id)')
  if (!todoCols.includes('category_id')) db.exec('ALTER TABLE todos ADD COLUMN category_id INTEGER REFERENCES categories(id)')
  if (!todoCols.includes('due_date')) db.exec('ALTER TABLE todos ADD COLUMN due_date TEXT')
  if (!todoCols.includes('description')) db.exec('ALTER TABLE todos ADD COLUMN description TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_templates (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      text            TEXT NOT NULL,
      category_id     INTEGER REFERENCES categories(id),
      description     TEXT,
      recurrence_type TEXT NOT NULL,
      day_mask        INTEGER,
      interval_days   INTEGER,
      day_of_month    INTEGER
    )
  `)

  if (!todoCols.includes('template_id')) {
    db.exec('ALTER TABLE todos ADD COLUMN template_id INTEGER REFERENCES recurring_templates(id)')
  }
  if (!todoCols.includes('priority')) db.exec("ALTER TABLE todos ADD COLUMN priority TEXT")

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      preferences TEXT NOT NULL DEFAULT '{}'
    )
  `)

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count
  if (userCount === 0) {
    db.prepare('INSERT INTO users (name, preferences) VALUES (?, ?)').run('default', '{}')
  }
}


export function createApp(db: Database.Database) {
  const persistence = createTaskPersistence(db)
  const recurringTasks = createRecurringTaskOperations(persistence)
  const taskMutations = createTaskMutations(persistence)

  const app = express()
  if (process.env.NODE_ENV !== 'production') {
    app.use(cors({ origin: 'http://localhost:5173' }))
  }
  app.use(express.json())

  app.get('/api/todos', (_req: Request, res: Response) => {
    try {
      res.json(persistence.listTodos())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/todos', (req: Request, res: Response) => {
    try {
      const { text, parent_id = null, category_id = null } = req.body as { text: string; parent_id?: number | null; category_id?: number | null }
      res.json(persistence.createTodo({ text, parent_id, category_id }))
    } catch (err) {
      if (err instanceof TaskPersistenceError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.patch('/api/todos/:id', (req: Request, res: Response) => {
    try {
      res.json(taskMutations.applyPatch(Number(req.params.id), req.body as TaskPatch))
    } catch (err) {
      if (err instanceof TaskMutationError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/todos/:id', (req: Request, res: Response) => {
    try {
      recurringTasks.deleteTodo(Number(req.params.id))
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/categories', (_req: Request, res: Response) => {
    try {
      res.json(persistence.listCategories())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/categories', (req: Request, res: Response) => {
    try {
      const { name, color } = req.body as { name: string; color: string }
      res.json(persistence.createCategory(name, color))
    } catch (err) {
      if (err instanceof TaskPersistenceError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/categories/:id', (req: Request, res: Response) => {
    try {
      res.json(persistence.deleteCategory(Number(req.params.id)))
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/templates', (_req: Request, res: Response) => {
    try {
      res.json(persistence.listTemplates())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/templates', (req: Request, res: Response) => {
    try {
      const { todo_id, recurrence_type, day_mask, interval_days } =
        req.body as { todo_id?: number; recurrence_type?: string; day_mask?: number; interval_days?: number }

      if (!todo_id) return res.status(400).json({ error: 'todo_id is required' })
      const result = recurringTasks.setRecurrence(Number(todo_id), { recurrence_type, day_mask, interval_days })

      res.json(result)
    } catch (err) {
      if (err instanceof RecurringTaskOperationError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/templates/:id', (req: Request, res: Response) => {
    try {
      recurringTasks.deleteTemplate(Number(req.params.id))
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/me', (_req: Request, res: Response) => {
    try {
      const user = persistence.getMe()!
      res.json({ ...user, preferences: JSON.parse(user.preferences) })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.patch('/api/me', (req: Request, res: Response) => {
    try {
      const user = persistence.getMe()!
      const current = JSON.parse(user.preferences)
      const updated = { ...current, ...(req.body as { preferences?: object }).preferences }
      persistence.updateMe(JSON.stringify(updated))
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'))
    app.use((_req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' })
    })
  }

  return app
}

export function startServer() {
  const dbPath = process.env.DB_PATH ?? join(dirname(fileURLToPath(import.meta.url)), 'todos.db')
  const db = new Database(dbPath)
  initDb(db)
  const app = createApp(db)
  const PORT = Number(process.env.PORT ?? 3001)
  return app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer()
}
