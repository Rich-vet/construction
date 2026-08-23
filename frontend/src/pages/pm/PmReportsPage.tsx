import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchPmReportSummary } from '../../api/projects'

export function PmReportsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPmReportSummary()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load report.'),
      )
      .finally(() => setLoading(false))
  }, [])

  const cards = (data?.cards as Record<string, number>) || {}
  const projects = (data?.projects as Array<Record<string, unknown>>) || []

  return (
    <AppShell breadcrumb="Reports" title="Project reports" phaseLabel="PM">
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {data ? (
        <div className="panel-card report-print">
          <p className="text-muted">Generated {String(data.generated_at)}</p>
          <div className="status-grid admin-stats mb-4">
            {Object.entries(cards).map(([key, value]) => (
              <article key={key} className="status-card">
                <h3 className="status-card__title text-capitalize">{key.replaceAll('_', ' ')}</h3>
                <p className="stat-value">{value}</p>
              </article>
            ))}
          </div>
          <Table responsive className="mb-0">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Budget</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={String(p.id)}>
                  <td>{String(p.name)}</td>
                  <td>{String(p.status)}</td>
                  <td>{Number(p.progress)}%</td>
                  <td>K{Number(p.budget).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <button type="button" className="btn btn-outline-secondary mt-3" onClick={() => window.print()}>
            Print report
          </button>
        </div>
      ) : null}
    </AppShell>
  )
}
