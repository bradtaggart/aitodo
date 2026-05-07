import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const [email, newPassword] = process.argv.slice(2)

if (!email || !newPassword) {
  console.error('Usage: tsx scripts/reset-password.ts <email> <new-password>')
  process.exit(1)
}

if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters')
  process.exit(1)
}

const dbPath = process.env.DB_PATH ?? join(dirname(fileURLToPath(import.meta.url)), '../todos.db')
const db = new Database(dbPath)

const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as { id: number; email: string } | undefined
if (!user) {
  console.error(`No account found for ${email}`)
  process.exit(1)
}

const hash = await bcrypt.hash(newPassword, 12)
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id)
console.log(`Password updated for ${email}`)
db.close()
