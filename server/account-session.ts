import bcrypt from 'bcryptjs'
import type { TaskPersistence, UserRow } from './task-persistence.ts'

export interface AccountView {
  id: number
  email: string | null
  name: string
  preferences: Record<string, unknown>
}

export class AccountSessionError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

function toAccountView(user: UserRow): AccountView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    preferences: JSON.parse(user.preferences),
  }
}

export function createAccountSession(persistence: TaskPersistence) {
  return {
    async registerAccount({ email, password, name }: { email?: string; password?: string; name?: string }): Promise<AccountView> {
      if (!email || !password || !name) {
        throw new AccountSessionError('email, password, and name are required')
      }
      if (password.length < 8) {
        throw new AccountSessionError('password must be at least 8 characters')
      }
      if (persistence.getUserByEmail(email)) {
        throw new AccountSessionError('email already in use', 409)
      }

      const passwordHash = await bcrypt.hash(password, 12)
      return toAccountView(persistence.createUser(email, passwordHash, name))
    },

    async loginAccount({ email, password }: { email?: string; password?: string }): Promise<AccountView> {
      if (!email || !password) {
        throw new AccountSessionError('email and password are required')
      }

      const user = persistence.getUserByEmail(email)
      if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
        throw new AccountSessionError('Invalid email or password', 401)
      }

      return toAccountView(user)
    },

    getCurrentAccount(accountId: number): AccountView {
      const user = persistence.getMe(accountId)
      if (!user) throw new AccountSessionError('account not found', 404)
      return toAccountView(user)
    },

    updateAccountPreferences(accountId: number, patch: Record<string, unknown>): { ok: true } {
      const user = persistence.getMe(accountId)
      if (!user) throw new AccountSessionError('account not found', 404)
      const current = JSON.parse(user.preferences)
      persistence.updateMe(accountId, JSON.stringify({ ...current, ...patch }))
      return { ok: true }
    },
  }
}
