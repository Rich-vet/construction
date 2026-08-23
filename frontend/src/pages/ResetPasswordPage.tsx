import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { ApiError, resetPassword } from '../api/auth'
import { AuthLayout } from '../components/layout/AuthLayout'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialToken = useMemo(() => params.get('token') ?? '', [params])

  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!token.trim()) {
      setError('Reset token is required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Password confirmation does not match.')
      return
    }

    setSubmitting(true)
    try {
      await resetPassword(token.trim(), password)
      navigate('/login', { replace: true, state: { resetSuccess: true } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="Choose a new password for your account.">
      {error ? (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <Form onSubmit={onSubmit} noValidate>
        <Form.Group className="mb-3" controlId="reset-token">
          <Form.Label>Reset token</Form.Label>
          <Form.Control
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            disabled={submitting}
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="reset-password">
          <Form.Label>New password</Form.Label>
          <Form.Control
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />
          <Form.Text>At least 8 characters with upper, lower, and a number.</Form.Text>
        </Form.Group>
        <Form.Group className="mb-4" controlId="reset-confirm">
          <Form.Label>Confirm password</Form.Label>
          <Form.Control
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={submitting}
          />
        </Form.Group>
        <Button type="submit" variant="primary" className="w-100" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Updating…
            </>
          ) : (
            'Update password'
          )}
        </Button>
      </Form>

      <p className="mt-4 mb-0">
        <Link to="/login" className="auth-link">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
