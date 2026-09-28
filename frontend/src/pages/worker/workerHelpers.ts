/** Derive a visual progress % from task status (worker tasks have no separate progress field). */
export function taskProgressPercent(status: unknown): number {
  const s = String(status || '').toLowerCase()
  if (s === 'completed') return 100
  if (s === 'in progress') return 55
  if (s === 'cancelled') return 0
  return 15
}

export function isOverdue(dueDate: unknown, status: unknown): boolean {
  if (!dueDate) return false
  const s = String(status || '').toLowerCase()
  if (s === 'completed' || s === 'cancelled') return false
  const due = new Date(String(dueDate))
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function isDueToday(dueDate: unknown): boolean {
  if (!dueDate) return false
  const due = new Date(String(dueDate))
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  )
}

export function formatDueLabel(dueDate: unknown): string {
  if (!dueDate) return 'No due date'
  const due = new Date(String(dueDate))
  if (Number.isNaN(due.getTime())) return String(dueDate)
  if (isDueToday(dueDate)) {
    return `Today, ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return due.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
