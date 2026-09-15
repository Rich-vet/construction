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
import {
  MetricCard,
  PageHero,
  ProgressBar,
  PromoCard,
  QuickActions,
  StatusPill,
  formatLongDate,
  greetingForNow,
} from '../../components/ui/PageChrome'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/auth'
import { fetchPmDashboard, type PmDashboard } from '../../api/projects'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export function PmDashboardPage() {
  const { user } = useAuth()
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
    <AppShell>
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {data ? (
        <>
          <PageHero
            title={greetingForNow(user?.full_name || 'Manager')}
            subtitle={formatLongDate()}
            actions={
              <Link to="/projects/create" className="btn btn-accent">
                <i className="bi bi-plus-lg me-1" aria-hidden="true" />
                New Project
              </Link>
            }
          />

          <section className="metric-grid metric-grid--5" aria-label="PM statistics">
            <MetricCard label="My Projects" value={data.cards.my_projects} icon="bi-building" tone="blue" />
            <MetricCard label="Active" value={data.cards.active_projects} icon="bi-hammer" tone="amber" />
            <MetricCard
              label="Avg Progress"
              value={`${data.cards.average_progress}%`}
              icon="bi-graph-up"
              tone="green"
            />
            <MetricCard
              label="Pending Requests"
              value={data.cards.pending_material_requests}
              icon="bi-clipboard-check"
              tone="slate"
            />
            <MetricCard
              label="Budget Alerts"
              value={data.cards.budget_alerts}
              icon="bi-exclamation-triangle"
              tone="red"
            />
          </section>

          <div className="dash-layout">
            <section className="panel-card">
              <h2 className="panel-title">Project status</h2>
              <Doughnut
                data={{
                  labels: Object.keys(data.status_breakdown),
                  datasets: [
                    {
                      data: Object.values(data.status_breakdown),
                      backgroundColor: ['#64748b', '#f59e0b', '#0ea5e9', '#16a34a', '#ef4444'],
                    },
                  ],
                }}
                options={{ plugins: { legend: { position: 'bottom' } } }}
              />
            </section>

            <section className="panel-card dash-span-2">
              <div className="panel-card__head">
                <h2 className="panel-title">Project Overview</h2>
                <Link to="/projects">View all</Link>
              </div>
              {data.projects.length === 0 ? (
                <p className="empty-hint">No projects yet.</p>
              ) : (
                <ul className="project-overview-list">
                  {data.projects.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}`} className="project-overview-item">
                        <span className="project-overview-thumb" aria-hidden="true">
                          <i className="bi bi-building" />
                        </span>
                        <span className="project-overview-meta">
                          <span className="project-overview-name">{p.name}</span>
                          <span className="project-overview-sub">{p.location}</span>
                          <ProgressBar value={p.progress} />
                        </span>
                        <StatusPill status={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="panel-title">Pending requests</h2>
                <Link to="/material-requests">Review</Link>
              </div>
              {data.pending_material_requests.length === 0 ? (
                <p className="empty-hint">No pending requests.</p>
              ) : (
                <Table responsive size="sm" className="mb-0 data-table">
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
              <h2 className="panel-title">Progress by project</h2>
              <Bar
                data={{
                  labels: data.projects.map((p) => p.name),
                  datasets: [
                    {
                      label: 'Progress %',
                      data: data.projects.map((p) => p.progress),
                      backgroundColor: '#f59e0b',
                    },
                  ],
                }}
                options={{
                  scales: { y: { beginAtZero: true, max: 100 } },
                  plugins: { legend: { display: false } },
                }}
              />
            </section>

            <aside className="dash-aside">
              <PromoCard />
              <div className="panel-card">
                <QuickActions
                  items={[
                    { label: 'Add New Project', to: '/projects/create', icon: 'bi-plus-square' },
                    { label: 'Material Requests', to: '/material-requests', icon: 'bi-clipboard-check' },
                    { label: 'View Reports', to: '/reports', icon: 'bi-bar-chart-line' },
                    { label: 'Quotations', to: '/quotations', icon: 'bi-file-earmark-text' },
                  ]}
                />
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </AppShell>
  )
}
