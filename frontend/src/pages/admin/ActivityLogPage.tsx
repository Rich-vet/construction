import { useEffect, useState } from 'react'
import { Alert, Button, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchActivityLogs, type ActivityItem } from '../../api/admin'

export function ActivityLogPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = (nextPage = 1) => {
    setLoading(true)
    setError(null)
    fetchActivityLogs(nextPage)
      .then((data) => {
        setItems(data.items)
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
  }, [])

  return (
    <AppShell breadcrumb="System / Activity Log" title="Activity log" phaseLabel="Admin">
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
                    <td className="small text-muted">{item.created_at}</td>
                    <td>{item.actor_name}</td>
                    <td>{item.action}</td>
                    <td>{item.details ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="pager">
            <span className="text-muted">{total} entries</span>
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
