async function request(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const fetchTodos = () =>
  request('/api/todos').then(todos => todos.map(t => ({ ...t, done: !!t.done })))

export const fetchCategories = () => request('/api/categories')

export const createTodo = (text, category_id = null, parent_id = null) =>
  request('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, category_id, parent_id }),
  })

export const patchTodo = (id, patch) =>
  request(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

export const eraseTodo = id =>
  request(`/api/todos/${id}`, { method: 'DELETE' })

export const createCategory = (name, color) =>
  request('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  })

export const eraseCategory = id =>
  request(`/api/categories/${id}`, { method: 'DELETE' })
