import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { ApiError } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { AuthLayout } from '../components/layout/AuthLayout'

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
      subtitle="Access the Construction Company Management System."
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

      <p className="auth-hint mt-4 mb-0">
        Demo accounts use password <code>Password123!</code>
      </p>
    </AuthLayout>
  )
}
