import type { Todo, Category } from './types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const fetchTodos = () =>
  request<Todo[]>('/api/todos').then(todos => todos.map(t => ({ ...t, done: !!t.done })))

export const fetchCategories = () =>
  request<Category[]>('/api/categories')

export const createTodo = (text: string, category_id: number | null = null, parent_id: number | null = null) =>
  request<Todo>('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, category_id, parent_id }),
  })

export const patchTodo = (id: number, patch: Partial<Pick<Todo, 'done' | 'category_id'>>) =>
  request<{ ok: true }>(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

export const eraseTodo = (id: number) =>
  request<{ ok: true }>(`/api/todos/${id}`, { method: 'DELETE' })

export const createCategory = (name: string, color: string) =>
  request<Category>('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  })

export const eraseCategory = (id: number) =>
  request<{ ok: true }>(`/api/categories/${id}`, { method: 'DELETE' })
