import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchMyAttendance } from '../../api/worker'

export function MyAttendancePage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMyAttendance()
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load attendance.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Attendance" title="My attendance" phaseLabel="Worker">
      <p className="text-muted">
        Attendance is recorded by your site engineer. You can view your own records here.
      </p>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No attendance has been recorded for you yet.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Status</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={String(a.id)}>
                  <td>{String(a.attendance_date)}</td>
                  <td>{String(a.project_name)}</td>
                  <td>{String(a.status)}</td>
                  <td>{String(a.check_in ?? '—')}</td>
                  <td>{String(a.check_out ?? '—')}</td>
                  <td>{String(a.notes ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
