import express from 'express'
import Database from 'better-sqlite3'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const app = express()
const dbPath = join(dirname(fileURLToPath(import.meta.url)), 'todos.db')
const db = new Database(dbPath)

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

const todoCols = db.prepare("PRAGMA table_info(todos)").all().map(c => c.name)
if (!todoCols.includes('completed_at')) db.exec('ALTER TABLE todos ADD COLUMN completed_at TEXT')
if (!todoCols.includes('created_at')) {
  db.exec('ALTER TABLE todos ADD COLUMN created_at TEXT')
  db.exec("UPDATE todos SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE created_at IS NULL")
}
if (!todoCols.includes('parent_id')) db.exec('ALTER TABLE todos ADD COLUMN parent_id INTEGER REFERENCES todos(id)')
if (!todoCols.includes('category_id')) db.exec('ALTER TABLE todos ADD COLUMN category_id INTEGER REFERENCES categories(id)')

const stmts = {
  getAll:        db.prepare('SELECT * FROM todos ORDER BY id'),
  getById:       db.prepare('SELECT id FROM todos WHERE id = ?'),
  getChildren:   db.prepare('SELECT id FROM todos WHERE parent_id = ?'),
  insert:        db.prepare('INSERT INTO todos (text, parent_id, created_at, category_id) VALUES (?, ?, ?, ?)'),
  update:        db.prepare('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?'),
  updateCat:     db.prepare('UPDATE todos SET category_id = ? WHERE id = ?'),
  delete:        db.prepare('DELETE FROM todos WHERE id = ?'),
  getAllCats:    db.prepare('SELECT * FROM categories ORDER BY id'),
  insertCat:    db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)'),
  deleteCat:    db.prepare('DELETE FROM categories WHERE id = ?'),
  clearTodoCat: db.prepare('UPDATE todos SET category_id = NULL WHERE category_id = ?'),
}

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/todos', (req, res) => {
  try {
    res.json(stmts.getAll.all())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/todos', (req, res) => {
  try {
    const { text, parent_id = null, category_id = null } = req.body
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' })
    }
    if (parent_id !== null) {
      const parent = stmts.getById.get(parent_id)
      if (!parent) return res.status(400).json({ error: 'parent not found' })
    }
    const created_at = new Date().toISOString()
    const result = stmts.insert.run(text.trim(), parent_id, created_at, category_id)
    res.json({ id: result.lastInsertRowid, text: text.trim(), done: 0, completed_at: null, created_at, parent_id, category_id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/todos/:id', (req, res) => {
  try {
    const { done, category_id } = req.body
    if (done !== undefined) {
      const completed_at = done ? new Date().toISOString() : null
      function updateTree(id) {
        stmts.update.run(done ? 1 : 0, completed_at, id)
        if (done) {
          for (const child of stmts.getChildren.all(id)) updateTree(child.id)
        }
      }
      db.transaction(updateTree)(req.params.id)
    }
    if ('category_id' in req.body) {
      stmts.updateCat.run(category_id ?? null, req.params.id)
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/todos/:id', (req, res) => {
  try {
    function deleteTree(id) {
      for (const child of stmts.getChildren.all(id)) deleteTree(child.id)
      stmts.delete.run(id)
    }
    db.transaction(deleteTree)(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/categories', (req, res) => {
  try {
    res.json(stmts.getAllCats.all())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/categories', (req, res) => {
  try {
    const { name, color } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' })
    }
    if (!color || typeof color !== 'string') {
      return res.status(400).json({ error: 'color is required' })
    }
    const result = stmts.insertCat.run(name.trim(), color)
    res.json({ id: result.lastInsertRowid, name: name.trim(), color })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/categories/:id', (req, res) => {
  try {
    stmts.clearTodoCat.run(req.params.id)
    stmts.deleteCat.run(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => console.log('API server running on http://localhost:3001'))
