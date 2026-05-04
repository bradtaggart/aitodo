import { request } from './api'
import type { Todo } from './types'
import { toDateStr } from './utils/dates'

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurringTemplate {
  id: number
  text: string
  category_id: number | null
  description: string | null
  recurrence_type: RecurrenceType
  day_mask: number | null
  interval_days: number | null
  day_of_month: number | null
}

export type SetRecurrenceConfig = {
  recurrence_type: RecurrenceType
  day_mask?: number
  interval_days?: number
}

export const fetchTemplates = () =>
  request<RecurringTemplate[]>('/api/templates')

export const createTemplate = (todo_id: number, config: SetRecurrenceConfig) =>
  request<{ template: RecurringTemplate; todo: Todo }>('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ todo_id, ...config }),
  })

export const eraseTemplate = (id: number) =>
  request<{ ok: true }>(`/api/templates/${id}`, { method: 'DELETE' })

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

export function isProjectedDate(template: RecurringTemplate, currentDue: string, targetStr: string): boolean {
  if (targetStr <= currentDue) return false
  switch (template.recurrence_type) {
    case 'daily':
      return true
    case 'weekly': {
      const [y, m, d] = targetStr.split('-').map(Number)
      const dayOfWeek = new Date(y, m - 1, d).getDay()
      return Boolean(template.day_mask && (template.day_mask & (1 << dayOfWeek)))
    }
    case 'monthly':
      return Number(targetStr.slice(8, 10)) === template.day_of_month
    case 'custom': {
      const [y1, m1, d1] = currentDue.split('-').map(Number)
      const [y2, m2, d2] = targetStr.split('-').map(Number)
      const diffDays = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000)
      return diffDays > 0 && (template.interval_days ?? 0) > 0 && diffDays % template.interval_days! === 0
    }
  }
}
