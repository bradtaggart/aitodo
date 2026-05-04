import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import type { Todo } from '../types'
import type { RecurringTemplate } from '../recurrence'
import { getTaskDates } from '../recurrence'
import { toDateStr } from '../utils/dates'

interface Props {
  todos: Todo[]
  templates: RecurringTemplate[]
  selectedDate: Date | null
  onDateSelect: (date: Date | null) => void
  open: boolean
  onToggle: () => void
}

export function CalendarPanel({ todos, templates, selectedDate, onDateSelect, open, onToggle }: Props) {
  const horizonStr = `${new Date().getFullYear() + 2}-12-31`
  const taskKeys = getTaskDates(todos, templates, horizonStr)

  function hasTasks(day: Date): boolean {
    return taskKeys.has(toDateStr(day))
  }

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onDateSelect(null)
      return
    }
    onDateSelect(date)
  }

  return (
    <aside className={`calendar-panel${open ? ' open' : ''}`}>
      <button
        className="calendar-toggle"
        onClick={onToggle}
        aria-label={open ? 'Collapse calendar' : 'Expand calendar'}
      >
        {open ? '◀' : '▶'}
      </button>
      {open && (
        <DayPicker
          mode="single"
          numberOfMonths={2}
          selected={selectedDate ?? undefined}
          onSelect={handleSelect}
          modifiers={{ hasTasks }}
          modifiersClassNames={{ hasTasks: 'day-has-tasks' }}
        />
      )}
      {open && <span className="app-version">v{__APP_VERSION__}</span>}
    </aside>
  )
}
