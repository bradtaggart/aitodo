export interface RecurrenceSpec {
  recurrence_type: string
  day_mask: number | null
  interval_days: number | null
  day_of_month: number | null
}

export function advanceByRecurrence(spec: RecurrenceSpec, currentDue: string): string {
  const d = new Date(currentDue + 'T12:00:00Z')
  switch (spec.recurrence_type) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1)
      break
    case 'weekly': {
      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(d)
        candidate.setUTCDate(d.getUTCDate() + i)
        if (spec.day_mask! & (1 << candidate.getUTCDay())) {
          return candidate.toISOString().slice(0, 10)
        }
      }
      throw new Error('weekly template has no valid day in mask')
    }
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1)
      d.setUTCDate(spec.day_of_month!)
      break
    case 'custom':
      d.setUTCDate(d.getUTCDate() + spec.interval_days!)
      break
  }
  return d.toISOString().slice(0, 10)
}
