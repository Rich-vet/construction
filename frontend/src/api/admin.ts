import { apiRequest, type AuthUser } from './auth'

export type Paginated<T> = {
  items: T[]
  page: number
  per_page: number
  total: number
  pages: number
}

export type CompanyProfile = {
  id: number
  name: string
  description: string | null
  phone: string | null
  email: string | null
  address: string | null
  registration_info: string | null
  logo_url: string | null
  updated_at: string | null
}

export type ActivityItem = {
  id: number
  actor_id: number | null
  actor_name: string
  action: string
  entity_type: string | null
  entity_id: number | null
  details: string | null
  created_at: string | null
}

export type NotificationItem = {
  id: number
  user_id: number
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string | null
}

export type AdminDashboard = {
  cards: {
    total_users: number
    active_users: number
    total_projects: number
    active_projects: number
    completed_projects: number
    employees: number
    contractors: number
    low_stock_materials: number
  }
  recent_activity: ActivityItem[]
  recent_projects: Array<{
    id: number
    name: string
    client_name: string | null
    status: string
    progress: number
    created_at: string | null
  }>
  notifications: NotificationItem[]
}

export function fetchAdminDashboard() {
  return apiRequest<AdminDashboard>('/api/admin/dashboard')
}

export function fetchSettings() {
  return apiRequest<{
    app_name: string
    currency_code: string
    currency_symbol: string
    company: CompanyProfile
  }>('/api/admin/settings')
}

export function fetchRoles() {
  return apiRequest<{ items: Array<{ id: number; name: string; description: string | null }> }>(
    '/api/admin/roles',
  )
}

export function fetchUsers(params: {
  search?: string
  role?: string
  status?: string
  page?: number
}) {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.role) q.set('role', params.role)
  if (params.status) q.set('status', params.status)
  q.set('page', String(params.page ?? 1))
  return apiRequest<Paginated<AuthUser>>(`/api/admin/users?${q.toString()}`)
}

export function fetchUser(id: number) {
  return apiRequest<{ user: AuthUser }>(`/api/admin/users/${id}`)
}

export function createUser(payload: Record<string, unknown>) {
  return apiRequest<{ message: string; user: AuthUser }>('/api/admin/users', {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function updateUser(id: number, payload: Record<string, unknown>) {
  return apiRequest<{ message: string; user: AuthUser }>(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: payload,
    csrf: true,
  })
}

export function activateUser(id: number) {
  return apiRequest<{ message: string; user: AuthUser }>(`/api/admin/users/${id}/activate`, {
    method: 'POST',
    csrf: true,
  })
}

export function deactivateUser(id: number) {
  return apiRequest<{ message: string; user: AuthUser }>(`/api/admin/users/${id}/deactivate`, {
    method: 'POST',
    csrf: true,
  })
}

export function fetchCompany() {
  return apiRequest<{ company: CompanyProfile }>('/api/admin/company')
}

export function updateCompany(form: FormData) {
  return apiRequest<{ message: string; company: CompanyProfile }>('/api/admin/company', {
    method: 'PUT',
    formData: form,
    csrf: true,
  })
}

export function fetchActivityLogs(page = 1) {
  return apiRequest<Paginated<ActivityItem>>(`/api/admin/activity-logs?page=${page}`)
}

export function fetchNotifications(page = 1) {
  return apiRequest<Paginated<NotificationItem> & { unread_count: number }>(
    `/api/notifications?page=${page}`,
  )
}

export function markNotificationRead(id: number) {
  return apiRequest<{ message: string; notification: NotificationItem }>(
    `/api/notifications/${id}/read`,
    { method: 'POST', csrf: true },
  )
}

export type EmployeeRecord = {
  id: number
  full_name: string
  employee_code: string | null
  phone: string | null
  email: string | null
  position: string | null
  skills: string | null
  status: string
}

export type ContractorRecord = {
  id: number
  name: string
  specialty: string | null
  phone: string | null
  email: string | null
  status: string
  user_id: number | null
  user_name: string | null
}

export function fetchEmployees(params: { search?: string; status?: string; page?: number } = {}) {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.status) q.set('status', params.status)
  q.set('page', String(params.page ?? 1))
  return apiRequest<Paginated<EmployeeRecord>>(`/api/admin/employees?${q.toString()}`)
}

export function fetchEmployeeMeta() {
  return apiRequest<{ statuses: string[] }>('/api/admin/employees/meta')
}

export function fetchEmployee(id: number) {
  return apiRequest<{ employee: EmployeeRecord }>(`/api/admin/employees/${id}`)
}

export function createEmployee(payload: Record<string, unknown>) {
  return apiRequest<{ message: string; employee: EmployeeRecord }>('/api/admin/employees', {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function updateEmployee(id: number, payload: Record<string, unknown>) {
  return apiRequest<{ message: string; employee: EmployeeRecord }>(`/api/admin/employees/${id}`, {
    method: 'PUT',
    body: payload,
    csrf: true,
  })
}

export function fetchContractors(params: { search?: string; status?: string; page?: number } = {}) {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.status) q.set('status', params.status)
  q.set('page', String(params.page ?? 1))
  return apiRequest<Paginated<ContractorRecord>>(`/api/admin/contractors?${q.toString()}`)
}

export function fetchContractorMeta() {
  return apiRequest<{
    statuses: string[]
    linkable_users: Array<{ id: number; full_name: string; email: string; role: string }>
  }>('/api/admin/contractors/meta')
}

export function fetchContractor(id: number) {
  return apiRequest<{ contractor: ContractorRecord }>(`/api/admin/contractors/${id}`)
}

export function createContractor(payload: Record<string, unknown>) {
  return apiRequest<{ message: string; contractor: ContractorRecord }>('/api/admin/contractors', {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function updateContractor(id: number, payload: Record<string, unknown>) {
  return apiRequest<{ message: string; contractor: ContractorRecord }>(
    `/api/admin/contractors/${id}`,
    { method: 'PUT', body: payload, csrf: true },
  )
}
