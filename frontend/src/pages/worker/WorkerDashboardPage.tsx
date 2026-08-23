import { useEffect, useState } from 'react'
import { Alert, Badge, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchWorkerDashboard, type WorkerDashboard } from '../../api/worker'

export function WorkerDashboardPage() {
  const [data, setData] = useState<WorkerDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkerDashboard()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load dashboard.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Home / Dashboard" title="Worker Dashboard" phaseLabel="Worker">
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {data ? (
        <>
          <section className="status-grid admin-stats" aria-label="Worker statistics">
            {[
              ['My Projects', data.cards.assigned_projects, 'bi-building'],
              ['Open Tasks', data.cards.my_tasks, 'bi-list-task'],
              ['Due Soon', data.cards.due_soon, 'bi-calendar-event'],
              ['Overdue', data.cards.overdue, 'bi-exclamation-triangle'],
              ['Completed', data.cards.completed, 'bi-check2-circle'],
              ['Notifications', data.cards.unread_notifications, 'bi-bell', '/notifications'],
            ].map(([label, value, icon, to], index) => (
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
                {to ? (
                  <Link to={String(to)} className="small">
                    View
                  </Link>
                ) : null}
              </article>
            ))}
          </section>

          <div className="admin-panels">
            <section className="panel-card">
              <div className="panel-card__header">
                <h2 className="section-title">Due soon</h2>
                <Link to="/tasks">All tasks</Link>
              </div>
              {data.due_soon_tasks.length === 0 ? (
                <p className="text-muted mb-0">Nothing due in the next 7 days.</p>
              ) : (
                <Table responsive hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Project</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.due_soon_tasks.map((t) => (
                      <tr key={String(t.id)}>
                        <td>
                          <Link to={`/tasks/${t.id}`}>{String(t.name)}</Link>
                        </td>
                        <td>{String(t.project_name)}</td>
                        <td>{String(t.due_date)}</td>
                        <td>
                          <Badge bg="secondary">{String(t.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__header">
                <h2 className="section-title">Open tasks</h2>
                <Link to="/tasks">View</Link>
              </div>
              {data.open_tasks.length === 0 ? (
                <p className="text-muted mb-0">No open tasks assigned to you.</p>
              ) : (
                <Table responsive hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.open_tasks.map((t) => (
                      <tr key={String(t.id)}>
                        <td>
                          <Link to={`/tasks/${t.id}`}>{String(t.name)}</Link>
                        </td>
                        <td>{String(t.priority)}</td>
                        <td>{String(t.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__header">
                <h2 className="section-title">My projects</h2>
                <Link to="/projects">View</Link>
              </div>
              {data.projects.length === 0 ? (
                <p className="text-muted mb-0">You are not on any project teams yet.</p>
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
                        <td>{String(p.name)}</td>
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
                <h2 className="section-title">Recent notifications</h2>
                <Link to="/notifications">Inbox</Link>
              </div>
              {data.recent_notifications.length === 0 ? (
                <p className="text-muted mb-0">No notifications yet.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {data.recent_notifications.map((n) => (
                    <li key={String(n.id)} className="mb-2 border-bottom pb-2">
                      <strong>{String(n.title)}</strong>
                      <div className="small text-muted">
                        {n.created_at ? new Date(String(n.created_at)).toLocaleString() : '—'}
                        {n.is_read ? '' : ' · Unread'}
                      </div>
                      <div>{String(n.message)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel-card">
              <div className="panel-card__header">
                <h2 className="section-title">Recent attendance</h2>
                <Link to="/attendance">View</Link>
              </div>
              {data.recent_attendance.length === 0 ? (
                <p className="text-muted mb-0">No attendance records yet.</p>
              ) : (
                <Table responsive hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Project</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_attendance.map((a) => (
                      <tr key={String(a.id)}>
                        <td>{String(a.attendance_date)}</td>
                        <td>{String(a.project_name)}</td>
                        <td>{String(a.status)}</td>
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
