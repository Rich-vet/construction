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
  can_manage_catalog?: boolean
  can_operate_site?: boolean
  can_approve_equipment?: boolean
}

export type EquipmentAllocationSummary = {
  id: number
  project_id: number
  project_name: string | null
  quantity: number
  allocated_at: string | null
  notes: string | null
  returned_at?: string | null
  allocation_state?: string | null
  equipment_id?: number
  equipment_name?: string | null
}

export type EquipmentItem = {
  id: number
  name: string
  asset_id: string
  equipment_type: string | null
  quantity: number
  allocated_quantity: number
  available_quantity: number
  condition: string
  status: string
  description: string | null
  current_project_id: number | null
  current_project_name: string | null
  open_allocations: EquipmentAllocationSummary[]
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
  return apiRequest<{ items: EquipmentItem[] }>('/api/site/equipment')
}

export function fetchEquipmentAllocations(projectId?: number) {
  const suffix = projectId ? `?project_id=${projectId}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(
    `/api/site/equipment/allocations${suffix}`,
  )
}

export function fetchEquipmentRequests() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/site/equipment/requests')
}

export function requestEquipment(payload: Record<string, unknown>) {
  return apiRequest('/api/site/equipment/requests', { method: 'POST', body: payload, csrf: true })
}

export function reviewEquipmentRequest(id: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/site/equipment/requests/${id}/review`, {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function issueEquipmentRequest(id: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/site/equipment/requests/${id}/issue`, {
    method: 'POST',
    body: payload,
    csrf: true,
  })
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

export function fetchMaintenance(equipmentId?: number) {
  const suffix = equipmentId ? `?equipment_id=${equipmentId}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(
    `/api/site/equipment/maintenance${suffix}`,
  )
}

export function createMaterial(payload: Record<string, unknown>) {
  return apiRequest('/api/site/materials', { method: 'POST', body: payload, csrf: true })
}

export function updateMaterial(id: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/site/materials/${id}`, { method: 'PUT', body: payload, csrf: true })
}

export function createEquipment(payload: Record<string, unknown>) {
  return apiRequest('/api/site/equipment', { method: 'POST', body: payload, csrf: true })
}

export function updateEquipment(id: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/site/equipment/${id}`, { method: 'PUT', body: payload, csrf: true })
}

export function completeEquipmentMaintenance(id: number, release = false) {
  return apiRequest(`/api/site/equipment/${id}/complete-maintenance`, {
    method: 'POST',
    body: { release },
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

export function createSiteDiary(payload: Record<string, unknown>) {
  return apiRequest<{
    message: string
    report: Record<string, unknown>
    progress_update: Record<string, unknown>
  }>('/api/site/site-diary', { method: 'POST', body: payload, csrf: true })
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
