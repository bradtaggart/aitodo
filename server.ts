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
}

interface CategoryRow {
  id: number
  name: string
  color: string
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
  }

  const app = express()
  app.use(cors({ origin: 'http://localhost:5173' }))
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
      if (done !== undefined) {
        const completed_at = done ? new Date().toISOString() : null
        function updateTree(id: number) {
          stmts.update.run(done ? 1 : 0, completed_at, id)
          if (done) {
            for (const child of stmts.getChildren.all(id)) updateTree(child.id)
          }
        }
        db.transaction(updateTree)(Number(req.params.id))
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
      res.json({ ok: true })
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

  return app
}

const dbPath = join(dirname(fileURLToPath(import.meta.url)), 'todos.db')
const db = new Database(dbPath)
initDb(db)
const app = createApp(db)
app.listen(3001, () => console.log('API server running on http://localhost:3001'))
