import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError, type AuthUser } from '../../api/auth'
import {
  activateUser,
  deactivateUser,
  fetchRoles,
  fetchUsers,
} from '../../api/admin'

export function UsersListPage() {
  const [items, setItems] = useState<AuthUser[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = (nextPage = page) => {
    setLoading(true)
    setError(null)
    fetchUsers({ search, role, status, page: nextPage })
      .then((data) => {
        setItems(data.items)
        setPage(data.page)
        setPages(data.pages)
        setTotal(data.total)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load users.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRoles()
      .then((data) => setRoles(data.items.map((r) => r.name)))
      .catch(() => undefined)
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFilter = (event: React.FormEvent) => {
    event.preventDefault()
    load(1)
  }

  const toggleActive = async (user: AuthUser) => {
    setBusyId(user.id)
    setMessage(null)
    setError(null)
    try {
      const result = user.is_active
        ? await deactivateUser(user.id)
        : await activateUser(user.id)
      setMessage(result.message)
      load(page)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update user status.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell breadcrumb="System / Users" title="Users" phaseLabel="Admin">
      <div className="page-toolbar">
        <Form className="filter-bar" onSubmit={onFilter}>
          <Form.Control
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
          <Form.Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {roles.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Form.Select>
          <Form.Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Form.Select>
          <Button type="submit" variant="primary">
            Filter
          </Button>
        </Form>
        <Link to="/users/create" className="btn btn-primary">
          Add user
        </Link>
      </div>

      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No users match your filters.</p>
          <Link to="/users/create" className="btn btn-primary">
            Create user
          </Link>
        </div>
      ) : (
        <>
          <div className="table-panel">
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id}>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <Badge bg={user.is_active ? 'success' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="small text-muted">{user.created_at ?? '—'}</td>
                    <td className="table-actions">
                      <Link to={`/users/${user.id}`} className="btn btn-sm btn-outline-secondary">
                        View
                      </Link>
                      <Link
                        to={`/users/${user.id}/edit`}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Edit
                      </Link>
                      <Button
                        size="sm"
                        variant={user.is_active ? 'outline-danger' : 'outline-success'}
                        disabled={busyId === user.id}
                        onClick={() => {
                          if (
                            window.confirm(
                              user.is_active
                                ? `Deactivate ${user.full_name}?`
                                : `Activate ${user.full_name}?`,
                            )
                          ) {
                            void toggleActive(user)
                          }
                        }}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="pager">
            <span className="text-muted">
              {total} user{total === 1 ? '' : 's'}
            </span>
            <div className="pager-controls">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {Math.max(pages, 1)}
              </span>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={page >= pages}
                onClick={() => load(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
