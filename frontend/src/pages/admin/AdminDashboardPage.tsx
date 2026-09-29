import { useEffect, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import {
  FilterTabs,
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
import { fetchAdminDashboard, type AdminDashboard } from '../../api/admin'

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectFilter, setProjectFilter] = useState('Active')

  useEffect(() => {
    fetchAdminDashboard()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load dashboard.'),
      )
      .finally(() => setLoading(false))
  }, [])

  const name = user?.full_name || 'Administrator'
  const projects = (data?.recent_projects ?? []).filter((p) =>
    projectFilter === 'All' ? true : p.status === projectFilter,
  )

  return (
    <AppShell>
      {loading ? (
        <div className="loading-state" role="status">
          <Spinner animation="border" />
          <p className="mb-0 mt-2 text-muted">Loading dashboard…</p>
        </div>
      ) : null}

      {error ? (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      {data ? (
        <>
          <PageHero
            title={greetingForNow(name)}
            subtitle={formatLongDate()}
          />

          <section className="metric-grid" aria-label="System statistics">
            <MetricCard
              label="Total Projects"
              value={data.cards.total_projects}
              icon="bi-building"
              tone="blue"
            />
            <MetricCard
              label="Active Projects"
              value={data.cards.active_projects}
              icon="bi-hammer"
              tone="amber"
            />
            <MetricCard
              label="Completed Projects"
              value={data.cards.completed_projects}
              icon="bi-check2-circle"
              tone="green"
            />
            <MetricCard
              label="Low-stock Materials"
              value={data.cards.low_stock_materials}
              icon="bi-exclamation-triangle"
              tone="red"
            />
            <MetricCard
              label="Total Users"
              value={data.cards.total_users}
              icon="bi-people"
              tone="slate"
            />
            <MetricCard
              label="Active Users"
              value={data.cards.active_users}
              icon="bi-person-check"
              tone="green"
            />
            <MetricCard
              label="Employees"
              value={data.cards.employees}
              icon="bi-person-badge"
              tone="blue"
              hint="Registry module pending"
            />
            <MetricCard
              label="Contractors"
              value={data.cards.contractors}
              icon="bi-person-workspace"
              tone="amber"
              hint="Registry module pending"
            />
          </section>

          <div className="dash-layout">
            <section className="panel-card dash-span-2">
              <div className="panel-card__head">
                <h2 className="panel-title">Project Overview</h2>
                <Link to="/projects">View all</Link>
              </div>
              <FilterTabs
                value={projectFilter}
                onChange={setProjectFilter}
                options={[
                  { value: 'All', label: 'All' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'On Hold', label: 'On Hold' },
                ]}
              />
              {projects.length === 0 ? (
                <p className="empty-hint">No projects in this filter.</p>
              ) : (
                <ul className="project-overview-list">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <Link to={`/projects/${project.id}`} className="project-overview-item">
                        <span className="project-overview-thumb" aria-hidden="true">
                          <i className="bi bi-building" />
                        </span>
                        <span className="project-overview-meta">
                          <span className="project-overview-name">{project.name}</span>
                          <span className="project-overview-sub">
                            {project.client_name || 'No client'} · {project.status}
                          </span>
                          <ProgressBar value={project.progress} />
                        </span>
                        <StatusPill status={project.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="panel-title">Recent Activity</h2>
                <Link to="/activity-log">View all</Link>
              </div>
              {data.recent_activity.length === 0 ? (
                <p className="empty-hint">No activity recorded yet.</p>
              ) : (
                <ul className="activity-feed">
                  {data.recent_activity.slice(0, 8).map((item) => (
                    <li key={item.id}>
                      <span className="activity-feed__icon" aria-hidden="true">
                        <i className="bi bi-activity" />
                      </span>
                      <span>
                        <strong>{item.actor_name}</strong> {item.action}
                        <span className="activity-feed__time">
                          {relativeTime(item.created_at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="dash-aside">
              <PromoCard />
              <div className="panel-card">
                <QuickActions
                  items={[
                    { label: 'Manage Users', to: '/users', icon: 'bi-person-plus' },
                    { label: 'Employees', to: '/employees', icon: 'bi-people' },
                    { label: 'Contractors', to: '/contractors', icon: 'bi-person-badge' },
                    { label: 'Settings', to: '/settings', icon: 'bi-gear' },
                    { label: 'View Reports', to: '/reports', icon: 'bi-bar-chart-line' },
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
