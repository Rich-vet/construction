import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchMyDocuments } from '../../api/worker'

export function WorkerDocumentsPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMyDocuments()
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load documents.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Documents" title="My uploads" phaseLabel="Worker">
      <p className="text-muted">Work evidence and files you uploaded from your tasks.</p>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No documents uploaded yet. Open a task to attach work evidence.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Project</th>
                <th>Task</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={String(d.id)}>
                  <td>{String(d.name)}</td>
                  <td>{String(d.document_type)}</td>
                  <td>{String(d.project_name)}</td>
                  <td>{String(d.task_name ?? '—')}</td>
                  <td>
                    <a
                      className="btn btn-sm btn-outline-secondary"
                      href={String(d.download_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
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
