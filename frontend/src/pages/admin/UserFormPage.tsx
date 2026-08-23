import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { createUser, fetchRoles, fetchUser, updateUser } from '../../api/admin'

type Mode = 'create' | 'edit'

export function UserFormPage({ mode }: { mode: Mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = id ? Number(id) : null

  const [roles, setRoles] = useState<string[]>([])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('Project Manager')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(mode === 'edit')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRoles()
      .then((data) => setRoles(data.items.map((r) => r.name)))
      .catch(() => undefined)

    if (mode === 'edit' && userId) {
      fetchUser(userId)
        .then(({ user }) => {
          setFullName(user.full_name)
          setEmail(user.email)
          setPhone(user.phone ?? '')
          setRole(user.role)
          setIsActive(user.is_active)
        })
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : 'Unable to load user.'),
        )
        .finally(() => setLoading(false))
    }
  }, [mode, userId])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!fullName.trim() || !email.trim() || !role) {
      setError('Full name, email, and role are required.')
      return
    }
    if (mode === 'create' && !password) {
      setError('Password is required for new users.')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role,
        is_active: isActive,
      }
      if (password) payload.password = password

      if (mode === 'create') {
        const result = await createUser(payload)
        navigate(`/users/${result.user.id}`)
      } else if (userId) {
        await updateUser(userId, payload)
        navigate(`/users/${userId}`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save user.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell
      breadcrumb={mode === 'create' ? 'System / Users / Create' : 'System / Users / Edit'}
      title={mode === 'create' ? 'Create user' : 'Edit user'}
      phaseLabel="Admin"
    >
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="form-panel">
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Form onSubmit={onSubmit} noValidate>
            <Form.Group className="mb-3" controlId="full-name">
              <Form.Label>Full name *</Form.Label>
              <Form.Control
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={submitting}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="phone">
              <Form.Label>Phone</Form.Label>
              <Form.Control
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="role">
              <Form.Label>Role *</Form.Label>
              <Form.Select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                disabled={submitting}
              >
                {roles.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="password">
              <Form.Label>
                {mode === 'create' ? 'Password *' : 'Password (leave blank to keep current)'}
              </Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                autoComplete="new-password"
              />
              <Form.Text>At least 8 characters with upper, lower, and a number.</Form.Text>
            </Form.Group>
            <Form.Check
              className="mb-4"
              type="switch"
              id="is-active"
              label="Account active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={submitting}
            />
            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
              <Link to="/users" className="btn btn-outline-secondary">
                Cancel
              </Link>
            </div>
          </Form>
        </div>
      )}
    </AppShell>
  )
}
