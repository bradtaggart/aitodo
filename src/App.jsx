import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('todos')
    return saved ? JSON.parse(saved) : []
  })
  const [input, setInput] = useState('')

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  function addTodo(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setTodos([...todos, { id: Date.now(), text, done: false }])
    setInput('')
  }

  function toggleTodo(id) {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function deleteTodo(id) {
    setTodos(todos.filter(t => t.id !== id))
  }

  return (
    <main>
      <h1>Todo</h1>
      <form onSubmit={addTodo} className="add-form">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task..."
          aria-label="New task"
        />
        <button type="submit">Add</button>
      </form>
      {todos.length === 0 && <p className="empty">No tasks yet.</p>}
      <ul className="todo-list">
        {todos.map(todo => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            <button className="check" onClick={() => toggleTodo(todo.id)} aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}>
              {todo.done ? '✓' : ''}
            </button>
            <span>{todo.text}</span>
            <button className="delete" onClick={() => deleteTodo(todo.id)} aria-label="Delete task">×</button>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default App
