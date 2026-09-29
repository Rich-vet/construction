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
      { id: 'tasks', label: 'My Tasks', icon: 'bi-list-task', to: '/tasks', implemented: true },
      {
        id: 'milestones',
        label: 'Milestones',
        icon: 'bi-flag',
        to: '/milestones',
        implemented: true,
      },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'employees', label: 'Employees', icon: 'bi-people', to: '/employees', implemented: true },
      {
        id: 'contractors',
        label: 'Contractors',
        icon: 'bi-person-badge',
        to: '/contractors',
        implemented: true,
      },
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
      { id: 'budgets', label: 'Budgets', icon: 'bi-wallet2', to: '/budgets', implemented: true },
      { id: 'expenses', label: 'Expenses', icon: 'bi-cash-stack', to: '/expenses', implemented: true },
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
      { id: 'quotations', label: 'Quotations', icon: 'bi-file-earmark-text', to: '/quotations', implemented: true },
      { id: 'purchase_orders', label: 'Purchase Orders', icon: 'bi-cart-check', to: '/purchase-orders', implemented: true },
      { id: 'deliveries', label: 'Deliveries', icon: 'bi-box-arrow-in-down', to: '/deliveries', implemented: true },
    ],
  },
  {
    label: 'Site',
    items: [
      { id: 'site_diary', label: 'Site Diary', icon: 'bi-journal-richtext', to: '/site-diary', implemented: true },
      { id: 'progress_updates', label: 'Progress Updates', icon: 'bi-graph-up-arrow', to: '/site-diary', implemented: true },
      { id: 'site_reports', label: 'Site Reports', icon: 'bi-journal-text', to: '/site-diary', implemented: true },
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
      // Only show real destinations — never grayed-out / coming-soon placeholders.
      items: section.items.filter(
        (item) => allowedSet.has(item.id) && item.implemented && Boolean(item.to),
      ),
    }))
    .filter((section) => section.items.length > 0)
}
