import { useState, useEffect, useMemo } from 'react'
import { CategoryBar } from './components/CategoryBar'
import { TodoItem, TodoListProvider } from './components/TodoItem'
import { CalendarPanel } from './components/CalendarPanel'
import { SortDropdown } from './components/SortDropdown'
import { AuthForm } from './components/AuthForm'
import { useTodoStore } from './hooks/useTodoStore'
import { useAuth } from './hooks/useAuth'
import { patchMe } from './api'
import type { User } from './types'
import type { SortBy } from './task-list'
import { deriveTaskList } from './task-list'
import './App.css'

function MainApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [input, setInput] = useState('')
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>(() => (user.preferences.sort_by as SortBy) ?? 'none')

  const {
    todos,
    categories,
    templates,
    pending,
    error,
    clearError,
    addTodo,
    addChild,
    toggleTodo,
    deleteTodo,
    changeCategory,
    changeDueDate,
    changeDescription,
    changePriority,
    changeTitle,
    addCategory,
    deleteCategory,
    createTemplate,
    deleteTemplate,
  } = useTodoStore()

  useEffect(() => {
    const saved = user.preferences.sort_by
    if (saved) setSortBy(saved as SortBy)
  }, [user.id])

  function handleSortChange(value: SortBy) {
    setSortBy(value)
    patchMe({ sort_by: value }).catch(() => {})
  }

  async function handleAddTodo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    await addTodo(text, activeCat)
  }

  async function handleDeleteTodo(id: number) {
    const todo = todos.find(t => t.id === id)
    const msg = todo?.template_id && !todo.done
      ? 'Delete this task, all its subtasks, and all future occurrences?'
      : 'Delete this task and all its subtasks?'
    if (!window.confirm(msg)) return
    await deleteTodo(id)
  }

  async function handleDeleteCategory(id: number) {
    await deleteCategory(id)
    if (activeCat === id) setActiveCat(null)
  }

  const { topLevel, subtasksOf } = useMemo(() => deriveTaskList({
    todos,
    categories,
    templates,
    activeCategoryId: activeCat,
    selectedDate,
    sortBy,
  }), [todos, categories, templates, activeCat, selectedDate, sortBy])

  const activeCatObj = categories.find(c => c.id === activeCat) ?? null

  return (
    <div className="app-layout">
      <CalendarPanel
        todos={todos}
        templates={templates}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        open={calendarOpen}
        onToggle={() => setCalendarOpen(v => !v)}
      />
      <main className="main-panel">
        <div className="page-intro">
          <p className="page-kicker">Work bulletin</p>
          <div className="app-header">
            <div>
              <h1>What&apos;s Next, {user.name.charAt(0).toUpperCase() + user.name.slice(1)}...</h1>
              <p className="page-subtitle">A clearer desk for today&apos;s tasks, dates, and follow-through.</p>
            </div>
            <button className="logout-btn" onClick={onLogout}>Sign out</button>
          </div>
        </div>

        <section className="desk-section desk-section-primary">
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
            <SortDropdown value={sortBy} onChange={handleSortChange} />
          </form>
        </section>

        <section className="desk-section desk-section-secondary">
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
              <span className="filter-banner-count">· {topLevel.length} {topLevel.length === 1 ? 'task' : 'tasks'}</span>
              <button onClick={() => setSelectedDate(null)} aria-label="Clear date filter">✕ Clear filter</button>
            </div>
          )}
        </section>

        <section className="desk-section desk-section-list">
          <div className="list-heading">
            <p className="list-kicker">{selectedDate ? 'Dated items' : 'Task list'}</p>
            <p className="list-meta">{topLevel.length} {topLevel.length === 1 ? 'entry' : 'entries'}</p>
          </div>
          {topLevel.length === 0 && <p className="empty">{selectedDate ? 'No tasks due on this day.' : 'No tasks yet.'}</p>}
          <TodoListProvider value={{
            categories,
            templates,
            subtasksOf,
            showDueDateChip: selectedDate === null,
            forceExpanded: selectedDate !== null,
            onToggle: toggleTodo,
            onDelete: handleDeleteTodo,
            onAddChild: addChild,
            onChangeCategory: changeCategory,
            onChangeDueDate: changeDueDate,
            onChangeDescription: changeDescription,
            onChangePriority: changePriority,
            onChangeTitle: changeTitle,
            onSetRecurrence: createTemplate,
            onRemoveRecurrence: deleteTemplate,
          }}>
            <ul className="todo-list">
              {topLevel.map(todo => (
                <TodoItem key={todo.id} todo={todo} />
              ))}
            </ul>
          </TodoListProvider>
        </section>
      </main>
    </div>
  )
}

export default function App() {
  const { state: authState, login, register, logout } = useAuth()

  if (authState.status === 'loading') return null
  if (authState.status === 'unauthenticated') {
    return <AuthForm onLogin={login} onRegister={register} />
  }

  return <MainApp user={authState.user} onLogout={logout} />
}
