import express from 'express'
import Database from 'better-sqlite3'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const app = express()
const dbPath = join(dirname(fileURLToPath(import.meta.url)), 'todos.db')
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    parent_id INTEGER REFERENCES todos(id)
  )
`)

const cols = db.prepare("PRAGMA table_info(todos)").all().map(c => c.name)
if (!cols.includes('completed_at')) db.exec('ALTER TABLE todos ADD COLUMN completed_at TEXT')
if (!cols.includes('created_at')) {
  db.exec('ALTER TABLE todos ADD COLUMN created_at TEXT')
  db.exec("UPDATE todos SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE created_at IS NULL")
}
if (!cols.includes('parent_id')) db.exec('ALTER TABLE todos ADD COLUMN parent_id INTEGER REFERENCES todos(id)')

// Module-level prepared statements
const stmts = {
  getAll:         db.prepare('SELECT * FROM todos ORDER BY id'),
  getById:        db.prepare('SELECT id FROM todos WHERE id = ?'),
  getChildren:    db.prepare('SELECT id FROM todos WHERE parent_id = ?'),
  insert:         db.prepare('INSERT INTO todos (text, parent_id, created_at) VALUES (?, ?, ?)'),
  update:         db.prepare('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?'),
  delete:         db.prepare('DELETE FROM todos WHERE id = ?'),
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
    const { text, parent_id = null } = req.body
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' })
    }
    if (parent_id !== null) {
      const parent = stmts.getById.get(parent_id)
      if (!parent) return res.status(400).json({ error: 'parent not found' })
    }
    const created_at = new Date().toISOString()
    const result = stmts.insert.run(text.trim(), parent_id, created_at)
    res.json({ id: result.lastInsertRowid, text: text.trim(), done: 0, completed_at: null, created_at, parent_id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/todos/:id', (req, res) => {
  try {
    const { done } = req.body
    const completed_at = done ? new Date().toISOString() : null

    function updateTree(id) {
      stmts.update.run(done ? 1 : 0, completed_at, id)
      if (done) {
        for (const child of stmts.getChildren.all(id)) updateTree(child.id)
      }
    }
    db.transaction(updateTree)(req.params.id)
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

app.listen(3001, () => console.log('API server running on http://localhost:3001'))
