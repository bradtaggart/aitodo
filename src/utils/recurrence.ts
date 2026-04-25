import type { RecurringTemplate } from '../types'

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
