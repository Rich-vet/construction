import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import {
  MetricCard,
  PageHero,
  ProgressBar,
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
            subtitle={`Site Engineer · ${formatLongDate()}`}
          />

          <section className="metric-grid metric-grid--4" aria-label="Site engineer statistics">
            <MetricCard
              label="My Projects"
              value={data.cards.assigned_projects}
              icon="bi-building"
              tone="blue"
            />
            <MetricCard
              label="Active Tasks"
              value={data.cards.today_tasks}
              icon="bi-list-task"
              tone="amber"
            />
            <MetricCard
              label="Attendance Today"
              value={data.cards.workers_on_site}
              icon="bi-people"
              tone="green"
            />
            <MetricCard
              label="Low Stock Alerts"
              value={data.cards.low_stock_materials}
              icon="bi-exclamation-triangle"
              tone="red"
            />
          </section>

          <div className="dash-layout dash-layout--se">
            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="panel-title">Today&apos;s Tasks</h2>
                <Link to="/site-diary">Site Diary</Link>
              </div>
              {data.today_tasks.length === 0 ? (
                <p className="empty-hint">No tasks due today.</p>
              ) : (
                <Table responsive className="mb-0 data-table">
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
                        <td className="fw-semibold">{String(t.name)}</td>
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

            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="panel-title">My Projects</h2>
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

            <aside className="dash-aside">
              <div className="panel-card">
                <QuickActions
                  items={[
                    { label: 'Record Attendance', to: '/attendance', icon: 'bi-calendar-check' },
                    { label: 'Site Diary', to: '/site-diary', icon: 'bi-journal-richtext' },
                    { label: 'Materials', to: '/materials', icon: 'bi-box-seam' },
                    { label: 'Equipment', to: '/equipment', icon: 'bi-truck' },
                  ]}
                />
              </div>
              <section className="panel-card">
                <div className="panel-card__head">
                  <h2 className="panel-title">Attendance today</h2>
                  <Link to="/attendance">Manage</Link>
                </div>
                {data.attendance_today.length === 0 ? (
                  <p className="empty-hint">No attendance recorded today.</p>
                ) : (
                  <ul className="person-list">
                    {data.attendance_today.slice(0, 6).map((a) => {
                      const name = String(a.worker_name ?? 'Worker')
                      const initials = name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase() ?? '')
                        .join('')
                      return (
                        <li key={String(a.id)} className="person-list__item">
                          <span className="person-avatar" aria-hidden="true">
                            {initials}
                          </span>
                          <span className="person-list__meta">
                            <span className="person-list__name">{name}</span>
                            <span className="person-list__sub">{String(a.project_name)}</span>
                          </span>
                          <StatusPill status={String(a.status)} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </AppShell>
  )
}
