/** Semantic status colours. The same status uses the same colour on every page. */
export const STATUS_PALETTE = {
  green: '#16803C',
  red: '#DC2626',
  amber: '#D97706',
  blue: '#2563EB',
  grey: '#64748B',
  purple: '#7C3AED',
} as const

const TONE: Record<string, keyof typeof STATUS_PALETTE> = {
  active: 'green',
  approved: 'green',
  available: 'green',
  good: 'green',
  excellent: 'green',
  operational: 'green',
  present: 'green',
  overdue: 'red',
  rejected: 'red',
  critical: 'red',
  urgent: 'red',
  high: 'red',
  poor: 'red',
  damaged: 'red',
  delayed: 'red',
  unavailable: 'red',
  failed: 'red',
  pending: 'amber',
  'ready for review': 'amber',
  'rework required': 'amber',
  'on hold': 'amber',
  planned: 'amber',
  fair: 'amber',
  'pending approval': 'amber',
  'return pending': 'amber',
  'needs inspection': 'amber',
  'in progress': 'blue',
  allocated: 'blue',
  issued: 'blue',
  reserved: 'blue',
  assigned: 'blue',
  completed: 'grey',
  verified: 'grey',
  cancelled: 'grey',
  inactive: 'grey',
  archived: 'grey',
  'under maintenance': 'purple',
}

export function statusColor(status: string): string {
  const tone = TONE[status.trim().toLowerCase()] ?? 'grey'
  return STATUS_PALETTE[tone]
}

export function colorsForLabels(labels: string[]): string[] {
  return labels.map((label) => statusColor(label))
}
