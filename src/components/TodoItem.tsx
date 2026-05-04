import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import { Plus, Trash2, ChevronRight, ChevronDown, Flag } from 'lucide-react'
import type { Todo, Category } from '../types'
import type { RecurringTemplate, SetRecurrenceConfig } from '../recurrence'
import { DueDateChip } from './DueDateChip'
import { DescriptionField } from './DescriptionField'
import { RecurrencePicker } from './RecurrencePicker'

function useTitleEdit(currentText: string, onSave: (text: string) => void) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(currentText)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!isEditing) setDraft(currentText)
  }, [currentText, isEditing])

  const start = useCallback(() => {
    setDraft(currentText)
    setIsEditing(true)
  }, [currentText])

  const handleBlur = useCallback(() => {
    if (cancelledRef.current) { cancelledRef.current = false; return }
    const trimmed = draft.trim()
    if (trimmed && trimmed !== currentText) onSave(trimmed)
    else setDraft(currentText)
    setIsEditing(false)
  }, [draft, currentText, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelledRef.current = true
      setDraft(currentText)
      setIsEditing(false)
    }
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
  }, [currentText])

  return {
    isEditing,
    start,
    inputProps: {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
  }
}

interface TodoListContextValue {
  categories: Category[]
  templates: RecurringTemplate[]
  subtasksOf: (id: number) => Todo[]
  showDueDateChip: boolean
  forceExpanded: boolean
  onToggle: (id: number, done: boolean) => void
  onDelete: (id: number) => void
  onAddChild: (text: string, parent_id: number) => void
  onChangeCategory: (id: number, category_id: number | null) => void
  onChangeDueDate: (id: number, due_date: string | null) => void
  onChangeDescription: (id: number, description: string | null) => void
  onChangePriority: (id: number, priority: 'high' | 'medium' | 'low' | null) => void
  onChangeTitle: (id: number, text: string) => void
  onSetRecurrence: (todoId: number, config: SetRecurrenceConfig) => Promise<void>
  onRemoveRecurrence: (templateId: number) => Promise<void>
}

const TodoListContext = createContext<TodoListContextValue | null>(null)

function useTodoList() {
  const ctx = useContext(TodoListContext)
  if (!ctx) throw new Error('useTodoList must be used within a TodoListProvider')
  return ctx
}

export function TodoListProvider({ value, children }: { value: TodoListContextValue; children: React.ReactNode }) {
  return <TodoListContext.Provider value={value}>{children}</TodoListContext.Provider>
}

export function TodoItem({ todo }: { todo: Todo }) {
  const {
    categories, templates, subtasksOf,
    showDueDateChip, forceExpanded,
    onToggle, onDelete, onAddChild,
    onChangeCategory, onChangeDueDate, onChangeDescription,
    onChangePriority, onChangeTitle, onSetRecurrence, onRemoveRecurrence,
  } = useTodoList()

  const subtasks = subtasksOf(todo.id)

  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`collapsed:${todo.id}`) === 'true'
  )
  const [input, setInput] = useState('')
  const { isEditing: editingTitle, start: startEditingTitle, inputProps: titleInputProps } =
    useTitleEdit(todo.text, text => onChangeTitle(todo.id, text))

  const CYCLE: Record<string, 'high' | 'medium' | 'low' | null> = { high: 'medium', medium: 'low', low: null }
  function cyclePriority() {
    const next = todo.priority ? CYCLE[todo.priority] : 'high'
    onChangePriority(todo.id, next)
  }

  const cat = categories.find(c => c.id === todo.category_id) ?? null
  const template = templates.find(t => t.id === todo.template_id) ?? null
  const isExpanded = forceExpanded || !collapsed

  async function handleAddChild(e: React.SubmitEvent<HTMLFormElement>) {
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
      localStorage.setItem(`collapsed:${todo.id}`, String(next))
      return next
    })
  }

  return (
    <li>
      <div className={`todo-row${todo.done ? ' done' : ''}`}>
        <button
          className="check"
          onClick={() => onToggle(todo.id, todo.done)}
          aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
        >
          {todo.done ? '✓' : ''}
        </button>
        <button
          className={`priority-flag priority-${todo.priority ?? 'none'}`}
          onClick={cyclePriority}
          aria-label={`Priority: ${todo.priority ?? 'none'}`}
          title={`Priority: ${todo.priority ?? 'none'} (click to change)`}
        >
          <Flag size={14} />
        </button>
        <span className="todo-text">
          {editingTitle ? (
            <input
              className="todo-label-input"
              autoFocus
              aria-label="Edit task title"
              {...titleInputProps}
            />
          ) : (
            <button
              className="todo-label"
              onClick={startEditingTitle}
              aria-label="Edit task title"
            >
              {todo.text}
            </button>
          )}
          {todo.created_at && (
            <time className="created-at">Created {new Date(todo.created_at).toLocaleString()}</time>
          )}
          {todo.done && todo.completed_at && (
            <time className="completed-at">Completed {new Date(todo.completed_at).toLocaleString()}</time>
          )}
        </span>
        {showDueDateChip && todo.parent_id === null && (
          <DueDateChip
            dueDate={todo.due_date}
            onChange={due_date => onChangeDueDate(todo.id, due_date)}
          />
        )}
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
            {cat ? cat.name : 'Category'}
          </span>
        )}
        {subtasks.length > 0 && !forceExpanded && (
          <button className="collapse" onClick={toggleCollapse} aria-label={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        {!todo.done && (
          <button className="add-child" onClick={() => setAdding(v => !v)} aria-label="Add subtask"><Plus size={14} /></button>
        )}
        <button className="delete" onClick={() => onDelete(todo.id)} aria-label="Delete task"><Trash2 size={14} /></button>
      </div>
      <DescriptionField
        value={todo.description}
        onChange={description => onChangeDescription(todo.id, description)}
      />
      {todo.parent_id === null && (
        <RecurrencePicker
          dueDate={todo.due_date}
          template={template}
          onSet={config => onSetRecurrence(todo.id, config)}
          onRemove={async () => { if (template) await onRemoveRecurrence(template.id) }}
        />
      )}
      {adding && (
        <form onSubmit={handleAddChild} className="child-form">
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
      {subtasks.length > 0 && isExpanded && (
        <ul className="todo-list child-list">
          {subtasks.map(child => (
            <TodoItem key={child.id} todo={child} />
          ))}
        </ul>
      )}
    </li>
  )
}
