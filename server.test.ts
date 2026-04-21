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

  it('cascades done=true to all children', async () => {
    const parent = await request.post('/api/todos').send({ text: 'parent' })
    const child = await request.post('/api/todos').send({ text: 'child', parent_id: parent.body.id })
    const grandchild = await request.post('/api/todos').send({ text: 'grandchild', parent_id: child.body.id })

    await request.patch(`/api/todos/${parent.body.id}`).send({ done: true })

    const todos = await request.get('/api/todos')
    const ids = [parent.body.id, child.body.id, grandchild.body.id]
    for (const id of ids) {
      const t = todos.body.find((t: { id: number }) => t.id === id)
      expect(t.done).toBe(1)
    }
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

describe('DELETE /api/todos/:id', () => {
  it('deletes a todo', async () => {
    const created = await request.post('/api/todos').send({ text: 'to delete' })
    const res = await request.delete(`/api/todos/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const todos = await request.get('/api/todos')
    expect(todos.body).toHaveLength(0)
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
