export type FoundationCheck = {
  id: string
  title: string
  text: string
  status: string
}

export type FoundationResponse = {
  phase: string
  phase_label: string
  app_name: string
  company_name: string
  currency_code: string
  currency_symbol: string
  database_backend: string
  auth_status: string
  message: string
  checks: FoundationCheck[]
  next: {
    title: string
    text: string
    note: string
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    let message = 'Unable to reach the server.'
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function getFoundation(): Promise<FoundationResponse> {
  return request<FoundationResponse>('/api/foundation')
}

export function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/api/health')
}
