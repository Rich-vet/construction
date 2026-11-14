import { apiRequest } from './auth'

export type ProjectSummary = {
  id: number
  name: string
  client_name: string
  location: string
  status: string
  progress: number
  budget: number
  start_date: string | null
  expected_completion: string | null
  project_manager_id: number
  project_manager_name: string | null
  site_engineer_id: number | null
  site_engineer_name: string | null
}

export type PmDashboard = {
  cards: {
    my_projects: number
    active_projects: number
    average_progress: number
    pending_material_requests: number
    budget_alerts: number
  }
  status_breakdown: Record<string, number>
  upcoming_deadlines: ProjectSummary[]
  pending_material_requests: Array<Record<string, unknown>>
  budget_alerts: Array<Record<string, unknown>>
  recent_expenses: Array<Record<string, unknown>>
  recent_site_updates: Array<Record<string, unknown>>
  projects: ProjectSummary[]
}

export function fetchPmDashboard() {
  return apiRequest<PmDashboard>('/api/projects/dashboard')
}

export function fetchProjectMeta() {
  return apiRequest<{
    assignable_users: Array<{ id: number; full_name: string; email: string; role: string }>
    materials: Array<Record<string, unknown>>
    statuses: string[]
    budget_categories: string[]
    task_priorities: string[]
    task_statuses: string[]
  }>('/api/projects/meta')
}

export function fetchProjects(params?: { search?: string; status?: string }) {
  const q = new URLSearchParams()
  if (params?.search) q.set('search', params.search)
  if (params?.status) q.set('status', params.status)
  const suffix = q.toString() ? `?${q}` : ''
  return apiRequest<{ items: ProjectSummary[] }>(`/api/projects${suffix}`)
}

export function createProject(payload: Record<string, unknown>) {
  return apiRequest<{ message: string; project: ProjectSummary }>('/api/projects', {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function updateProject(id: number, payload: Record<string, unknown>) {
  return apiRequest<{ message: string; project: ProjectSummary }>(`/api/projects/${id}`, {
    method: 'PUT',
    body: payload,
    csrf: true,
  })
}

export function fetchProjectWorkspace(id: number) {
  return apiRequest<Record<string, unknown>>(`/api/projects/${id}`)
}

export function createTask(payload: Record<string, unknown>) {
  return apiRequest('/api/projects/tasks', { method: 'POST', body: payload, csrf: true })
}

export function updateTask(id: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/projects/tasks/${id}`, { method: 'PUT', body: payload, csrf: true })
}

export function requestTaskRework(id: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/projects/tasks/${id}/rework`, {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function verifyTask(id: number) {
  return apiRequest(`/api/projects/tasks/${id}/verify`, { method: 'POST', csrf: true })
}

export function createMilestone(payload: Record<string, unknown>) {
  return apiRequest('/api/projects/milestones', { method: 'POST', body: payload, csrf: true })
}

export function completeMilestone(id: number) {
  return apiRequest(`/api/projects/milestones/${id}/complete`, { method: 'POST', csrf: true })
}

export function addMember(projectId: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/projects/${projectId}/members`, {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function removeMember(memberId: number) {
  return apiRequest(`/api/projects/members/${memberId}`, { method: 'DELETE', csrf: true })
}

export function upsertBudget(projectId: number, category: string, amount: number) {
  return apiRequest(`/api/projects/${projectId}/budgets/${category}`, {
    method: 'PUT',
    body: { amount },
    csrf: true,
  })
}

export function reviewBudgetRevision(
  projectId: number,
  category: string,
  status: 'Approved' | 'Rejected',
) {
  return apiRequest(`/api/projects/${projectId}/budgets/${category}/review`, {
    method: 'POST',
    body: { status },
    csrf: true,
  })
}

export function createExpense(payload: Record<string, unknown>) {
  return apiRequest('/api/projects/expenses', { method: 'POST', body: payload, csrf: true })
}

export function reviewExpense(id: number, status: 'Approved' | 'Rejected', notes?: string) {
  return apiRequest(`/api/projects/expenses/${id}/review`, {
    method: 'POST',
    body: { status, notes },
    csrf: true,
  })
}

export function fetchMaterialRequests() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/projects/material-requests')
}

export function createMaterialRequest(payload: Record<string, unknown>) {
  return apiRequest('/api/projects/material-requests', {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function reviewMaterialRequest(id: number, status: string, notes?: string) {
  return apiRequest(`/api/projects/material-requests/${id}/review`, {
    method: 'POST',
    body: { status, notes },
    csrf: true,
  })
}

export function createQuotation(payload: Record<string, unknown>) {
  return apiRequest('/api/projects/quotations', { method: 'POST', body: payload, csrf: true })
}

export function selectQuotation(id: number) {
  return apiRequest(`/api/projects/quotations/${id}/select`, { method: 'POST', csrf: true })
}

export function createPurchaseOrder(payload: Record<string, unknown>) {
  return apiRequest('/api/projects/purchase-orders', {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function createDelivery(payload: Record<string, unknown>) {
  return apiRequest('/api/projects/deliveries', { method: 'POST', body: payload, csrf: true })
}

export function fetchQuotations() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/projects/quotations')
}

export function fetchPurchaseOrders() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/projects/purchase-orders')
}

export function fetchDeliveries() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/projects/deliveries')
}

export function fetchProjectActivityLogs(page = 1) {
  return apiRequest<{
    items: Array<{
      id: number
      actor_name: string
      action: string
      details: string | null
      created_at: string | null
    }>
    page: number
    pages: number
    total: number
  }>(`/api/projects/activity-logs?page=${page}`)
}

export function fetchPmReportSummary() {
  return apiRequest<Record<string, unknown>>('/api/projects/reports/summary')
}
