import express, { Request, Response } from 'express'
import Database from 'better-sqlite3'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { initDb } from './server/database.ts'
import { AccountSessionError, createAccountSession } from './server/account-session.ts'
import {
  createRecurringTaskOperations,
  RecurringTaskOperationError,
} from './server/recurring-task-operations.ts'
import { createTaskMutations, TaskMutationError, type TaskPatch } from './server/task-mutations.ts'
import { createTaskPersistence, TaskPersistenceError } from './server/task-persistence.ts'
import { requireAuth, setSessionCookie, clearSessionCookie } from './server/auth.ts'


export function createApp(db: Database.Database) {
  const persistence = createTaskPersistence(db)
  const recurringTasks = createRecurringTaskOperations(persistence)
  const taskMutations = createTaskMutations(persistence)
  const accountSession = createAccountSession(persistence)

  const app = express()
  if (process.env.NODE_ENV !== 'production') {
    app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
  }
  app.use(cookieParser())
  app.use(express.json())

  // Auth routes (no requireAuth)
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const account = await accountSession.registerAccount(req.body as { email?: string; password?: string; name?: string })
      setSessionCookie(res, account.id)
      res.json(account)
    } catch (err) {
      if (err instanceof AccountSessionError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const account = await accountSession.loginAccount(req.body as { email?: string; password?: string })
      setSessionCookie(res, account.id)
      res.json(account)
    } catch (err) {
      if (err instanceof AccountSessionError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    clearSessionCookie(res)
    res.json({ ok: true })
  })

  // All routes below require authentication
  app.use('/api', requireAuth)

  app.get('/api/todos', (req: Request, res: Response) => {
    try {
      res.json(persistence.forAccount(req.userId).listTodos())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/todos', (req: Request, res: Response) => {
    try {
      const { text, parent_id = null, category_id = null } = req.body as { text: string; parent_id?: number | null; category_id?: number | null }
      res.json(persistence.forAccount(req.userId).createTodo({ text, parent_id, category_id }))
    } catch (err) {
      if (err instanceof TaskPersistenceError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.patch('/api/todos/:id', (req: Request, res: Response) => {
    try {
      res.json(taskMutations.applyPatch(Number(req.params.id), req.body as TaskPatch, req.userId))
    } catch (err) {
      if (err instanceof TaskMutationError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/todos/:id', (req: Request, res: Response) => {
    try {
      recurringTasks.deleteTodo(Number(req.params.id), req.userId)
      res.json({ ok: true })
    } catch (err) {
      if (err instanceof RecurringTaskOperationError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/categories', (req: Request, res: Response) => {
    try {
      res.json(persistence.forAccount(req.userId).listCategories())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/categories', (req: Request, res: Response) => {
    try {
      const { name, color } = req.body as { name: string; color: string }
      res.json(persistence.forAccount(req.userId).createCategory(name, color))
    } catch (err) {
      if (err instanceof TaskPersistenceError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/categories/:id', (req: Request, res: Response) => {
    try {
      res.json(persistence.forAccount(req.userId).deleteCategory(Number(req.params.id)))
    } catch (err) {
      if (err instanceof TaskPersistenceError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/templates', (req: Request, res: Response) => {
    try {
      res.json(persistence.forAccount(req.userId).listTemplates())
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/templates', (req: Request, res: Response) => {
    try {
      const { todo_id, recurrence_type, day_mask, interval_days } =
        req.body as { todo_id?: number; recurrence_type?: string; day_mask?: number; interval_days?: number }

      if (!todo_id) return res.status(400).json({ error: 'todo_id is required' })
      const result = recurringTasks.setRecurrence(Number(todo_id), { recurrence_type, day_mask, interval_days }, req.userId)

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
      recurringTasks.deleteTemplate(Number(req.params.id), req.userId)
      res.json({ ok: true })
    } catch (err) {
      if (err instanceof RecurringTaskOperationError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/me', (req: Request, res: Response) => {
    try {
      res.json(accountSession.getCurrentAccount(req.userId))
    } catch (err) {
      if (err instanceof AccountSessionError) {
        return res.status(err.status).json({ error: err.message })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.patch('/api/me', (req: Request, res: Response) => {
    try {
      res.json(accountSession.updateAccountPreferences(req.userId, (req.body as { preferences?: Record<string, unknown> }).preferences ?? {}))
    } catch (err) {
      if (err instanceof AccountSessionError) {
        return res.status(err.status).json({ error: err.message })
      }
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
