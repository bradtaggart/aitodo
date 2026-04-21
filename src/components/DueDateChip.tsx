import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { toDate, toDateStr, formatDisplay, isOverdue } from '../utils/dates'

interface Props {
  dueDate: string | null
  onChange: (date: string | null) => void
}

export function DueDateChip({ dueDate, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = dueDate ? toDate(dueDate) : undefined
  const overdue = dueDate ? isOverdue(dueDate) : false

  function handleSelect(date: Date | undefined) {
    if (!date) return
    onChange(toDateStr(date))
    setOpen(false)
  }

  return (
    <div className="due-chip-wrap" ref={ref}>
      <button
        type="button"
        className={`due-chip${dueDate ? (overdue ? ' overdue' : ' has-date') : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        {dueDate ? formatDisplay(dueDate) : '+ due date'}
        {dueDate && (
          <span
            className="due-chip-clear"
            onClick={e => { e.stopPropagation(); onChange(null) }}
            role="button"
            aria-label="Clear due date"
          >
            ✕
          </span>
        )}
      </button>
      {open && (
        <div className="due-chip-popover">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  )
}
