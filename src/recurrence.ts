import { request } from './api'
import type { Todo } from './types'
import { advanceByRecurrence } from './utils/recurrence-math'

type TemplateBase = {
  id: number
  text: string
  category_id: number | null
  description: string | null
}

type DailyTemplate   = TemplateBase & { recurrence_type: 'daily';   day_mask: null;   interval_days: null;   day_of_month: null }
type WeeklyTemplate  = TemplateBase & { recurrence_type: 'weekly';  day_mask: number; interval_days: null;   day_of_month: null }
type MonthlyTemplate = TemplateBase & { recurrence_type: 'monthly'; day_mask: null;   interval_days: null;   day_of_month: number }
type CustomTemplate  = TemplateBase & { recurrence_type: 'custom';  day_mask: null;   interval_days: number; day_of_month: null }

export type RecurringTemplate = DailyTemplate | WeeklyTemplate | MonthlyTemplate | CustomTemplate
export type RecurrenceType = RecurringTemplate['recurrence_type']

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
      const days = DAY_NAMES.filter((_, i) => (t.day_mask >> i) & 1)
      return days.length === 1 ? `every ${days[0]}` : days.join('/')
    }
  }
}

export function projectFutureDates(template: RecurringTemplate, startDue: string, horizonStr: string): string[] {
  const dates: string[] = []
  let current = startDue
  for (let i = 0; i < 1000; i++) {
    const next = advanceByRecurrence(template, current)
    if (next > horizonStr) break
    dates.push(next)
    current = next
  }
  return dates
}

export function getTaskDates(todos: Todo[], templates: RecurringTemplate[], horizonStr: string): Set<string> {
  const dates = new Set<string>()
  for (const todo of todos) {
    if (todo.parent_id === null && todo.due_date !== null) dates.add(todo.due_date)
  }
  for (const template of templates) {
    const current = todos.find(t => t.template_id === template.id && !t.done && t.due_date !== null)
    if (!current?.due_date) continue
    for (const d of projectFutureDates(template, current.due_date, horizonStr)) dates.add(d)
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
      return (template.day_mask & (1 << dayOfWeek)) !== 0
    }
    case 'monthly':
      return Number(targetStr.slice(8, 10)) === template.day_of_month
    case 'custom': {
      const [y1, m1, d1] = currentDue.split('-').map(Number)
      const [y2, m2, d2] = targetStr.split('-').map(Number)
      const diffDays = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000)
      return diffDays > 0 && template.interval_days > 0 && diffDays % template.interval_days === 0
    }
  }
}
