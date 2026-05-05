import { useState, useEffect, useMemo } from 'react'
import { CategoryBar } from './components/CategoryBar'
import { TodoItem, TodoListProvider } from './components/TodoItem'
import { CalendarPanel } from './components/CalendarPanel'
import { SortDropdown } from './components/SortDropdown'
import { useTodoStore } from './hooks/useTodoStore'
import { fetchMe, patchMe } from './api'
import type { SortBy } from './task-list'
import { deriveTaskList } from './task-list'
import './App.css'

export default function App() {
  const [input, setInput] = useState('')
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('none')

  useEffect(() => {
    fetchMe().then(user => {
      const saved = user.preferences.sort_by
      if (saved) setSortBy(saved as SortBy)
    }).catch(() => {})
  }, [])

  function handleSortChange(value: SortBy) {
    setSortBy(value)
    patchMe({ sort_by: value }).catch(() => {})
  }

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

  async function handleAddTodo(e: React.SubmitEvent<HTMLFormElement>) {
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
        <h1>What's Next...</h1>
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
      </main>
    </div>
  )
}
