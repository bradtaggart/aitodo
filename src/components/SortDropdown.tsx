import type { SortBy } from '../task-list'

interface Props {
  value: SortBy
  onChange: (sort: SortBy) => void
}

export function SortDropdown({ value, onChange }: Props) {
  return (
    <select
      className="sort-dropdown"
      value={value}
      onChange={e => onChange(e.target.value as SortBy)}
      aria-label="Sort tasks"
    >
      <option value="none">Default</option>
      <option value="due_date">Due Date</option>
      <option value="category">Category</option>
      <option value="priority">Flag</option>
    </select>
  )
}
