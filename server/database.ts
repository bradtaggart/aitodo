import Database from 'better-sqlite3'

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

  const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map(c => c.name)
  if (!userCols.includes('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT')
  if (!userCols.includes('password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE email IS NOT NULL')

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count
  if (userCount === 0) {
    db.prepare('INSERT INTO users (name, preferences) VALUES (?, ?)').run('default', '{}')
  }

  const catCols = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map(c => c.name)
  if (!catCols.includes('user_id')) {
    db.exec('ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id)')
    db.exec('UPDATE categories SET user_id = 1 WHERE user_id IS NULL')
  }

  const templateCols = (db.prepare("PRAGMA table_info(recurring_templates)").all() as { name: string }[]).map(c => c.name)
  if (!templateCols.includes('user_id')) {
    db.exec('ALTER TABLE recurring_templates ADD COLUMN user_id INTEGER REFERENCES users(id)')
    db.exec('UPDATE recurring_templates SET user_id = 1 WHERE user_id IS NULL')
  }

  if (!todoCols.includes('user_id')) {
    db.exec('ALTER TABLE todos ADD COLUMN user_id INTEGER REFERENCES users(id)')
    db.exec('UPDATE todos SET user_id = 1 WHERE user_id IS NULL')
  }
}
