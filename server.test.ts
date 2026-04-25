import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import supertest from 'supertest'
import { createApp, initDb } from './server'

let db: Database.Database
let request: ReturnType<typeof supertest>

beforeEach(() => {
  db = new Database(':memory:')
  initDb(db)
  request = supertest(createApp(db))
})

afterEach(() => {
  db.close()
})

describe('schema', () => {
  it('has recurring_templates table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    expect(tables.map(t => t.name)).toContain('recurring_templates')
  })

  it('todos table has template_id column', () => {
    const cols = (db.prepare('PRAGMA table_info(todos)').all() as { name: string }[]).map(c => c.name)
    expect(cols).toContain('template_id')
  })
})

describe('GET /api/todos', () => {
  it('returns empty array when no todos exist', async () => {
    const res = await request.get('/api/todos')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns all todos ordered by id', async () => {
    await request.post('/api/todos').send({ text: 'first' })
    await request.post('/api/todos').send({ text: 'second' })
    const res = await request.get('/api/todos')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].text).toBe('first')
    expect(res.body[1].text).toBe('second')
  })
})

describe('POST /api/todos', () => {
  it('creates a todo and returns it', async () => {
    const res = await request.post('/api/todos').send({ text: 'buy milk' })
    expect(res.status).toBe(200)
    expect(res.body.text).toBe('buy milk')
    expect(res.body.done).toBe(0)
    expect(res.body.completed_at).toBeNull()
    expect(res.body.parent_id).toBeNull()
    expect(res.body.category_id).toBeNull()
    expect(typeof res.body.id).toBe('number')
    expect(typeof res.body.created_at).toBe('string')
  })

  it('trims whitespace from text', async () => {
    const res = await request.post('/api/todos').send({ text: '  trimmed  ' })
    expect(res.status).toBe(200)
    expect(res.body.text).toBe('trimmed')
  })

  it('returns 400 when text is missing', async () => {
    const res = await request.post('/api/todos').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('text is required')
  })

  it('returns 400 when text is empty string', async () => {
    const res = await request.post('/api/todos').send({ text: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('text is required')
  })

  it('creates a child todo with parent_id', async () => {
    const parent = await request.post('/api/todos').send({ text: 'parent' })
    const child = await request.post('/api/todos').send({ text: 'child', parent_id: parent.body.id })
    expect(child.status).toBe(200)
    expect(child.body.parent_id).toBe(parent.body.id)
  })

  it('returns 400 when parent_id does not exist', async () => {
    const res = await request.post('/api/todos').send({ text: 'orphan', parent_id: 999 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('parent not found')
  })

  it('creates a todo with category_id', async () => {
    const cat = await request.post('/api/categories').send({ name: 'Work', color: '#ff0000' })
    const res = await request.post('/api/todos').send({ text: 'task', category_id: cat.body.id })
    expect(res.status).toBe(200)
    expect(res.body.category_id).toBe(cat.body.id)
  })

  it('returns 400 when category_id does not exist', async () => {
    const res = await request.post('/api/todos').send({ text: 'task', category_id: 999 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('category not found')
  })
})

describe('PATCH /api/todos/:id', () => {
  it('marks a todo as done', async () => {
    const created = await request.post('/api/todos').send({ text: 'task' })
    const res = await request.patch(`/api/todos/${created.body.id}`).send({ done: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === created.body.id)
    expect(updated.done).toBe(1)
    expect(updated.completed_at).not.toBeNull()
  })

  it('marks a todo as undone and clears completed_at', async () => {
    const created = await request.post('/api/todos').send({ text: 'task' })
    await request.patch(`/api/todos/${created.body.id}`).send({ done: true })
    await request.patch(`/api/todos/${created.body.id}`).send({ done: false })

    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === created.body.id)
    expect(updated.done).toBe(0)
    expect(updated.completed_at).toBeNull()
  })

  it('cascades done=true to all children and sets completed_at', async () => {
    const parent = await request.post('/api/todos').send({ text: 'parent' })
    const child = await request.post('/api/todos').send({ text: 'child', parent_id: parent.body.id })
    const grandchild = await request.post('/api/todos').send({ text: 'grandchild', parent_id: child.body.id })

    await request.patch(`/api/todos/${parent.body.id}`).send({ done: true })

    const todos = await request.get('/api/todos')
    const ids = [parent.body.id, child.body.id, grandchild.body.id]
    for (const id of ids) {
      const t = todos.body.find((t: { id: number }) => t.id === id)
      expect(t.done).toBe(1)
      expect(t.completed_at).not.toBeNull()
    }
  })

  it('marking parent undone does not cascade to children', async () => {
    const parent = await request.post('/api/todos').send({ text: 'parent' })
    const child = await request.post('/api/todos').send({ text: 'child', parent_id: parent.body.id })

    await request.patch(`/api/todos/${parent.body.id}`).send({ done: true })
    await request.patch(`/api/todos/${parent.body.id}`).send({ done: false })

    const todos = await request.get('/api/todos')
    const childTodo = todos.body.find((t: { id: number }) => t.id === child.body.id)
    expect(childTodo.done).toBe(1)
  })

  it('returns ok for PATCH on non-existent id', async () => {
    const res = await request.patch('/api/todos/999').send({ done: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('updates category_id', async () => {
    const cat = await request.post('/api/categories').send({ name: 'Work', color: '#0000ff' })
    const created = await request.post('/api/todos').send({ text: 'task' })

    await request.patch(`/api/todos/${created.body.id}`).send({ category_id: cat.body.id })

    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === created.body.id)
    expect(updated.category_id).toBe(cat.body.id)
  })

  it('clears category_id when set to null', async () => {
    const cat = await request.post('/api/categories').send({ name: 'Work', color: '#0000ff' })
    const created = await request.post('/api/todos').send({ text: 'task', category_id: cat.body.id })

    await request.patch(`/api/todos/${created.body.id}`).send({ category_id: null })

    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === created.body.id)
    expect(updated.category_id).toBeNull()
  })
})

describe('PATCH /api/todos/:id due_date', () => {
  it('sets a due date', async () => {
    const created = await request.post('/api/todos').send({ text: 'task' })
    await request.patch(`/api/todos/${created.body.id}`).send({ due_date: '2026-05-01' })
    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === created.body.id)
    expect(updated.due_date).toBe('2026-05-01')
  })

  it('clears a due date when set to null', async () => {
    const created = await request.post('/api/todos').send({ text: 'task' })
    await request.patch(`/api/todos/${created.body.id}`).send({ due_date: '2026-05-01' })
    await request.patch(`/api/todos/${created.body.id}`).send({ due_date: null })
    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === created.body.id)
    expect(updated.due_date).toBeNull()
  })
})

describe('DELETE /api/todos/:id', () => {
  it('deletes a todo', async () => {
    const created = await request.post('/api/todos').send({ text: 'to delete' })
    const res = await request.delete(`/api/todos/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const todos = await request.get('/api/todos')
    expect(todos.body).toHaveLength(0)
  })

  it('returns ok for DELETE on non-existent id', async () => {
    const res = await request.delete('/api/todos/999')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('cascades delete to all children', async () => {
    const parent = await request.post('/api/todos').send({ text: 'parent' })
    const child = await request.post('/api/todos').send({ text: 'child', parent_id: parent.body.id })
    await request.post('/api/todos').send({ text: 'grandchild', parent_id: child.body.id })

    await request.delete(`/api/todos/${parent.body.id}`)

    const todos = await request.get('/api/todos')
    expect(todos.body).toHaveLength(0)
  })
})

describe('GET /api/categories', () => {
  it('returns empty array when no categories exist', async () => {
    const res = await request.get('/api/categories')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns all categories ordered by id', async () => {
    await request.post('/api/categories').send({ name: 'Work', color: '#ff0000' })
    await request.post('/api/categories').send({ name: 'Personal', color: '#00ff00' })
    const res = await request.get('/api/categories')
    expect(res.body).toHaveLength(2)
    expect(res.body[0].name).toBe('Work')
    expect(res.body[1].name).toBe('Personal')
  })
})

describe('POST /api/categories', () => {
  it('creates a category and returns it', async () => {
    const res = await request.post('/api/categories').send({ name: 'Work', color: '#ff0000' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Work')
    expect(res.body.color).toBe('#ff0000')
    expect(typeof res.body.id).toBe('number')
  })

  it('trims whitespace from name', async () => {
    const res = await request.post('/api/categories').send({ name: '  Work  ', color: '#ff0000' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Work')
  })

  it('returns 400 when name is missing', async () => {
    const res = await request.post('/api/categories').send({ color: '#ff0000' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('returns 400 when name is empty string', async () => {
    const res = await request.post('/api/categories').send({ name: '   ', color: '#ff0000' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('returns 400 when color is missing', async () => {
    const res = await request.post('/api/categories').send({ name: 'Work' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('color is required')
  })
})

describe('DELETE /api/categories/:id', () => {
  it('returns ok for DELETE on non-existent id', async () => {
    const res = await request.delete('/api/categories/999')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('deletes a category', async () => {
    const created = await request.post('/api/categories').send({ name: 'Work', color: '#ff0000' })
    const res = await request.delete(`/api/categories/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const cats = await request.get('/api/categories')
    expect(cats.body).toHaveLength(0)
  })

  it('clears category_id from todos when category is deleted', async () => {
    const cat = await request.post('/api/categories').send({ name: 'Work', color: '#ff0000' })
    const todo = await request.post('/api/todos').send({ text: 'task', category_id: cat.body.id })

    await request.delete(`/api/categories/${cat.body.id}`)

    const todos = await request.get('/api/todos')
    const updated = todos.body.find((t: { id: number }) => t.id === todo.body.id)
    expect(updated.category_id).toBeNull()
  })
})

describe('GET /api/templates', () => {
  it('returns empty array when no templates exist', async () => {
    const res = await request.get('/api/templates')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /api/templates', () => {
  async function makeTodoWithDue(due_date: string) {
    const todo = await request.post('/api/todos').send({ text: 'standup' })
    await request.patch(`/api/todos/${todo.body.id}`).send({ due_date })
    return todo.body.id as number
  }

  it('creates a daily template and links the todo', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId,
      recurrence_type: 'daily',
    })
    expect(res.status).toBe(200)
    expect(res.body.template.recurrence_type).toBe('daily')
    expect(res.body.template.text).toBe('standup')
    expect(res.body.todo.template_id).toBe(res.body.template.id)
    expect(res.body.todo.id).toBe(todoId)
  })

  it('creates a weekly template with day_mask', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId,
      recurrence_type: 'weekly',
      day_mask: 2,
    })
    expect(res.status).toBe(200)
    expect(res.body.template.day_mask).toBe(2)
  })

  it('creates a custom template with interval_days', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId,
      recurrence_type: 'custom',
      interval_days: 14,
    })
    expect(res.status).toBe(200)
    expect(res.body.template.interval_days).toBe(14)
  })

  it('creates a monthly template and derives day_of_month from due_date', async () => {
    const todoId = await makeTodoWithDue('2026-04-15')
    const res = await request.post('/api/templates').send({
      todo_id: todoId,
      recurrence_type: 'monthly',
    })
    expect(res.status).toBe(200)
    expect(res.body.template.day_of_month).toBe(15)
  })

  it('returns 400 when todo_id is missing', async () => {
    const res = await request.post('/api/templates').send({ recurrence_type: 'daily' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when todo does not exist', async () => {
    const res = await request.post('/api/templates').send({ todo_id: 999, recurrence_type: 'daily' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when todo has no due_date', async () => {
    const todo = await request.post('/api/todos').send({ text: 'no date' })
    const res = await request.post('/api/templates').send({ todo_id: todo.body.id, recurrence_type: 'daily' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for weekly with day_mask = 0', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId, recurrence_type: 'weekly', day_mask: 0,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for custom with interval_days < 1', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    const res = await request.post('/api/templates').send({
      todo_id: todoId, recurrence_type: 'custom', interval_days: 0,
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/templates returns created template', async () => {
    const todoId = await makeTodoWithDue('2026-04-28')
    await request.post('/api/templates').send({ todo_id: todoId, recurrence_type: 'daily' })
    const res = await request.get('/api/templates')
    expect(res.body).toHaveLength(1)
    expect(res.body[0].recurrence_type).toBe('daily')
  })
})

describe('PATCH /api/todos/:id — recurring spawn', () => {
  async function makeRecurring(opts: { due_date: string; recurrence_type: string; day_mask?: number; interval_days?: number }) {
    const todo = await request.post('/api/todos').send({ text: 'standup' })
    await request.patch(`/api/todos/${todo.body.id}`).send({ due_date: opts.due_date })
    const tpl = await request.post('/api/templates').send({ todo_id: todo.body.id, ...opts })
    return { todoId: todo.body.id as number, templateId: tpl.body.template.id as number }
  }

  it('spawns next daily instance on completion', async () => {
    const { todoId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'daily' })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned).not.toBeNull()
    expect(res.body.spawned.due_date).toBe('2026-04-29')
    expect(res.body.spawned.done).toBe(0)
    expect(res.body.spawned.text).toBe('standup')
  })

  it('spawns next weekly instance — advances to correct weekday', async () => {
    // 2026-04-28 is a Tuesday; day_mask 2 = Mon only (bit 1)
    // next Monday after Tuesday 2026-04-28 is 2026-05-04
    const { todoId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'weekly', day_mask: 2 })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned.due_date).toBe('2026-05-04')
  })

  it('spawns next monthly instance — same day next month', async () => {
    const { todoId } = await makeRecurring({ due_date: '2026-04-15', recurrence_type: 'monthly' })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned.due_date).toBe('2026-05-15')
  })

  it('spawns next custom instance — adds interval_days', async () => {
    const { todoId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'custom', interval_days: 14 })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned.due_date).toBe('2026-05-12')
  })

  it('returns spawned: null for non-recurring todo', async () => {
    const todo = await request.post('/api/todos').send({ text: 'one-off' })
    const res = await request.patch(`/api/todos/${todo.body.id}`).send({ done: true })
    expect(res.body.ok).toBe(true)
    expect(res.body.spawned).toBeNull()
  })

  it('does not spawn when un-checking a recurring todo', async () => {
    const { todoId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'daily' })
    await request.patch(`/api/todos/${todoId}`).send({ done: true })
    const countBefore = (await request.get('/api/todos')).body.length
    await request.patch(`/api/todos/${todoId}`).send({ done: false })
    const countAfter = (await request.get('/api/todos')).body.length
    expect(countAfter).toBe(countBefore)
  })

  it('spawned instance has same template_id', async () => {
    const { todoId, templateId } = await makeRecurring({ due_date: '2026-04-28', recurrence_type: 'daily' })
    const res = await request.patch(`/api/todos/${todoId}`).send({ done: true })
    expect(res.body.spawned.template_id).toBe(templateId)
  })
})

describe('DELETE /api/templates/:id', () => {
  async function makeRecurringTodo() {
    const todo = await request.post('/api/todos').send({ text: 'standup' })
    await request.patch(`/api/todos/${todo.body.id}`).send({ due_date: '2026-04-28' })
    const tpl = await request.post('/api/templates').send({
      todo_id: todo.body.id, recurrence_type: 'daily',
    })
    return { todoId: todo.body.id as number, templateId: tpl.body.template.id as number }
  }

  it('deletes a template', async () => {
    const { templateId } = await makeRecurringTodo()
    const res = await request.delete(`/api/templates/${templateId}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const templates = await request.get('/api/templates')
    expect(templates.body).toHaveLength(0)
  })

  it('existing todos retain template_id as tombstone after delete', async () => {
    const { todoId, templateId } = await makeRecurringTodo()
    await request.delete(`/api/templates/${templateId}`)
    const todos = await request.get('/api/todos')
    const todo = todos.body.find((t: { id: number }) => t.id === todoId)
    expect(todo.template_id).toBe(templateId)
  })

  it('returns ok for non-existent id', async () => {
    const res = await request.delete('/api/templates/999')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
