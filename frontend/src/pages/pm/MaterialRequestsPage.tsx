import { useEffect, useState } from 'react'
import { Alert, Button, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchMaterialRequests, reviewMaterialRequest } from '../../api/projects'

export function MaterialRequestsPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchMaterialRequests()
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load requests.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const review = async (id: number, status: string) => {
    setError(null)
    try {
      await reviewMaterialRequest(id, status)
      setMessage(`Request ${status.toLowerCase()}.`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to review request.')
    }
  }

  return (
    <AppShell breadcrumb="Procurement / Material Requests" title="Material requests" phaseLabel="PM">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No material requests for your projects.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Project</th>
                <th>Material</th>
                <th>Qty</th>
                <th>Requested by</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={String(r.id)}>
                  <td>{String(r.project_name)}</td>
                  <td>{String(r.material_name)}</td>
                  <td>{String(r.quantity)}</td>
                  <td>{String(r.requested_by_name)}</td>
                  <td>{String(r.status)}</td>
                  <td className="table-actions">
                    {r.status === 'Pending' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline-success"
                          onClick={() => void review(Number(r.id), 'Approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => void review(Number(r.id), 'Rejected')}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
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
