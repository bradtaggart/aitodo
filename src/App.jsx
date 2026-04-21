import { useState, useEffect, useCallback } from 'react'
import './App.css'

const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899']

async function fetchTodos() {
  const res = await fetch('/api/todos')
  if (!res.ok) throw new Error('Failed to fetch todos')
  const todos = await res.json()
  return todos.map(t => ({ ...t, done: !!t.done }))
}

async function apiFetchCategories() {
  const res = await fetch('/api/categories')
  if (!res.ok) throw new Error('Failed to fetch categories')
  return res.json()
}

function CategoryBar({ categories, activeCat, onSelect, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[5])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd(name.trim(), color)
    setName('')
    setColor(PRESET_COLORS[5])
    setAdding(false)
  }

  return (
    <div className="cat-bar">
      {categories.map(cat => (
        <button
          key={cat.id}
          type="button"
          className={`cat-chip${activeCat === cat.id ? ' active' : ''}`}
          onClick={() => onSelect(activeCat === cat.id ? null : cat.id)}
        >
          <span className="cat-dot" style={{ background: cat.color }} />
          {cat.name}
          <span
            className="cat-del"
            role="button"
            aria-label={`Delete ${cat.name}`}
            onClick={e => { e.stopPropagation(); onDelete(cat.id) }}
          >×</span>
        </button>
      ))}
      {adding ? (
        <form onSubmit={submit} className="cat-add-form">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Category name..."
            maxLength={30}
          />
          <div className="color-swatches">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`swatch${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <button type="submit">Add</button>
          <button type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button className="cat-add-btn" type="button" onClick={() => setAdding(true)}>+ Category</button>
      )}
    </div>
  )
}

function TodoItem({ todo, subtasks, categories, onToggle, onDelete, onAddChild, onChangeCategory, subtasksOf }) {
  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(`collapsed:${todo.id}`) === 'true'
  })
  const [input, setInput] = useState('')

  const cat = categories.find(c => c.id === todo.category_id) ?? null

  async function submitChild(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    await onAddChild(text, todo.id)
    setInput('')
    setAdding(false)
  }

  function toggleCollapse() {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem(`collapsed:${todo.id}`, next)
      return next
    })
  }

  return (
    <li>
      <div className={`todo-row${todo.done ? ' done' : ''}`}>
        <button className="check" onClick={() => onToggle(todo.id, todo.done)} aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}>
          {todo.done ? '✓' : ''}
        </button>
        <span className="todo-text">
          <span className="todo-label">{todo.text}</span>
          {todo.created_at && (
            <time className="created-at">Created {new Date(todo.created_at).toLocaleString()}</time>
          )}
          {todo.done && todo.completed_at && (
            <time className="completed-at">Completed {new Date(todo.completed_at).toLocaleString()}</time>
          )}
        </span>
        {categories.length > 0 && (
          <span className={`todo-cat${cat ? ' has-cat' : ''}`}>
            <select
              value={todo.category_id ?? ''}
              onChange={e => onChangeCategory(todo.id, e.target.value ? Number(e.target.value) : null)}
              aria-label="Set category"
            >
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {cat && <span className="cat-dot" style={{ background: cat.color }} />}
            {cat ? cat.name : '+'}
          </span>
        )}
        {subtasks.length > 0 && (
          <button className="collapse" onClick={toggleCollapse} aria-label={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '▶' : '▼'}
          </button>
        )}
        {!todo.done && (
          <button className="add-child" onClick={() => setAdding(v => !v)} aria-label="Add subtask">+</button>
        )}
        <button className="delete" onClick={() => onDelete(todo.id)} aria-label="Delete task">×</button>
      </div>
      {adding && (
        <form onSubmit={submitChild} className="child-form">
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Add subtask..."
            aria-label="New subtask"
          />
          <button type="submit">Add</button>
          <button type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      )}
      {subtasks.length > 0 && !collapsed && (
        <ul className="todo-list child-list">
          {subtasks.map(child => (
            <TodoItem
              key={child.id}
              todo={child}
              subtasks={subtasksOf(child.id)}
              categories={categories}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onChangeCategory={onChangeCategory}
              subtasksOf={subtasksOf}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function App() {
  const [todos, setTodos] = useState([])
  const [categories, setCategories] = useState([])
  const [input, setInput] = useState('')
  const [activeCat, setActiveCat] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function loadTodos() {
    try { setTodos(await fetchTodos()) } catch (err) { setError(err.message) }
  }

  async function loadCategories() {
    try { setCategories(await apiFetchCategories()) } catch (err) { setError(err.message) }
  }

  useEffect(() => { loadTodos(); loadCategories() }, [])

  async function withPending(fn) {
    setPending(true)
    try {
      await fn()
      await loadTodos()
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  async function addTodo(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    await withPending(() =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, category_id: activeCat }),
      }).then(r => { if (!r.ok) throw new Error('Failed to add todo') })
    )
  }

  async function addChild(text, parent_id) {
    await withPending(() =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, parent_id }),
      }).then(r => { if (!r.ok) throw new Error('Failed to add subtask') })
    )
  }

  async function toggleTodo(id, done) {
    await withPending(() =>
      fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !done }),
      }).then(r => { if (!r.ok) throw new Error('Failed to update todo') })
    )
  }

  async function deleteTodo(id) {
    if (!window.confirm('Delete this task and all its subtasks?')) return
    await withPending(() =>
      fetch(`/api/todos/${id}`, { method: 'DELETE' })
        .then(r => { if (!r.ok) throw new Error('Failed to delete todo') })
    )
  }

  async function changeCategory(id, category_id) {
    await withPending(() =>
      fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id }),
      }).then(r => { if (!r.ok) throw new Error('Failed to update category') })
    )
  }

  async function addCategory(name, color) {
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      }).then(r => { if (!r.ok) throw new Error('Failed to add category') })
      await loadCategories()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteCategory(id) {
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' })
        .then(r => { if (!r.ok) throw new Error('Failed to delete category') })
      if (activeCat === id) setActiveCat(null)
      await loadCategories()
      await loadTodos()
    } catch (err) {
      setError(err.message)
    }
  }

  const subtasksOf = useCallback(id => todos.filter(t => t.parent_id === id), [todos])

  const topLevel = todos.filter(t => !t.parent_id && (activeCat === null || t.category_id === activeCat))

  return (
    <main>
      <h1>TODO Build by Claude Code</h1>
      {error && <p className="error">{error} <button onClick={() => setError(null)}>×</button></p>}
      <form onSubmit={addTodo} className="add-form">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task..."
          aria-label="New task"
          disabled={pending}
        />
        <button type="submit" disabled={pending}>Add</button>
      </form>
      <CategoryBar
        categories={categories}
        activeCat={activeCat}
        onSelect={setActiveCat}
        onAdd={addCategory}
        onDelete={deleteCategory}
      />
      {activeCat !== null && (() => {
        const cat = categories.find(c => c.id === activeCat)
        return cat ? (
          <div className="filter-banner">
            <span className="cat-dot" style={{ background: cat.color }} />
            Showing tasks in <strong>{cat.name}</strong>
            <button onClick={() => setActiveCat(null)} aria-label="Clear filter">× Clear filter</button>
          </div>
        ) : null
      })()}
      {topLevel.length === 0 && <p className="empty">No tasks yet.</p>}
      <ul className="todo-list">
        {topLevel.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            subtasks={subtasksOf(todo.id)}
            categories={categories}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            onAddChild={addChild}
            onChangeCategory={changeCategory}
            subtasksOf={subtasksOf}
          />
        ))}
      </ul>
    </main>
  )
}

export default App
