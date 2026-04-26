import { useState } from 'react'
import type { Todo, Category, RecurringTemplate } from '../types'
import type { SetRecurrenceConfig } from '../api'
import { DueDateChip } from './DueDateChip'
import { DescriptionField } from './DescriptionField'
import { RecurrencePicker } from './RecurrencePicker'

interface Props {
  todo: Todo
  subtasks: Todo[]
  categories: Category[]
  templates: RecurringTemplate[]
  onToggle: (id: number, done: boolean) => void
  onDelete: (id: number) => void
  onAddChild: (text: string, parent_id: number) => void
  onChangeCategory: (id: number, category_id: number | null) => void
  onChangeDueDate: (id: number, due_date: string | null) => void
  onChangeDescription: (id: number, description: string | null) => void
  onSetRecurrence: (todoId: number, config: SetRecurrenceConfig) => Promise<void>
  onRemoveRecurrence: (templateId: number) => Promise<void>
  subtasksOf: (id: number) => Todo[]
  showDueDateChip: boolean
  forceExpanded?: boolean
}

export function TodoItem({ todo, subtasks, categories, templates, onToggle, onDelete, onAddChild, onChangeCategory, onChangeDueDate, onChangeDescription, onSetRecurrence, onRemoveRecurrence, subtasksOf, showDueDateChip, forceExpanded = false }: Props) {
  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`collapsed:${todo.id}`) === 'true'
  )
  const [input, setInput] = useState('')

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
        <span className="todo-text">
          <span className="todo-label">{todo.text}</span>
          {todo.created_at && (
            <time className="created-at">Created {new Date(todo.created_at).toLocaleString()}</time>
          )}
          {todo.done && todo.completed_at && (
            <time className="completed-at">Completed {new Date(todo.completed_at).toLocaleString()}</time>
          )}
        </span>
        {showDueDateChip && (
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
            {cat ? cat.name : '+'}
          </span>
        )}
        {subtasks.length > 0 && !forceExpanded && (
          <button className="collapse" onClick={toggleCollapse} aria-label={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '▶' : '▼'}
          </button>
        )}
        {!todo.done && (
          <button className="add-child" onClick={() => setAdding(v => !v)} aria-label="Add subtask">+</button>
        )}
        <button className="delete" onClick={() => onDelete(todo.id)} aria-label="Delete task">×</button>
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
          onRemove={() => template && onRemoveRecurrence(template.id)}
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
            <TodoItem
              key={child.id}
              todo={child}
              subtasks={subtasksOf(child.id)}
              categories={categories}
              templates={templates}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onChangeCategory={onChangeCategory}
              onChangeDueDate={onChangeDueDate}
              onChangeDescription={onChangeDescription}
              onSetRecurrence={onSetRecurrence}
              onRemoveRecurrence={onRemoveRecurrence}
              subtasksOf={subtasksOf}
              showDueDateChip={false}
              forceExpanded={forceExpanded}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
