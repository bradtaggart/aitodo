import express from 'express'
import Database from 'better-sqlite3'
import cors from 'cors'

const app = express()
const db = new Database('todos.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    parent_id INTEGER REFERENCES todos(id)
  )
`)

const cols = db.prepare("PRAGMA table_info(todos)").all().map(c => c.name)
if (!cols.includes('completed_at')) db.exec('ALTER TABLE todos ADD COLUMN completed_at TEXT')
if (!cols.includes('parent_id')) db.exec('ALTER TABLE todos ADD COLUMN parent_id INTEGER REFERENCES todos(id)')

app.use(cors())
app.use(express.json())

app.get('/api/todos', (req, res) => {
  res.json(db.prepare('SELECT * FROM todos ORDER BY id').all())
})

app.post('/api/todos', (req, res) => {
  const { text, parent_id = null } = req.body
  const result = db.prepare('INSERT INTO todos (text, parent_id) VALUES (?, ?)').run(text, parent_id)
  res.json({ id: result.lastInsertRowid, text, done: 0, completed_at: null, parent_id })
})

app.patch('/api/todos/:id', (req, res) => {
  const { done } = req.body
  const completed_at = done ? new Date().toISOString() : null

  const updateTree = db.transaction(id => {
    db.prepare('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?').run(done ? 1 : 0, completed_at, id)
    if (done) {
      const children = db.prepare('SELECT id FROM todos WHERE parent_id = ?').all(id)
      for (const child of children) updateTree(child.id)
    }
  })
  updateTree(req.params.id)
  res.json({ ok: true })
})

app.delete('/api/todos/:id', (req, res) => {
  const deleteTree = db.transaction(id => {
    const children = db.prepare('SELECT id FROM todos WHERE parent_id = ?').all(id)
    for (const child of children) deleteTree(child.id)
    db.prepare('DELETE FROM todos WHERE id = ?').run(id)
  })
  deleteTree(req.params.id)
  res.json({ ok: true })
})

app.listen(3001, () => console.log('API server running on http://localhost:3001'))
