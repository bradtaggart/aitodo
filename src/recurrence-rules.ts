export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurrenceConfig {
  recurrence_type?: string
  day_mask?: number
  interval_days?: number
}

export interface RecurrenceSpec {
  recurrence_type: string
  day_mask: number | null
  interval_days: number | null
  day_of_month: number | null
}

export function validateRecurrenceConfig(config: RecurrenceConfig): asserts config is RecurrenceConfig & { recurrence_type: RecurrenceType } {
  const { recurrence_type, day_mask, interval_days } = config
  const validTypes = ['daily', 'weekly', 'monthly', 'custom']
  if (!recurrence_type || !validTypes.includes(recurrence_type)) {
    throw new Error('recurrence_type must be daily|weekly|monthly|custom')
  }
  if (recurrence_type === 'weekly' && !(day_mask && day_mask > 0)) {
    throw new Error('day_mask required and non-zero for weekly')
  }
  if (recurrence_type === 'custom' && (!interval_days || interval_days < 1)) {
    throw new Error('interval_days required and >= 1 for custom')
  }
}

export function deriveRecurrenceFields(config: RecurrenceConfig, dueDate: string): RecurrenceSpec {
  validateRecurrenceConfig(config)
  return {
    recurrence_type: config.recurrence_type,
    day_mask: config.recurrence_type === 'weekly' ? (config.day_mask ?? null) : null,
    interval_days: config.recurrence_type === 'custom' ? (config.interval_days ?? null) : null,
    day_of_month: config.recurrence_type === 'monthly' ? Number(dueDate.slice(8, 10)) : null,
  }
}

export function nextRecurrenceDate(spec: RecurrenceSpec, currentDue: string): string {
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

export function projectRecurrenceDates(spec: RecurrenceSpec, startDue: string, horizonStr: string): string[] {
  const dates: string[] = []
  let current = startDue
  for (let i = 0; i < 1000; i++) {
    const next = nextRecurrenceDate(spec, current)
    if (next > horizonStr) break
    dates.push(next)
    current = next
  }
  return dates
}

export function isRecurrenceDate(spec: RecurrenceSpec, currentDue: string, targetStr: string): boolean {
  if (targetStr <= currentDue) return false
  switch (spec.recurrence_type) {
    case 'daily':
      return true
    case 'weekly': {
      const [y, m, d] = targetStr.split('-').map(Number)
      const dayOfWeek = new Date(y, m - 1, d).getDay()
      return (spec.day_mask! & (1 << dayOfWeek)) !== 0
    }
    case 'monthly':
      return Number(targetStr.slice(8, 10)) === spec.day_of_month
    case 'custom': {
      const [y1, m1, d1] = currentDue.split('-').map(Number)
      const [y2, m2, d2] = targetStr.split('-').map(Number)
      const diffDays = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000)
      return diffDays > 0 && spec.interval_days! > 0 && diffDays % spec.interval_days! === 0
    }
  }
  return false
}
