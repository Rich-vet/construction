import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { ApiError } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { AuthLayout } from '../components/layout/AuthLayout'

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@example.com' },
  { label: 'Manager', email: 'manager@example.com' },
  { label: 'Engineer', email: 'engineer@example.com' },
  { label: 'Worker', email: 'worker@example.com' },
] as const

const DEMO_PASSWORD = 'Password123!'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string; resetSuccess?: boolean } | null)?.from ?? '/'
  const resetSuccess = Boolean(
    (location.state as { resetSuccess?: boolean } | null)?.resetSuccess,
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to log in. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your company account to open projects, sites, and reports."
    >
      {resetSuccess ? (
        <Alert variant="success" role="status">
          Password updated successfully. You can sign in now.
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <Form onSubmit={onSubmit} noValidate>
        <Form.Group className="mb-3" controlId="login-email">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="login-password">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />
        </Form.Group>

        <div className="d-flex justify-content-between align-items-center mb-4">
          <Link to="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" className="w-100" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </Form>

      <div className="auth-demo">
        <p className="auth-demo-label">Demo accounts</p>
        <div className="auth-demo-row" role="group" aria-label="Fill demo account">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="auth-demo-chip"
              disabled={submitting}
              onClick={() => fillDemo(account.email)}
            >
              {account.label}
            </button>
          ))}
        </div>
        <p className="auth-hint mb-0">
          Password for all demo users: <code>{DEMO_PASSWORD}</code>
        </p>
      </div>
    </AuthLayout>
  )
}
