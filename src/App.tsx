import { useState } from 'react'
import { CategoryBar } from './components/CategoryBar'
import { TodoItem, TodoListProvider } from './components/TodoItem'
import { CalendarPanel } from './components/CalendarPanel'
import { SortDropdown } from './components/SortDropdown'
import type { SortBy } from './components/SortDropdown'
import { useTodos } from './hooks/useTodos'
import { useCategories } from './hooks/useCategories'
import { useTemplates } from './hooks/useTemplates'
import type { SetRecurrenceConfig } from './api'
import type { Todo, Category, RecurringTemplate } from './types'
import { toDateStr } from './utils/dates'
import './App.css'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function isProjectedDate(template: RecurringTemplate, currentDue: string, targetStr: string): boolean {
  if (targetStr <= currentDue) return false
  switch (template.recurrence_type) {
    case 'daily':
      return true
    case 'weekly': {
      const [y, m, d] = targetStr.split('-').map(Number)
      const dayOfWeek = new Date(y, m - 1, d).getDay()
      return Boolean(template.day_mask && (template.day_mask & (1 << dayOfWeek)))
    }
    case 'monthly':
      return Number(targetStr.slice(8, 10)) === template.day_of_month
    case 'custom': {
      const [y1, m1, d1] = currentDue.split('-').map(Number)
      const [y2, m2, d2] = targetStr.split('-').map(Number)
      const diffDays = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000)
      return diffDays > 0 && (template.interval_days ?? 0) > 0 && diffDays % template.interval_days! === 0
    }
  }
}

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
    changeTitle,
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
    const todo = todos.find(t => t.id === id)
    const msg = todo?.template_id && !todo.done
      ? 'Delete this task, all its subtasks, and all future occurrences?'
      : 'Delete this task and all its subtasks?'
    if (!window.confirm(msg)) return
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
      if (selectedDate !== null) {
        const selectedStr = toDateStr(selectedDate)
        if (t.due_date === selectedStr) return true
        if (t.template_id && !t.done && t.due_date) {
          const tmpl = templates.find(tmpl => tmpl.id === t.template_id)
          if (tmpl && isProjectedDate(tmpl, t.due_date, selectedStr)) return true
        }
        return false
      }
      return true
    })
    .sort((a, b) => sortTodos(a, b, sortBy, categories))

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
          onSetRecurrence: handleSetRecurrence,
          onRemoveRecurrence: handleRemoveRecurrence,
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
