import { useState } from 'react'
import { CategoryBar } from './components/CategoryBar'
import { TodoItem } from './components/TodoItem'
import { useTodos } from './hooks/useTodos'
import { useCategories } from './hooks/useCategories'
import './App.css'

export default function App() {
  const [input, setInput] = useState('')
  const [activeCat, setActiveCat] = useState<number | null>(null)

  const {
    todos,
    pending,
    error: todoError,
    clearError: clearTodoError,
    load: loadTodos,
    subtasksOf,
    addTodo,
    addChild,
    toggleTodo,
    deleteTodo,
    changeCategory,
  } = useTodos()

  const {
    categories,
    error: catError,
    clearError: clearCatError,
    addCategory,
    deleteCategory: deleteCategoryBase,
  } = useCategories()

  const error = todoError ?? catError
  const clearError = () => { clearTodoError(); clearCatError() }

  async function handleAddTodo(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    await addTodo(text, activeCat)
  }

  async function handleDeleteTodo(id: number) {
    if (!window.confirm('Delete this task and all its subtasks?')) return
    await deleteTodo(id)
  }

  async function handleDeleteCategory(id: number) {
    await deleteCategoryBase(id)
    await loadTodos()
    if (activeCat === id) setActiveCat(null)
  }

  const topLevel = todos.filter(t => !t.parent_id && (activeCat === null || t.category_id === activeCat))
  const activeCatObj = categories.find(c => c.id === activeCat) ?? null

  return (
    <main>
      <h1>TODO Build by Claude Code</h1>
      {error && (
        <p className="error">
          {error}
          <button onClick={clearError}>×</button>
        </p>
      )}
      <form onSubmit={handleAddTodo} className="add-form">
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
        onDelete={handleDeleteCategory}
      />
      {activeCatObj && (
        <div className="filter-banner">
          <span className="cat-dot" style={{ background: activeCatObj.color }} />
          Showing tasks in <strong>{activeCatObj.name}</strong>
          <button onClick={() => setActiveCat(null)} aria-label="Clear filter">× Clear filter</button>
        </div>
      )}
      {topLevel.length === 0 && <p className="empty">No tasks yet.</p>}
      <ul className="todo-list">
        {topLevel.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            subtasks={subtasksOf(todo.id)}
            categories={categories}
            onToggle={toggleTodo}
            onDelete={handleDeleteTodo}
            onAddChild={addChild}
            onChangeCategory={changeCategory}
            subtasksOf={subtasksOf}
          />
        ))}
      </ul>
    </main>
  )
}
