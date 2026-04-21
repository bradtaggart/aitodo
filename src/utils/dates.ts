export function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDisplay(dateStr: string): string {
  return toDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isOverdue(dateStr: string): boolean {
  const due = toDate(dateStr)
  due.setHours(23, 59, 59, 999)
  return due < new Date()
}
