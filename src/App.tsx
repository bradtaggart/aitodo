import { useState } from 'react'
import { CategoryBar } from './components/CategoryBar'
import { TodoItem } from './components/TodoItem'
import { CalendarPanel } from './components/CalendarPanel'
import { useTodos } from './hooks/useTodos'
import { useCategories } from './hooks/useCategories'
import { toDateStr } from './utils/dates'
import './App.css'

export default function App() {
  const [input, setInput] = useState('')
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(true)

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
    changeDueDate,
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

  const topLevel = todos.filter(t => {
    if (t.parent_id) return false
    if (activeCat !== null && t.category_id !== activeCat) return false
    if (selectedDate !== null && t.due_date !== toDateStr(selectedDate)) return false
    return true
  })

  const activeCatObj = categories.find(c => c.id === activeCat) ?? null

  return (
    <div className="app-layout">
      <CalendarPanel
        todos={todos}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        open={calendarOpen}
        onToggle={() => setCalendarOpen(v => !v)}
      />
      <main className="main-panel">
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
        {selectedDate && (
          <div className="filter-banner">
            Tasks due <strong>{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
            <span style={{ marginLeft: 4 }}>· {topLevel.length} {topLevel.length === 1 ? 'task' : 'tasks'}</span>
            <button onClick={() => setSelectedDate(null)} aria-label="Clear date filter">✕ Clear filter</button>
          </div>
        )}
        {topLevel.length === 0 && <p className="empty">{selectedDate ? 'No tasks due on this day.' : 'No tasks yet.'}</p>}
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
              onChangeDueDate={changeDueDate}
              subtasksOf={subtasksOf}
              showDueDateChip={selectedDate === null}
              forceExpanded={selectedDate !== null}
            />
          ))}
        </ul>
      </main>
    </div>
  )
}
