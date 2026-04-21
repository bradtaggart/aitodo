export interface Todo {
  id: number
  text: string
  done: boolean
  completed_at: string | null
  created_at: string
  parent_id: number | null
  category_id: number | null
  due_date: string | null
}

export interface Category {
  id: number
  name: string
  color: string
}
