import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { toDate, toDateStr, formatDisplay, isOverdue } from '../utils/dates'

interface Props {
  dueDate: string | null
  onChange: (date: string | null) => void
  recurrenceLabel?: string
}

export function DueDateChip({ dueDate, onChange, recurrenceLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
    }
    setOpen(v => !v)
  }

  const selected = dueDate ? toDate(dueDate) : undefined
  const overdue = dueDate ? isOverdue(dueDate) : false

  function handleSelect(date: Date | undefined) {
    onChange(date ? toDateStr(date) : null)
    setOpen(false)
  }

  return (
    <div className="due-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`due-chip${dueDate ? (overdue ? ' overdue' : ' has-date') : ''}`}
        onClick={handleOpen}
      >
        {dueDate ? formatDisplay(dueDate) : '+ due date'}
      </button>
      {dueDate && (
        <button
          type="button"
          className="due-chip-clear"
          onClick={e => { e.stopPropagation(); onChange(null) }}
          aria-label="Clear due date"
        >
          ✕
        </button>
      )}
      {dueDate && recurrenceLabel && (
        <span className="recurrence-badge">{recurrenceLabel}</span>
      )}
      {open && createPortal(
        <div
          ref={popoverRef}
          className="due-chip-popover"
          style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 1000 }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
