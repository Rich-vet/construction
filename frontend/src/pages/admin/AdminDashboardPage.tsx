import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchAdminDashboard, type AdminDashboard } from '../../api/admin'

const cardMeta: Array<{ key: keyof AdminDashboard['cards']; label: string; icon: string }> = [
  { key: 'total_users', label: 'Total Users', icon: 'bi-people' },
  { key: 'active_users', label: 'Active Users', icon: 'bi-person-check' },
  { key: 'total_projects', label: 'Total Projects', icon: 'bi-building' },
  { key: 'active_projects', label: 'Active Projects', icon: 'bi-hammer' },
  { key: 'completed_projects', label: 'Completed Projects', icon: 'bi-check2-circle' },
  { key: 'employees', label: 'Employees', icon: 'bi-person-badge' },
  { key: 'contractors', label: 'Contractors', icon: 'bi-person-workspace' },
  { key: 'low_stock_materials', label: 'Low-stock Materials', icon: 'bi-exclamation-triangle' },
]

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdminDashboard()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load dashboard.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Home / Dashboard" title="Administrator Dashboard" phaseLabel="Admin">
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
          <section className="status-grid admin-stats" aria-label="System statistics">
            {cardMeta.map((card, index) => (
              <article
                key={String(card.key)}
                className="status-card"
                style={{ ['--delay' as string]: `${index * 40}ms` }}
              >
                <div className="status-card__icon" aria-hidden="true">
                  <i className={`bi ${card.icon}`} />
                </div>
                <h3 className="status-card__title">{card.label}</h3>
                <p className="stat-value">{data.cards[card.key]}</p>
              </article>
            ))}
          </section>

          <div className="admin-panels">
            <section className="panel-card" aria-labelledby="activity-heading">
              <div className="panel-card__head">
                <h2 id="activity-heading" className="section-title">
                  Recent activity
                </h2>
                <Link to="/activity-log">View all</Link>
              </div>
              {data.recent_activity.length === 0 ? (
                <p className="empty-hint">No activity recorded yet.</p>
              ) : (
                <ul className="activity-list">
                  {data.recent_activity.map((item) => (
                    <li key={item.id}>
                      <strong>{item.actor_name}</strong> {item.action}
                      {item.details ? <span className="text-muted"> — {item.details}</span> : null}
                      <div className="small text-muted">{item.created_at}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel-card" aria-labelledby="projects-heading">
              <div className="panel-card__head">
                <h2 id="projects-heading" className="section-title">
                  Recent projects
                </h2>
              </div>
              {data.recent_projects.length === 0 ? (
                <p className="empty-hint">
                  No projects yet. Project records will appear here when the Projects module is
                  implemented.
                </p>
              ) : (
                <Table responsive hover className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Client</th>
                      <th>Status</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_projects.map((project) => (
                      <tr key={project.id}>
                        <td>{project.name}</td>
                        <td>{project.client_name ?? '—'}</td>
                        <td>{project.status}</td>
                        <td>{project.progress}%</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>

            <section className="panel-card" aria-labelledby="notes-heading">
              <div className="panel-card__head">
                <h2 id="notes-heading" className="section-title">
                  Notifications
                </h2>
                <Link to="/notifications">View all</Link>
              </div>
              {data.notifications.length === 0 ? (
                <p className="empty-hint">No notifications yet.</p>
              ) : (
                <ul className="activity-list">
                  {data.notifications.map((note) => (
                    <li key={note.id}>
                      <strong>{note.title}</strong>
                      <div>{note.message}</div>
                      <div className="small text-muted">{note.created_at}</div>
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
