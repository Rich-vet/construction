export type NavItem = {
  label: string
  icon: string
  to?: string
  disabled?: boolean
}

export type NavSection = {
  label?: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    items: [{ label: 'Dashboard', icon: 'bi-grid-1x2', to: '/' }],
  },
  {
    label: 'Projects',
    items: [
      { label: 'Projects', icon: 'bi-building', disabled: true },
      { label: 'Tasks', icon: 'bi-list-task', disabled: true },
      { label: 'Milestones', icon: 'bi-flag', disabled: true },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Employees', icon: 'bi-people', disabled: true },
      { label: 'Contractors', icon: 'bi-person-badge', disabled: true },
      { label: 'Attendance', icon: 'bi-calendar-check', disabled: true },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Materials', icon: 'bi-box-seam', disabled: true },
      { label: 'Equipment', icon: 'bi-truck', disabled: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Budgets', icon: 'bi-wallet2', disabled: true },
      { label: 'Expenses', icon: 'bi-cash-stack', disabled: true },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { label: 'Material Requests', icon: 'bi-clipboard-check', disabled: true },
      { label: 'Quotations', icon: 'bi-file-earmark-text', disabled: true },
      { label: 'Purchase Orders', icon: 'bi-cart-check', disabled: true },
      { label: 'Deliveries', icon: 'bi-box-arrow-in-down', disabled: true },
    ],
  },
  {
    label: 'Progress',
    items: [
      { label: 'Progress Updates', icon: 'bi-graph-up-arrow', disabled: true },
      { label: 'Site Reports', icon: 'bi-journal-text', disabled: true },
    ],
  },
  {
    label: 'Documents',
    items: [{ label: 'Documents', icon: 'bi-folder2-open', disabled: true }],
  },
  {
    label: 'Reports',
    items: [{ label: 'Reports', icon: 'bi-bar-chart-line', disabled: true }],
  },
  {
    label: 'System',
    items: [
      { label: 'Notifications', icon: 'bi-bell', disabled: true },
      { label: 'Activity Log', icon: 'bi-activity', disabled: true },
      { label: 'Settings', icon: 'bi-gear', disabled: true },
    ],
  },
]
