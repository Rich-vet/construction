import { useEffect, useState } from 'react'
import { Alert, Button, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/auth'
import { fetchActivityLogs, type ActivityItem } from '../../api/admin'
import { fetchProjectActivityLogs } from '../../api/projects'

export function ActivityLogPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = user?.role === 'Administrator'

  const load = (nextPage = 1) => {
    setLoading(true)
    setError(null)
    const loader = isAdmin
      ? fetchActivityLogs(nextPage)
      : fetchProjectActivityLogs(nextPage)
    loader
      .then((data) => {
        setItems(data.items as ActivityItem[])
        setPage(data.page)
        setPages(data.pages)
        setTotal(data.total)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load activity log.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  return (
    <AppShell
      breadcrumb="System / Activity Log"
      title="Activity log"
      phaseLabel={isAdmin ? 'Admin' : 'PM'}
    >
      {!isAdmin ? (
        <p className="text-muted">Showing activity linked to your projects.</p>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No activity has been recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="table-panel">
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td>
                    <td>{item.actor_name}</td>
                    <td>{item.action}</td>
                    <td>{item.details ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="text-muted small">
              Page {page} of {pages || 1} · {total} entries
            </span>
            <div className="btn-group">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                Previous
              </Button>
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
