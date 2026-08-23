import { useEffect, useState } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../components/layout/AppShell'
import { ApiError } from '../api/auth'
import {
  downloadReportPdf,
  fetchReport,
  fetchReportMeta,
  type ReportMeta,
  type ReportPayload,
} from '../api/reports'

export function ReportsPage() {
  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [reportId, setReportId] = useState('project_progress')
  const [projectId, setProjectId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [report, setReport] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchReportMeta()
      .then((m) => {
        setMeta(m)
        if (m.types[0]) setReportId(m.types[0].id)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load reports.'),
      )
      .finally(() => setLoading(false))
  }, [])

  const params = () => ({
    project_id: projectId ? Number(projectId) : undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  })

  const run = async () => {
    setError(null)
    setMessage(null)
    setRunning(true)
    try {
      const data = await fetchReport(reportId, params())
      setReport(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to generate report.')
      setReport(null)
    } finally {
      setRunning(false)
    }
  }

  const onPdf = async () => {
    setError(null)
    setMessage(null)
    try {
      await downloadReportPdf(reportId, params())
      setMessage('PDF downloaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download PDF.')
    }
  }

  const selectedType = meta?.types.find((t) => t.id === reportId)

  return (
    <AppShell breadcrumb="Reports" title="Reports dashboard" phaseLabel="Reports">
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      {meta ? (
        <>
          <section className="panel-card mb-4 no-print">
            <h2 className="section-title">Choose report</h2>
            <div className="report-type-grid mb-3">
              {meta.types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`report-type-card${reportId === t.id ? ' is-active' : ''}`}
                  onClick={() => setReportId(t.id)}
                >
                  <strong>{t.title}</strong>
                  <span>{t.description}</span>
                </button>
              ))}
            </div>
            <Form
              className="filter-bar"
              onSubmit={(e) => {
                e.preventDefault()
                void run()
              }}
            >
              <Form.Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">All accessible projects</option>
                {meta.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Form.Select>
              <Form.Control
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
              />
              <Form.Control
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
              />
              <Button type="submit" disabled={running}>
                {running ? 'Generating…' : 'Generate'}
              </Button>
            </Form>
            {selectedType ? <p className="text-muted mb-0 mt-2">{selectedType.description}</p> : null}
          </section>

          {report ? (
            <section className="panel-card report-print" id="report-print-area">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                <div>
                  <h2 className="section-title mb-1">{report.title}</h2>
                  <p className="text-muted mb-0">
                    Generated {new Date(report.generated_at).toLocaleString()} · {report.row_count}{' '}
                    rows · Currency {meta.currency_symbol} ({meta.currency})
                  </p>
                </div>
                <div className="btn-group no-print">
                  <Button variant="outline-secondary" onClick={() => window.print()}>
                    Print
                  </Button>
                  <Button variant="primary" onClick={() => void onPdf()}>
                    Download PDF
                  </Button>
                </div>
              </div>

              {Object.keys(report.summary).length > 0 ? (
                <div className="status-grid admin-stats mb-3">
                  {Object.entries(report.summary).map(([key, value]) => (
                    <article key={key} className="status-card">
                      <h3 className="status-card__title text-capitalize">
                        {key.replaceAll('_', ' ')}
                      </h3>
                      <p className="stat-value">
                        {typeof value === 'number' ? value.toLocaleString() : String(value)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}

              {report.rows.length === 0 ? (
                <div className="empty-panel">
                  <p>No rows matched the selected filters.</p>
                </div>
              ) : (
                <div className="table-panel">
                  <Table responsive bordered hover className="mb-0 report-table">
                    <thead>
                      <tr>
                        {report.columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row, idx) => (
                        <tr key={idx}>
                          {row.map((cell, cidx) => (
                            <td key={`${idx}-${cidx}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </section>
          ) : (
            <div className="empty-panel no-print">
              <p>Select a report and click Generate.</p>
            </div>
          )}
        </>
      ) : null}
    </AppShell>
  )
}
