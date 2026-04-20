import { useState, useEffect, useCallback } from 'react'
import './App.css'

async function fetchTodos() {
  const res = await fetch('/api/todos')
  if (!res.ok) throw new Error('Failed to fetch todos')
  const todos = await res.json()
  return todos.map(t => ({ ...t, done: !!t.done }))
}

function TodoItem({ todo, subtasks, onToggle, onDelete, onAddChild, subtasksOf }) {
  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(`collapsed:${todo.id}`) === 'true'
  })
  const [input, setInput] = useState('')

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
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
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
  const [input, setInput] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function loadTodos() {
    try {
      setTodos(await fetchTodos())
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { loadTodos() }, [])

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
        body: JSON.stringify({ text }),
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

  const subtasksOf = useCallback(
    id => todos.filter(t => t.parent_id === id),
    [todos]
  )

  const topLevel = todos.filter(t => !t.parent_id)

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
      {topLevel.length === 0 && <p className="empty">No tasks yet.</p>}
      <ul className="todo-list">
        {topLevel.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            subtasks={subtasksOf(todo.id)}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            onAddChild={addChild}
            subtasksOf={subtasksOf}
          />
        ))}
      </ul>
    </main>
  )
}

export default App
