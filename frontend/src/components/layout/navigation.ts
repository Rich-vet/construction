export type NavItem = {
  id: string
  label: string
  icon: string
  to?: string
  implemented?: boolean
}

export type NavSection = {
  label?: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2', to: '/', implemented: true },
    ],
  },
  {
    label: 'Projects',
    items: [
      { id: 'projects', label: 'Projects', icon: 'bi-building', to: '/projects', implemented: true },
      { id: 'tasks', label: 'Tasks', icon: 'bi-list-task', to: '/tasks', implemented: true },
      { id: 'milestones', label: 'Milestones', icon: 'bi-flag' },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'employees', label: 'Employees', icon: 'bi-people' },
      { id: 'contractors', label: 'Contractors', icon: 'bi-person-badge' },
      { id: 'attendance', label: 'Attendance', icon: 'bi-calendar-check', to: '/attendance', implemented: true },
    ],
  },
  {
    label: 'Resources',
    items: [
      { id: 'materials', label: 'Materials', icon: 'bi-box-seam', to: '/materials', implemented: true },
      { id: 'equipment', label: 'Equipment', icon: 'bi-truck', to: '/equipment', implemented: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'budgets', label: 'Budgets', icon: 'bi-wallet2' },
      { id: 'expenses', label: 'Expenses', icon: 'bi-cash-stack' },
    ],
  },
  {
    label: 'Procurement',
    items: [
      {
        id: 'material_requests',
        label: 'Material Requests',
        icon: 'bi-clipboard-check',
        to: '/material-requests',
        implemented: true,
      },
      { id: 'quotations', label: 'Quotations', icon: 'bi-file-earmark-text' },
      { id: 'purchase_orders', label: 'Purchase Orders', icon: 'bi-cart-check' },
      { id: 'deliveries', label: 'Deliveries', icon: 'bi-box-arrow-in-down' },
    ],
  },
  {
    label: 'Progress',
    items: [
      { id: 'progress_updates', label: 'Progress Updates', icon: 'bi-graph-up-arrow', to: '/progress-updates', implemented: true },
      { id: 'site_reports', label: 'Site Reports', icon: 'bi-journal-text', to: '/site-reports', implemented: true },
    ],
  },
  {
    label: 'Documents',
    items: [{ id: 'documents', label: 'Documents', icon: 'bi-folder2-open', to: '/documents', implemented: true }],
  },
  {
    label: 'Reports',
    items: [
      { id: 'reports', label: 'Reports', icon: 'bi-bar-chart-line', to: '/reports', implemented: true },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'users', label: 'Users', icon: 'bi-person-gear', to: '/users', implemented: true },
      { id: 'company', label: 'Company', icon: 'bi-buildings', to: '/company', implemented: true },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: 'bi-bell',
        to: '/notifications',
        implemented: true,
      },
      {
        id: 'activity_log',
        label: 'Activity Log',
        icon: 'bi-activity',
        to: '/activity-log',
        implemented: true,
      },
      { id: 'settings', label: 'Settings', icon: 'bi-gear', to: '/settings', implemented: true },
    ],
  },
]

export function filterNavigation(allowed: string[]): NavSection[] {
  const allowedSet = new Set(allowed)
  return navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => allowedSet.has(item.id)),
    }))
    .filter((section) => section.items.length > 0)
}
