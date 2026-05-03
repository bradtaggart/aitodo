import type { RecurringTemplate } from '../types'
import { toDateStr } from './dates'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function recurrenceLabel(t: RecurringTemplate): string {
  switch (t.recurrence_type) {
    case 'daily':   return 'daily'
    case 'monthly': return 'monthly'
    case 'custom':  return `every ${t.interval_days}d`
    case 'weekly': {
      const days = DAY_NAMES.filter((_, i) => (t.day_mask! >> i) & 1)
      return days.length === 1 ? `every ${days[0]}` : days.join('/')
    }
  }
}

function nextOccurrenceDate(template: RecurringTemplate, currentDue: string): string {
  const [y, m, d] = currentDue.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  switch (template.recurrence_type) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      break
    case 'weekly': {
      const mask = template.day_mask!
      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(date)
        candidate.setDate(date.getDate() + i)
        if (mask & (1 << candidate.getDay())) return toDateStr(candidate)
      }
      break
    }
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      date.setDate(template.day_of_month!)
      break
    case 'custom':
      date.setDate(date.getDate() + template.interval_days!)
      break
  }
  return toDateStr(date)
}

export function projectFutureDates(template: RecurringTemplate, startDue: string, horizonStr: string): string[] {
  const dates: string[] = []
  let current = startDue
  for (let i = 0; i < 1000; i++) {
    const next = nextOccurrenceDate(template, current)
    if (next > horizonStr) break
    dates.push(next)
    current = next
  }
  return dates
}
