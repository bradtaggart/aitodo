import { useState } from 'react'
import { CategoryBar } from './components/CategoryBar'
import { TodoItem } from './components/TodoItem'
import { CalendarPanel } from './components/CalendarPanel'
import { SortDropdown } from './components/SortDropdown'
import type { SortBy } from './components/SortDropdown'
import { useTodos } from './hooks/useTodos'
import { useCategories } from './hooks/useCategories'
import { useTemplates } from './hooks/useTemplates'
import type { SetRecurrenceConfig } from './api'
import type { Todo, Category } from './types'
import { toDateStr } from './utils/dates'
import './App.css'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function sortTodos(a: Todo, b: Todo, sortBy: SortBy, categories: Category[]): number {
  if (sortBy === 'priority') {
    const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
    const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
    return pa - pb
  }
  if (sortBy === 'due_date') {
    if (!a.due_date && !b.due_date) return b.id - a.id
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
  }
  if (sortBy === 'category') {
    const nameOf = (t: Todo) => categories.find(c => c.id === t.category_id)?.name ?? ''
    const na = nameOf(a)
    const nb = nameOf(b)
    if (!na && !nb) return b.id - a.id
    if (!na) return 1
    if (!nb) return -1
    return na.localeCompare(nb)
  }
  return b.id - a.id
}

export default function App() {
  const [input, setInput] = useState('')
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('none')

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
    changeDescription,
    changePriority,
  } = useTodos()

  const {
    categories,
    error: catError,
    clearError: clearCatError,
    addCategory,
    deleteCategory: deleteCategoryBase,
  } = useCategories()

  const {
    templates,
    error: templateError,
    clearError: clearTemplateError,
    createTemplate,
    deleteTemplate,
  } = useTemplates()

  const error = todoError ?? catError ?? templateError
  const clearError = () => { clearTodoError(); clearCatError(); clearTemplateError() }

  async function handleAddTodo(e: React.SubmitEvent<HTMLFormElement>) {
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

  async function handleSetRecurrence(todoId: number, config: SetRecurrenceConfig) {
    await createTemplate(todoId, config)
    await loadTodos()
  }

  async function handleRemoveRecurrence(templateId: number) {
    await deleteTemplate(templateId)
    await loadTodos()
  }

  const topLevel = todos
    .filter(t => {
      if (t.parent_id) return false
      if (activeCat !== null && t.category_id !== activeCat) return false
      if (selectedDate !== null && t.due_date !== toDateStr(selectedDate)) return false
      return true
    })
    .sort((a, b) => sortTodos(a, b, sortBy, categories))

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
          <SortDropdown value={sortBy} onChange={setSortBy} />
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
              templates={templates}
              onToggle={toggleTodo}
              onDelete={handleDeleteTodo}
              onAddChild={addChild}
              onChangeCategory={changeCategory}
              onChangeDueDate={changeDueDate}
              onChangeDescription={changeDescription}
              onChangePriority={changePriority}
              onSetRecurrence={handleSetRecurrence}
              onRemoveRecurrence={handleRemoveRecurrence}
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
