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

export interface Todo {
  id: number
  text: string
  done: boolean
  completed_at: string | null
  created_at: string
  parent_id: number | null
  category_id: number | null
  due_date: string | null
  description: string | null
  template_id: number | null
  priority: 'high' | 'medium' | 'low' | null
}

export interface Category {
  id: number
  name: string
  color: string
}
