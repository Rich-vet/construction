const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export type AuthUser = {
  id: number
  full_name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  created_at: string | null
}

export type MeResponse = {
  authenticated: boolean
  user: AuthUser | null
  navigation?: string[]
}

export type LoginResponse = {
  message: string
  user: AuthUser
  navigation: string[]
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let csrfToken: string | null = null

async function ensureCsrf(): Promise<string | null> {
  // CSRF disabled in some environments; still attempt fetch for cookie sync.
  const response = await fetch(`${API_BASE}/api/auth/csrf`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return csrfToken
  const data = (await response.json()) as { csrf_token?: string }
  csrfToken = data.csrf_token ?? null
  return csrfToken
}

type RequestOptions = {
  method?: string
  body?: unknown
  csrf?: boolean
  formData?: FormData
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  if (options.csrf || (method !== 'GET' && method !== 'HEAD')) {
    const token = csrfToken ?? (await ensureCsrf())
    if (token) headers['X-CSRFToken'] = token
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body,
  })

  if (!response.ok) {
    let message = 'Unable to complete the request.'
    let code: string | undefined
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      if (body.message) message = body.message
      code = body.error
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function fetchCsrf(): Promise<string | null> {
  return ensureCsrf()
}

export function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/api/auth/me')
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    csrf: true,
  })
}

export function logout(): Promise<{ message: string }> {
  // Always refresh CSRF before mutating auth — stale tokens are a common logout failure.
  return ensureCsrf().then(() =>
    apiRequest<{ message: string }>('/api/auth/logout', {
      method: 'POST',
      csrf: true,
    }),
  )
}

export function forgotPassword(email: string): Promise<{
  message: string
  dev_reset_token?: string
  dev_reset_path?: string
}> {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
    csrf: true,
  })
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password },
    csrf: true,
  })
}
