import { useEffect, useState } from 'react'
import { Alert, Badge, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchMyProjects } from '../../api/worker'

export function WorkerProjectsPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMyProjects()
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load projects.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Projects" title="My projects" phaseLabel="Worker">
      <p className="text-muted">Projects where you are a team member. View only.</p>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>You are not assigned to any projects yet.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Location</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={String(p.id)}>
                  <td>{String(p.name)}</td>
                  <td>{String(p.client_name)}</td>
                  <td>{String(p.location)}</td>
                  <td>
                    <Badge bg="secondary">{String(p.status)}</Badge>
                  </td>
                  <td>{String(p.progress)}%</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
