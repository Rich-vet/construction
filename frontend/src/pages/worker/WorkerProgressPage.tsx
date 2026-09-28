import { useEffect, useMemo, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { PageHero, ProgressBar, StatusPill } from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import { fetchMyProjects, fetchMyTasks, fetchWorkerDashboard } from '../../api/worker'
import { taskProgressPercent } from './workerHelpers'

export function WorkerProgressPage() {
  const [projects, setProjects] = useState<Array<Record<string, unknown>>>([])
  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([])
  const [notifications, setNotifications] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchMyProjects(), fetchMyTasks(), fetchWorkerDashboard()])
      .then(([proj, taskData, dash]) => {
        setProjects(proj.items)
        setTasks(taskData.items)
        setNotifications(dash.recent_notifications ?? [])
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load progress.'),
      )
      .finally(() => setLoading(false))
  }, [])

  const primary = projects[0] ?? null
  const overall = Number(primary?.progress ?? 0)

  const openTasks = useMemo(
    () => tasks.filter((t) => String(t.status) !== 'Cancelled'),
    [tasks],
  )

  return (
    <AppShell>
      <PageHero title="Progress" subtitle="Track your work against project goals." />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="dash-layout dash-layout--worker">
          <div className="dash-stack">
            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="panel-title">
                  {primary ? String(primary.name) : 'Project Overview'}
                </h2>
                {primary ? <StatusPill status={String(primary.status)} /> : null}
              </div>
              {primary ? (
                <div className="task-progress-block">
                  <div className="task-progress-block__head">
                    <span>Overall Progress</span>
                    <strong>{overall}%</strong>
                  </div>
                  <ProgressBar value={overall} />
                </div>
              ) : (
                <p className="empty-hint">You are not assigned to any projects yet.</p>
              )}
              {projects.length > 1 ? (
                <ul className="worker-project-mini">
                  {projects.slice(1).map((p) => (
                    <li key={String(p.id)}>
                      <span>{String(p.name)}</span>
                      <ProgressBar value={Number(p.progress ?? 0)} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="panel-card">
              <div className="panel-card__head">
                <h2 className="panel-title">Your Tasks Progress</h2>
                <Link to="/tasks">My Tasks</Link>
              </div>
              {openTasks.length === 0 ? (
                <p className="empty-hint">No tasks assigned yet.</p>
              ) : (
                <ul className="worker-task-list">
                  {openTasks.map((t) => (
                    <li key={String(t.id)}>
                      <Link to={`/tasks/${t.id}`} className="worker-task-row">
                        <span className="worker-task-meta">
                          <span className="worker-task-name">{String(t.name)}</span>
                          <span className="worker-task-sub">{String(t.project_name)}</span>
                          <ProgressBar value={taskProgressPercent(t.status)} />
                        </span>
                        <StatusPill status={String(t.status)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="dash-aside">
            <section className="panel-card">
              <h2 className="panel-title">Recent Updates</h2>
              {notifications.length === 0 ? (
                <p className="empty-hint">No recent activity.</p>
              ) : (
                <ul className="activity-feed">
                  {notifications.slice(0, 8).map((n) => (
                    <li key={String(n.id)} className="activity-feed__item">
                      <span className="activity-feed__dot" aria-hidden="true" />
                      <div>
                        <strong>{String(n.title ?? n.message ?? 'Update')}</strong>
                        {n.message && n.title ? (
                          <p className="mb-0">{String(n.message)}</p>
                        ) : null}
                        <span className="activity-feed__time">{String(n.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </AppShell>
  )
}
