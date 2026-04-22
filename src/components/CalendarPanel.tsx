import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import type { Todo } from '../types'
import { toDate } from '../utils/dates'

interface Props {
  todos: Todo[]
  selectedDate: Date | null
  onDateSelect: (date: Date | null) => void
  open: boolean
  onToggle: () => void
}

export function CalendarPanel({ todos, selectedDate, onDateSelect, open, onToggle }: Props) {
  const dueDates = todos
    .filter(t => t.parent_id === null && t.due_date !== null)
    .map(t => toDate(t.due_date!))

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
          modifiers={{ hasTasks: dueDates }}
          modifiersClassNames={{ hasTasks: 'day-has-tasks' }}
        />
      )}
    </aside>
  )
}
