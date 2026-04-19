import { useState, useEffect } from 'react'
import './App.css'

async function fetchTodos() {
  const res = await fetch('/api/todos')
  return res.json()
}

function TodoItem({ todo, children, onToggle, onDelete, onAddChild, childrenOf }) {
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

  return (
    <li>
      <div className={`todo-row${todo.done ? ' done' : ''}`}>
        <button className="check" onClick={() => onToggle(todo.id, todo.done)} aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}>
          {todo.done ? '✓' : ''}
        </button>
        <span>
          {todo.text}
          {!!todo.done && todo.completed_at && (
            <time className="completed-at">{new Date(todo.completed_at).toLocaleString()}</time>
          )}
        </span>
        {children.length > 0 && (
          <button className="collapse" onClick={() => setCollapsed(v => { const next = !v; localStorage.setItem(`collapsed:${todo.id}`, next); return next })} aria-label={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '▶' : '▼'}
          </button>
        )}
        {!todo.done && <button className="add-child" onClick={() => setAdding(v => !v)} aria-label="Add subtask">+</button>}
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
      {children.length > 0 && !collapsed && (
        <ul className="todo-list child-list">
          {children.map(child => (
            <TodoItem
              key={child.id}
              todo={child}
              children={childrenOf(child.id)}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              childrenOf={childrenOf}
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

  useEffect(() => {
    fetchTodos().then(setTodos)
  }, [])

  async function addTodo(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    const todo = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then(r => r.json())
    setTodos(prev => [...prev, todo])
    setInput('')
  }

  async function addChild(text, parent_id) {
    const todo = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parent_id }),
    }).then(r => r.json())
    setTodos(prev => [...prev, todo])
  }

  async function toggleTodo(id, done) {
    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    })
    fetchTodos().then(setTodos)
  }

  async function deleteTodo(id) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    fetchTodos().then(setTodos)
  }

  const topLevel = todos.filter(t => !t.parent_id)
  const childrenOf = id => todos.filter(t => t.parent_id === id)

  return (
    <main>
      <h1>TODO Build by Claude Code</h1>
      <form onSubmit={addTodo} className="add-form">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task..."
          aria-label="New task"
        />
        <button type="submit">Add</button>
      </form>
      {topLevel.length === 0 && <p className="empty">No tasks yet.</p>}
      <ul className="todo-list">
        {topLevel.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            children={childrenOf(todo.id)}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            onAddChild={addChild}
            childrenOf={childrenOf}
          />
        ))}
      </ul>
    </main>
  )
}

export default App
