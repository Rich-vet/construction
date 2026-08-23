import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchPmDashboard, type PmDashboard } from '../../api/projects'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export function PmDashboardPage() {
  const [data, setData] = useState<PmDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPmDashboard()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load dashboard.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Home / Dashboard" title="Project Manager Dashboard" phaseLabel="PM">
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {data ? (
        <>
          <section className="status-grid admin-stats" aria-label="PM statistics">
            {[
              ['My Projects', data.cards.my_projects, 'bi-building'],
              ['Active Projects', data.cards.active_projects, 'bi-hammer'],
              ['Avg Progress', `${data.cards.average_progress}%`, 'bi-graph-up'],
              ['Pending Requests', data.cards.pending_material_requests, 'bi-clipboard-check'],
              ['Budget Alerts', data.cards.budget_alerts, 'bi-exclamation-triangle'],
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
              <h2 className="section-title">Project status</h2>
              <Doughnut
                data={{
                  labels: Object.keys(data.status_breakdown),
                  datasets: [
                    {
                      data: Object.values(data.status_breakdown),
                      backgroundColor: ['#5c6570', '#e8a317', '#c45c26', '#2f6b4f', '#9b2f2f'],
                    },
                  ],
                }}
                options={{ plugins: { legend: { position: 'bottom' } } }}
              />
            </section>

            <section className="panel-card">
              <h2 className="section-title">Progress by project</h2>
              <Bar
                data={{
                  labels: data.projects.map((p) => p.name),
                  datasets: [
                    {
                      label: 'Progress %',
                      data: data.projects.map((p) => p.progress),
                      backgroundColor: '#1f252e',
                    },
                  ],
                }}
                options={{
                  scales: { y: { beginAtZero: true, max: 100 } },
                  plugins: { legend: { display: false } },
                }}
              />
            </section>

            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="section-title">Upcoming deadlines</h2>
                <Link to="/projects">Projects</Link>
              </div>
              {data.upcoming_deadlines.length === 0 ? (
                <p className="empty-hint">No upcoming deadlines.</p>
              ) : (
                <ul className="activity-list">
                  {data.upcoming_deadlines.map((p) => (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}`}>
                        <strong>{p.name}</strong>
                      </Link>
                      <div className="small text-muted">
                        Due {p.expected_completion ?? '—'} · {p.status}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="admin-panels mt-4">
            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="section-title">Pending material requests</h2>
                <Link to="/material-requests">Review</Link>
              </div>
              {data.pending_material_requests.length === 0 ? (
                <p className="empty-hint">No pending requests.</p>
              ) : (
                <Table responsive size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Material</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pending_material_requests.map((r) => (
                      <tr key={String(r.id)}>
                        <td>{String(r.project_name ?? '')}</td>
                        <td>{String(r.material_name ?? '')}</td>
                        <td>{String(r.quantity ?? '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>

            <section className="panel-card">
              <h2 className="section-title">Budget alerts</h2>
              {data.budget_alerts.length === 0 ? (
                <p className="empty-hint">All projects are within budget.</p>
              ) : (
                <ul className="activity-list">
                  {data.budget_alerts.map((a) => (
                    <li key={String(a.project_id)}>
                      <strong>{String(a.project_name)}</strong> over by K
                      {Number(a.over_by).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel-card">
              <h2 className="section-title">Recent expenses</h2>
              {data.recent_expenses.length === 0 ? (
                <p className="empty-hint">No expenses recorded yet.</p>
              ) : (
                <ul className="activity-list">
                  {data.recent_expenses.map((e) => (
                    <li key={String(e.id)}>
                      <strong>{String(e.project_name)}</strong> — {String(e.description)}
                      <div className="small text-muted">
                        K{Number(e.amount).toLocaleString()} · {String(e.expense_date)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </AppShell>
  )
}
