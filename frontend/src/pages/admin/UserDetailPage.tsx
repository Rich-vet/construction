import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Spinner } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError, type AuthUser } from '../../api/auth'
import { activateUser, deactivateUser, fetchUser } from '../../api/admin'

export function UserDetailPage() {
  const { id } = useParams()
  const userId = Number(id)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    fetchUser(userId)
      .then((data) => setUser(data.user))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load user.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const toggle = async () => {
    if (!user) return
    if (
      !window.confirm(
        user.is_active ? `Deactivate ${user.full_name}?` : `Activate ${user.full_name}?`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = user.is_active
        ? await deactivateUser(user.id)
        : await activateUser(user.id)
      setMessage(result.message)
      setUser(result.user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell breadcrumb="System / Users / Details" title="User details" phaseLabel="Admin">
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      {user ? (
        <div className="detail-panel">
          <div className="detail-panel__actions">
            <Link to={`/users/${user.id}/edit`} className="btn btn-primary">
              Edit
            </Link>
            <Button
              variant={user.is_active ? 'outline-danger' : 'outline-success'}
              onClick={() => void toggle()}
              disabled={busy}
            >
              {user.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Link to="/users" className="btn btn-outline-secondary">
              Back to users
            </Link>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Full name</dt>
              <dd>{user.full_name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{user.phone || '—'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user.role}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Badge bg={user.is_active ? 'success' : 'secondary'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{user.created_at ?? '—'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </AppShell>
  )
}
