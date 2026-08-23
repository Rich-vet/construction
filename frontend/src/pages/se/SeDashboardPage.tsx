import { useEffect, useState } from 'react'
import { Alert, Badge, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchSeDashboard, type SeDashboard } from '../../api/site'

export function SeDashboardPage() {
  const [data, setData] = useState<SeDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSeDashboard()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load dashboard.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Home / Dashboard" title="Site Engineer Dashboard" phaseLabel="SE">
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {data ? (
        <>
          <section className="status-grid admin-stats" aria-label="Site engineer statistics">
            {[
              ['Assigned Projects', data.cards.assigned_projects, 'bi-building'],
              ['Active', data.cards.active_projects, 'bi-hammer'],
              ["Today's Tasks", data.cards.today_tasks, 'bi-list-task'],
              ['Workers On Site', data.cards.workers_on_site, 'bi-people'],
              ['Pending Requests', data.cards.pending_material_requests, 'bi-clipboard-check'],
              ['Equipment On Site', data.cards.equipment_on_site, 'bi-truck'],
              ['Low Stock', data.cards.low_stock_materials, 'bi-exclamation-triangle'],
            ].map(([label, value, icon], index) => (
              <article
                key={String(label)}
                className="status-card"
                style={{ ['--delay' as string]: `${index * 40}ms` }}
              >
                <div className="status-card__icon" aria-hidden="true">
                  <i className={`bi ${icon}`} />
                </div>
                <h3 className="status-card__title">{label}</h3>
                <p className="stat-value">{value}</p>
              </article>
            ))}
          </section>

          <div className="admin-panels">
            <section className="panel-card">
              <div className="panel-card__header">
                <h2 className="section-title">Assigned projects</h2>
                <Link to="/projects">View all</Link>
              </div>
              {data.projects.length === 0 ? (
                <p className="text-muted mb-0">No projects assigned to you yet.</p>
              ) : (
                <Table responsive hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map((p) => (
                      <tr key={String(p.id)}>
                        <td>
                          <Link to={`/projects/${p.id}`}>{String(p.name)}</Link>
                        </td>
                        <td>
                          <Badge bg="secondary">{String(p.status)}</Badge>
                        </td>
                        <td>{String(p.progress)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__header">
                <h2 className="section-title">Today&apos;s tasks</h2>
                <Link to="/attendance">Attendance</Link>
              </div>
              {data.today_tasks.length === 0 ? (
                <p className="text-muted mb-0">No tasks due today.</p>
              ) : (
                <Table responsive hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Project</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.today_tasks.map((t) => (
                      <tr key={String(t.id)}>
                        <td>{String(t.name)}</td>
                        <td>{String(t.project_name)}</td>
                        <td>{String(t.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__header">
                <h2 className="section-title">Attendance today</h2>
                <Link to="/attendance">Record</Link>
              </div>
              {data.attendance_today.length === 0 ? (
                <p className="text-muted mb-0">No attendance recorded today.</p>
              ) : (
                <Table responsive hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Project</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance_today.map((a) => (
                      <tr key={String(a.id)}>
                        <td>{String(a.worker_name)}</td>
                        <td>{String(a.project_name)}</td>
                        <td>{String(a.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__header">
                <h2 className="section-title">Low stock materials</h2>
                <Link to="/materials">Materials</Link>
              </div>
              {data.low_stock_materials.length === 0 ? (
                <p className="text-muted mb-0">Stock levels look healthy.</p>
              ) : (
                <Table responsive hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Qty</th>
                      <th>Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.low_stock_materials.map((m) => (
                      <tr key={String(m.id)}>
                        <td>{String(m.name)}</td>
                        <td>
                          {String(m.quantity)} {String(m.unit ?? '')}
                        </td>
                        <td>{String(m.minimum_stock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          </div>
        </>
      ) : null}
    </AppShell>
  )
}
