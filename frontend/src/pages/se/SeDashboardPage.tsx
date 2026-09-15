import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
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
import { fetchSeDashboard, type SeDashboard } from '../../api/site'

export function SeDashboardPage() {
  const { user } = useAuth()
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
            title={greetingForNow(user?.full_name || 'Engineer')}
            subtitle={formatLongDate()}
          />

          <section className="metric-grid" aria-label="Site engineer statistics">
            <MetricCard label="Assigned Projects" value={data.cards.assigned_projects} icon="bi-building" tone="blue" />
            <MetricCard label="Active" value={data.cards.active_projects} icon="bi-hammer" tone="amber" />
            <MetricCard label="Today's Tasks" value={data.cards.today_tasks} icon="bi-list-task" tone="slate" />
            <MetricCard label="Workers On Site" value={data.cards.workers_on_site} icon="bi-people" tone="green" />
            <MetricCard
              label="Pending Requests"
              value={data.cards.pending_material_requests}
              icon="bi-clipboard-check"
              tone="amber"
            />
            <MetricCard label="Equipment On Site" value={data.cards.equipment_on_site} icon="bi-truck" tone="blue" />
            <MetricCard
              label="Low Stock"
              value={data.cards.low_stock_materials}
              icon="bi-exclamation-triangle"
              tone="red"
            />
          </section>

          <div className="dash-layout">
            <section className="panel-card dash-span-2">
              <div className="panel-card__head">
                <h2 className="panel-title">Assigned projects</h2>
                <Link to="/projects">View all</Link>
              </div>
              {data.projects.length === 0 ? (
                <p className="empty-hint">No projects assigned to you yet.</p>
              ) : (
                <ul className="project-overview-list">
                  {data.projects.map((p) => (
                    <li key={String(p.id)}>
                      <Link to={`/projects/${p.id}`} className="project-overview-item">
                        <span className="project-overview-thumb" aria-hidden="true">
                          <i className="bi bi-building" />
                        </span>
                        <span className="project-overview-meta">
                          <span className="project-overview-name">{String(p.name)}</span>
                          <span className="project-overview-sub">{String(p.status)}</span>
                          <ProgressBar value={Number(p.progress)} />
                        </span>
                        <StatusPill status={String(p.status)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="panel-title">Today&apos;s tasks</h2>
                <Link to="/attendance">Attendance</Link>
              </div>
              {data.today_tasks.length === 0 ? (
                <p className="empty-hint">No tasks due today.</p>
              ) : (
                <Table responsive size="sm" className="mb-0 data-table">
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
                        <td>
                          <StatusPill status={String(t.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>

            <aside className="dash-aside">
              <PromoCard title="Keep sites safe, stocked, and on schedule." />
              <div className="panel-card">
                <QuickActions
                  items={[
                    { label: 'Record Attendance', to: '/attendance', icon: 'bi-calendar-check' },
                    { label: 'Materials', to: '/materials', icon: 'bi-box-seam' },
                    { label: 'Progress Update', to: '/progress-updates', icon: 'bi-graph-up-arrow' },
                    { label: 'Site Report', to: '/site-reports', icon: 'bi-journal-text' },
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
