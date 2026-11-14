import { apiRequest } from './auth'

export type WorkerDashboard = {
  cards: {
    assigned_projects: number
    my_tasks: number
    due_soon: number
    overdue: number
    completed: number
    unread_notifications: number
  }
  projects: Array<Record<string, unknown>>
  due_soon_tasks: Array<Record<string, unknown>>
  overdue_tasks: Array<Record<string, unknown>>
  open_tasks: Array<Record<string, unknown>>
  completed_tasks: Array<Record<string, unknown>>
  recent_notifications: Array<Record<string, unknown>>
  recent_attendance: Array<Record<string, unknown>>
}

export function fetchWorkerDashboard() {
  return apiRequest<WorkerDashboard>('/api/worker/dashboard')
}

export function fetchMyProjects() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/worker/projects')
}

export function fetchMyTasks(status?: string) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiRequest<{ items: Array<Record<string, unknown>> }>(`/api/worker/tasks${suffix}`)
}

export function fetchMyTask(taskId: number) {
  return apiRequest<{
    task: Record<string, unknown>
    comments: Array<Record<string, unknown>>
    evidence: Array<Record<string, unknown>>
    progress_reports?: Array<Record<string, unknown>>
    inspections?: Array<Record<string, unknown>>
    can_update: boolean
    allowed_statuses: string[]
  }>(`/api/worker/tasks/${taskId}`)
}

export function updateMyTaskStatus(taskId: number, status: string) {
  return apiRequest(`/api/worker/tasks/${taskId}/status`, {
    method: 'PUT',
    body: { status },
    csrf: true,
  })
}

export function addTaskProgress(taskId: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/worker/tasks/${taskId}/progress`, {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function submitTaskForInspection(taskId: number, payload: Record<string, unknown>) {
  return apiRequest(`/api/worker/tasks/${taskId}/submit`, {
    method: 'POST',
    body: payload,
    csrf: true,
  })
}

export function addMyTaskComment(taskId: number, body: string) {
  return apiRequest(`/api/worker/tasks/${taskId}/comments`, {
    method: 'POST',
    body: { body },
    csrf: true,
  })
}

export function uploadTaskEvidence(taskId: number, formData: FormData) {
  return apiRequest(`/api/worker/tasks/${taskId}/evidence`, {
    method: 'POST',
    formData,
    csrf: true,
  })
}

export function fetchMyAttendance() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/worker/attendance')
}

export function fetchMyDocuments() {
  return apiRequest<{ items: Array<Record<string, unknown>> }>('/api/worker/documents')
}
