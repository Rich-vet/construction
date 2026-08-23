import { apiRequest, fetchCsrf } from './auth'

export type ReportMeta = {
  types: Array<{ id: string; title: string; description: string }>
  projects: Array<{ id: number; name: string }>
  currency: string
  currency_symbol: string
}

export type ReportPayload = {
  report_id: string
  title: string
  description: string
  generated_at: string
  filters: {
    project_id: number | null
    date_from: string | null
    date_to: string | null
  }
  summary: Record<string, unknown>
  columns: string[]
  rows: string[][]
  row_count: number
}

export function fetchReportMeta() {
  return apiRequest<ReportMeta>('/api/reports/meta')
}

export function fetchReport(
  reportId: string,
  params?: { project_id?: number; from?: string; to?: string },
) {
  const q = new URLSearchParams()
  if (params?.project_id) q.set('project_id', String(params.project_id))
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  const suffix = q.toString() ? `?${q}` : ''
  return apiRequest<ReportPayload>(`/api/reports/${reportId}${suffix}`)
}

export async function downloadReportPdf(
  reportId: string,
  params?: { project_id?: number; from?: string; to?: string },
) {
  await fetchCsrf()
  const q = new URLSearchParams()
  if (params?.project_id) q.set('project_id', String(params.project_id))
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  const suffix = q.toString() ? `?${q}` : ''
  const response = await fetch(`/api/reports/${reportId}/pdf${suffix}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/pdf' },
  })
  if (!response.ok) {
    let message = 'Unable to download PDF.'
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ccms-${reportId}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
