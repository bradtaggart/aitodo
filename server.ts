import express, { Request, Response } from 'express'
import Database from 'better-sqlite3'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

interface TodoRow {
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

interface CategoryRow {
  id: number
  name: string
  color: string
}

interface TemplateRow {
  id: number
  text: string
  category_id: number | null
  description: string | null
  recurrence_type: string
  day_mask: number | null
  interval_days: number | null
  day_of_month: number | null
}

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
}

function nextOccurrence(template: TemplateRow, currentDue: string): string {
  const d = new Date(currentDue + 'T12:00:00Z')
  switch (template.recurrence_type) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1)
      break
    case 'weekly': {
      const mask = template.day_mask!
      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(d)
        candidate.setUTCDate(d.getUTCDate() + i)
        if (mask & (1 << candidate.getUTCDay())) {
          return candidate.toISOString().slice(0, 10)
        }
      }
      throw new Error('weekly template has no valid day in mask')
    }
    case 'monthly': {
      d.setUTCMonth(d.getUTCMonth() + 1)
      d.setUTCDate(template.day_of_month!)
      break
    }
    case 'custom':
      d.setUTCDate(d.getUTCDate() + template.interval_days!)
      break
  }
  return d.toISOString().slice(0, 10)
}

export function createApp(db: Database.Database) {
  const stmts = {
    getAll:        db.prepare<[], TodoRow>('SELECT * FROM todos ORDER BY id'),
    getById:       db.prepare<[number], { id: number }>('SELECT id FROM todos WHERE id = ?'),
    getCatById:    db.prepare<[number], { id: number }>('SELECT id FROM categories WHERE id = ?'),
    getChildren:   db.prepare<[number], { id: number }>('SELECT id FROM todos WHERE parent_id = ?'),
    insert:        db.prepare<[string, number | null, string, number | null], Database.RunResult>('INSERT INTO todos (text, parent_id, created_at, category_id) VALUES (?, ?, ?, ?)'),
    update:        db.prepare<[number, string | null, number], Database.RunResult>('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?'),
    updateCat:     db.prepare<[number | null, number], Database.RunResult>('UPDATE todos SET category_id = ? WHERE id = ?'),
    delete:        db.prepare<[number], Database.RunResult>('DELETE FROM todos WHERE id = ?'),
    getAllCats:    db.prepare<[], CategoryRow>('SELECT * FROM categories ORDER BY id'),
    insertCat:    db.prepare<[string, string], Database.RunResult>('INSERT INTO categories (name, color) VALUES (?, ?)'),
    deleteCat:    db.prepare<[number], Database.RunResult>('DELETE FROM categories WHERE id = ?'),
    clearTodoCat: db.prepare<[number], Database.RunResult>('UPDATE todos SET category_id = NULL WHERE category_id = ?'),
    updateDueDate: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET due_date = ? WHERE id = ?'),
    updateDescription: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET description = ? WHERE id = ?'),
    getAllTemplates:     db.prepare<[], TemplateRow>('SELECT * FROM recurring_templates ORDER BY id'),
    getTemplateById:    db.prepare<[number], TemplateRow>('SELECT * FROM recurring_templates WHERE id = ?'),
    insertTemplate:     db.prepare<[string, number | null, string | null, string, number | null, number | null, number | null], Database.RunResult>(
                          'INSERT INTO recurring_templates (text, category_id, description, recurrence_type, day_mask, interval_days, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    deleteTemplate: db.prepare<[number], Database.RunResult>('DELETE FROM recurring_templates WHERE id = ?'),
    getTodo:            db.prepare<[number], TodoRow>('SELECT * FROM todos WHERE id = ?'),
    updateTodoTemplate: db.prepare<[number, number], Database.RunResult>('UPDATE todos SET template_id = ? WHERE id = ?'),
    spawnTodo: db.prepare<[string, number | null, string | null, string, string, number], Database.RunResult>(
                 'INSERT INTO todos (text, category_id, description, created_at, due_date, template_id) VALUES (?, ?, ?, ?, ?, ?)'),
    updatePriority: db.prepare<[string | null, number], Database.RunResult>('UPDATE todos SET priority = ? WHERE id = ?'),
  }

  const app = express()
  if (process.env.NODE_ENV !== 'production') {
    app.use(cors({ origin: 'http://localhost:5173' }))
  }
  app.use(express.json())

  app.get('/api/todos', (_req: Request, res: Response) => {
    try {
      res.json(stmts.getAll.all())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/todos', (req: Request, res: Response) => {
    try {
      const { text, parent_id = null, category_id = null } = req.body as { text: string; parent_id?: number | null; category_id?: number | null }
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'text is required' })
      }
      if (parent_id !== null) {
        const parent = stmts.getById.get(parent_id)
        if (!parent) return res.status(400).json({ error: 'parent not found' })
      }
      if (category_id !== null) {
        const cat = stmts.getCatById.get(category_id)
        if (!cat) return res.status(400).json({ error: 'category not found' })
      }
      const created_at = new Date().toISOString()
      const result = stmts.insert.run(text.trim(), parent_id, created_at, category_id)
      res.json({ id: result.lastInsertRowid, text: text.trim(), done: 0, completed_at: null, created_at, parent_id, category_id, due_date: null, description: null })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.patch('/api/todos/:id', (req: Request, res: Response) => {
    try {
      const { done, category_id, due_date, description } = req.body as {
        done?: boolean
        category_id?: number | null
        due_date?: string | null
        description?: string | null
      }
      let spawned: TodoRow | null = null
      if (done !== undefined) {
        const completed_at = done ? new Date().toISOString() : null

        spawned = db.transaction((id: number) => {
          function updateTree(nodeId: number) {
            stmts.update.run(done ? 1 : 0, completed_at, nodeId)
            if (done) {
              for (const child of stmts.getChildren.all(nodeId)) updateTree(child.id)
            }
          }
          updateTree(id)

          if (done) {
            const todo = stmts.getTodo.get(id)
            if (todo?.template_id && todo.due_date) {
              const template = stmts.getTemplateById.get(todo.template_id)
              if (template) {
                const nextDue = nextOccurrence(template, todo.due_date)
                const created_at = new Date().toISOString()
                const spawnResult = stmts.spawnTodo.run(
                  template.text, template.category_id, template.description,
                  created_at, nextDue, template.id
                )
                return stmts.getTodo.get(Number(spawnResult.lastInsertRowid)) ?? null
              }
            }
          }
          return null
        })(Number(req.params.id))
      }
      if ('category_id' in req.body) {
        stmts.updateCat.run(category_id ?? null, Number(req.params.id))
      }
      if ('due_date' in req.body) {
        if (due_date !== null && due_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
          return res.status(400).json({ error: 'due_date must be YYYY-MM-DD or null' })
        }
        stmts.updateDueDate.run(due_date ?? null, Number(req.params.id))
      }
      if ('description' in req.body) {
        stmts.updateDescription.run(description ?? null, Number(req.params.id))
      }
      if ('priority' in req.body) {
        const { priority } = req.body as { priority?: 'high' | 'medium' | 'low' | null }
        if (priority !== null && priority !== undefined && !['high', 'medium', 'low'].includes(priority)) {
          return res.status(400).json({ error: 'priority must be high, medium, low, or null' })
        }
        stmts.updatePriority.run(priority ?? null, Number(req.params.id))
      }
      res.json({ ok: true, spawned: spawned ? { ...spawned, done: !!spawned.done } : null })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/todos/:id', (req: Request, res: Response) => {
    try {
      function deleteTree(id: number) {
        for (const child of stmts.getChildren.all(id)) deleteTree(child.id)
        stmts.delete.run(id)
      }
      db.transaction(deleteTree)(Number(req.params.id))
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/categories', (_req: Request, res: Response) => {
    try {
      res.json(stmts.getAllCats.all())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/categories', (req: Request, res: Response) => {
    try {
      const { name, color } = req.body as { name: string; color: string }
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name is required' })
      }
      if (!color || typeof color !== 'string') {
        return res.status(400).json({ error: 'color is required' })
      }
      const result = stmts.insertCat.run(name.trim(), color)
      res.json({ id: result.lastInsertRowid, name: name.trim(), color })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/categories/:id', (req: Request, res: Response) => {
    try {
      stmts.clearTodoCat.run(Number(req.params.id))
      stmts.deleteCat.run(Number(req.params.id))
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/templates', (_req: Request, res: Response) => {
    try {
      res.json(stmts.getAllTemplates.all())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/templates', (req: Request, res: Response) => {
    try {
      const { todo_id, recurrence_type, day_mask, interval_days } =
        req.body as { todo_id?: number; recurrence_type?: string; day_mask?: number; interval_days?: number }

      if (!todo_id) return res.status(400).json({ error: 'todo_id is required' })

      const validTypes = ['daily', 'weekly', 'monthly', 'custom']
      if (!recurrence_type || !validTypes.includes(recurrence_type)) {
        return res.status(400).json({ error: 'recurrence_type must be daily|weekly|monthly|custom' })
      }
      if (recurrence_type === 'weekly' && !(day_mask && day_mask > 0)) {
        return res.status(400).json({ error: 'day_mask required and non-zero for weekly' })
      }
      if (recurrence_type === 'custom' && (!interval_days || interval_days < 1)) {
        return res.status(400).json({ error: 'interval_days required and >= 1 for custom' })
      }

      const todo = stmts.getTodo.get(Number(todo_id))
      if (!todo) return res.status(400).json({ error: 'todo not found' })
      if (!todo.due_date) return res.status(400).json({ error: 'todo must have a due_date' })

      const dom = recurrence_type === 'monthly' ? Number(todo.due_date.slice(8, 10)) : null
      const maskVal = recurrence_type === 'weekly' ? (day_mask ?? null) : null
      const intervalVal = recurrence_type === 'custom' ? (interval_days ?? null) : null

      const result = db.transaction(() => {
        const tplResult = stmts.insertTemplate.run(
          todo.text, todo.category_id, todo.description,
          recurrence_type, maskVal, intervalVal, dom
        )
        const templateId = Number(tplResult.lastInsertRowid)
        stmts.updateTodoTemplate.run(templateId, Number(todo_id))
        const template = stmts.getTemplateById.get(templateId)!
        const updatedTodo = stmts.getTodo.get(Number(todo_id))!
        return { template, todo: { ...updatedTodo, done: !!updatedTodo.done } }
      })()

      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/templates/:id', (req: Request, res: Response) => {
    try {
      // Temporarily disable FK enforcement so existing todos keep their
      // template_id as a tombstone rather than being blocked by the constraint.
      // Safe: better-sqlite3 is synchronous so no other handler can interleave.
      db.pragma('foreign_keys = OFF')
      stmts.deleteTemplate.run(Number(req.params.id))
      db.pragma('foreign_keys = ON')
      res.json({ ok: true })
    } catch (err) {
      db.pragma('foreign_keys = ON')
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

const dbPath = process.env.DB_PATH ?? join(dirname(fileURLToPath(import.meta.url)), 'todos.db')
const db = new Database(dbPath)
initDb(db)
const app = createApp(db)
const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
