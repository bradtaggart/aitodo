import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { initDb } from './database'
import { createAccountSession, AccountSessionError } from './account-session'
import { createTaskPersistence, type TaskPersistence } from './task-persistence'

let db: Database.Database
let accountSession: ReturnType<typeof createAccountSession>
let persistence: TaskPersistence

beforeEach(() => {
  db = new Database(':memory:')
  initDb(db)
  persistence = createTaskPersistence(db)
  accountSession = createAccountSession(persistence)
})

afterEach(() => {
  db.close()
})

describe('account session', () => {
  it('registers an account and returns the product account shape', async () => {
    const account = await accountSession.registerAccount({
      email: 'test@test.com',
      password: 'password123',
      name: 'Test',
    })

    expect(account).toEqual({
      id: 1,
      email: 'test@test.com',
      name: 'Test',
      preferences: {},
    })
    expect(persistence.getUserByEmail('test@test.com')?.password_hash).not.toBe('password123')
  })

  it('logs in with valid credentials and rejects invalid credentials', async () => {
    await accountSession.registerAccount({ email: 'test@test.com', password: 'password123', name: 'Test' })

    await expect(accountSession.loginAccount({ email: 'test@test.com', password: 'password123' }))
      .resolves.toMatchObject({ email: 'test@test.com', name: 'Test' })
    await expect(accountSession.loginAccount({ email: 'test@test.com', password: 'wrong-password' }))
      .rejects.toMatchObject(new AccountSessionError('Invalid email or password', 401))
  })

  it('loads the current account and merges preference patches', async () => {
    const account = await accountSession.registerAccount({ email: 'test@test.com', password: 'password123', name: 'Test' })

    accountSession.updateAccountPreferences(account.id, { sort_by: 'priority' })

    expect(accountSession.getCurrentAccount(account.id)).toEqual({
      ...account,
      preferences: { sort_by: 'priority' },
    })
  })
})
