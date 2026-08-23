import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { ApiError, forgotPassword } from '../api/auth'
import { AuthLayout } from '../components/layout/AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [devToken, setDevToken] = useState<string | null>(null)
  const [devPath, setDevPath] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setDevToken(null)
    setDevPath(null)

    if (!email.trim()) {
      setError('Enter the email address for your account.')
      return
    }

    setSubmitting(true)
    try {
      const result = await forgotPassword(email.trim())
      setMessage(result.message)
      if (result.dev_reset_token) setDevToken(result.dev_reset_token)
      if (result.dev_reset_path) setDevPath(result.dev_reset_path)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to start password reset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Development mode returns a reset token instead of sending email."
    >
      {error ? (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" role="status">
          {message}
        </Alert>
      ) : null}
      {devToken ? (
        <Alert variant="warning">
          <strong>Dev reset token</strong>
          <div className="small text-break mt-1">{devToken}</div>
          {devPath ? (
            <div className="mt-2">
              <Link to={devPath}>Continue to reset password</Link>
            </div>
          ) : null}
        </Alert>
      ) : null}

      <Form onSubmit={onSubmit} noValidate>
        <Form.Group className="mb-4" controlId="forgot-email">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </Form.Group>
        <Button type="submit" variant="primary" className="w-100" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Submitting…
            </>
          ) : (
            'Create reset token'
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
