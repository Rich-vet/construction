import { useEffect, useState } from 'react'
import { Alert, Badge, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchMyTasks } from '../../api/worker'

export function MyTasksPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = (nextStatus = status) => {
    setLoading(true)
    fetchMyTasks(nextStatus || undefined)
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load tasks.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppShell breadcrumb="Tasks" title="My tasks" phaseLabel="Worker">
      <div className="page-toolbar">
        <Form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <Form.Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              load(e.target.value)
            }}
          >
            <option value="">All statuses</option>
            {['Pending', 'In Progress', 'Completed', 'Cancelled'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Form.Select>
        </Form>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No tasks are assigned to you.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={String(t.id)}>
                  <td>{String(t.name)}</td>
                  <td>{String(t.project_name)}</td>
                  <td>{String(t.due_date ?? '—')}</td>
                  <td>{String(t.priority)}</td>
                  <td>
                    <Badge bg="secondary">{String(t.status)}</Badge>
                  </td>
                  <td>
                    <Link to={`/tasks/${t.id}`} className="btn btn-sm btn-outline-secondary">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
