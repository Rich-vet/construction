import { apiRequest } from './auth'

export type SeDashboard = {
  cards: {
    assigned_projects: number
    active_projects: number
    today_tasks: number
    open_tasks: number
    workers_on_site: number
    pending_material_requests: number
    equipment_on_site: number
    low_stock_materials: number
  }
  projects: Array<Record<string, unknown>>
  today_tasks: Array<Record<string, unknown>>
  attendance_today: Array<Record<string, unknown>>
  pending_material_requests: Array<Record<string, unknown>>
  low_stock_materials: Array<Record<string, unknown>>
  equipment_on_site: Array<Record<string, unknown>>
}

export type SiteMeta = {
  projects: Array<Record<string, unknown>>
  materials: Array<Record<string, unknown>>
  attendance_statuses: string[]
  transaction_types: string[]
  equipment_statuses: string[]
  equipment_conditions: string[]
  document_types: string[]
}

export function fetchSeDashboard() {
  return apiRequest<SeDashboard>('/api/site/dashboard')
}

export function fetchSiteMeta() {
  return apiRequest<SiteMeta>('/api/site/meta')
}

export function fetchProjectWorkers(projectId: number) {
  return apiRequest<{ items: Array<Record<string, unknown>> }>(
    `/api/site/projects/${projectId}/workers`,
  )
}

export function fetchAttendance(params?: { project_id?: number; date?: string }) {
  const q = new URLSearchParams()
  if (params?.project_id) q.set('project_id', String(params.project_id))
  if (params?.date) q.set('date', params.date)
  const suffix = q.toString() ? `?${q}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(`/api/site/attendance${suffix}`)
}

export function recordAttendance(payload: Record<string, unknown>) {
  return apiRequest('/api/site/attendance', { method: 'POST', body: payload, csrf: true })
}

export function fetchMaterialsStock() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/site/materials')
}

export function fetchMaterialTransactions(projectId?: number) {
  const suffix = projectId ? `?project_id=${projectId}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(
    `/api/site/material-transactions${suffix}`,
  )
}

export function recordMaterialUsage(payload: Record<string, unknown>) {
  return apiRequest('/api/site/material-usage', { method: 'POST', body: payload, csrf: true })
}

export function fetchEquipment() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/site/equipment')
}

export function fetchEquipmentAllocations(projectId?: number) {
  const suffix = projectId ? `?project_id=${projectId}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(
    `/api/site/equipment/allocations${suffix}`,
  )
}

export function allocateEquipment(payload: Record<string, unknown>) {
  return apiRequest('/api/site/equipment/allocate', { method: 'POST', body: payload, csrf: true })
}

export function returnEquipment(allocationId: number, payload?: Record<string, unknown>) {
  return apiRequest(`/api/site/equipment/allocations/${allocationId}/return`, {
    method: 'POST',
    body: payload ?? {},
    csrf: true,
  })
}

export function logMaintenance(payload: Record<string, unknown>) {
  return apiRequest('/api/site/equipment/maintenance', {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function fetchProgressUpdates(projectId?: number) {
  const suffix = projectId ? `?project_id=${projectId}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(
    `/api/site/progress-updates${suffix}`,
  )
}

export function createProgressUpdate(payload: Record<string, unknown>) {
  return apiRequest('/api/site/progress-updates', { method: 'POST', body: payload, csrf: true })
}

export function fetchSiteReports(projectId?: number) {
  const suffix = projectId ? `?project_id=${projectId}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(`/api/site/site-reports${suffix}`)
}

export function createSiteReport(payload: Record<string, unknown>) {
  return apiRequest('/api/site/site-reports', { method: 'POST', body: payload, csrf: true })
}

export function fetchDocuments(projectId?: number) {
  const suffix = projectId ? `?project_id=${projectId}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(`/api/site/documents${suffix}`)
}

export function uploadDocument(formData: FormData) {
  return apiRequest<{ message: string; document: Record<string, unknown> }>('/api/site/documents', {
    method: 'POST',
    formData,
    csrf: true,
  })
}
