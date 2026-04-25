import { useState } from 'react'
import type { RecurringTemplate, RecurrenceType } from '../types'
import type { SetRecurrenceConfig } from '../api'
import { recurrenceLabel } from '../utils/recurrence'

interface Props {
  dueDate: string | null
  template: RecurringTemplate | null
  onSet: (config: SetRecurrenceConfig) => Promise<void>
  onRemove: () => Promise<void>
}

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function RecurrencePicker({ dueDate, template, onSet, onRemove }: Props) {
  const [type, setType] = useState<RecurrenceType>(template?.recurrence_type ?? 'daily')
  const [dayMask, setDayMask] = useState<number>(template?.day_mask ?? 2)
  const [intervalDays, setIntervalDays] = useState<number>(template?.interval_days ?? 7)
  const [saving, setSaving] = useState(false)

  const dom = dueDate ? Number(dueDate.slice(8, 10)) : null
  const isValid = type !== 'weekly' || dayMask > 0

  async function handleSet() {
    setSaving(true)
    try {
      const config: SetRecurrenceConfig = { recurrence_type: type }
      if (type === 'weekly') config.day_mask = dayMask
      if (type === 'custom') config.interval_days = intervalDays
      await onSet(config)
    } finally {
      setSaving(false)
    }
  }

  if (!dueDate) {
    return (
      <div className="recurrence-row disabled">
        <span className="recurrence-row-label">🔁 Repeat</span>
        <span className="recurrence-hint">Set a due date first</span>
      </div>
    )
  }

  if (template) {
    return (
      <div className="recurrence-row">
        <span className="recurrence-row-label">🔁 Repeat</span>
        <span className="recurrence-current">{recurrenceLabel(template)}</span>
        <button type="button" className="recurrence-remove" onClick={onRemove}>
          Remove
        </button>
      </div>
    )
  }

  return (
    <div className="recurrence-row">
      <span className="recurrence-row-label">🔁 Repeat</span>
      <div className="recurrence-picker">
        <div className="rec-type-tabs">
          {(['daily', 'weekly', 'monthly', 'custom'] as RecurrenceType[]).map(t => (
            <button
              key={t}
              type="button"
              className={`rec-tab${type === t ? ' active' : ''}`}
              onClick={() => setType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {type === 'weekly' && (
          <div className="rec-days">
            {DAY_ABBR.map((d, i) => (
              <button
                key={d}
                type="button"
                className={`rec-day${(dayMask >> i) & 1 ? ' active' : ''}`}
                onClick={() => setDayMask(m => (m >> i) & 1 ? m & ~(1 << i) : m | (1 << i))}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        {type === 'monthly' && dom && (
          <span className="recurrence-hint">Repeats on the {ordinal(dom)}</span>
        )}
        {type === 'custom' && (
          <div className="rec-custom">
            <span>Every</span>
            <input
              type="number"
              min={1}
              max={365}
              value={intervalDays}
              onChange={e => setIntervalDays(Math.max(1, Number(e.target.value)))}
              className="rec-interval"
            />
            <span>days</span>
          </div>
        )}
        <button
          type="button"
          className="rec-set-btn"
          disabled={!isValid || saving}
          onClick={handleSet}
        >
          {saving ? '…' : 'Set'}
        </button>
      </div>
    </div>
  )
}
