import { useEffect, useMemo, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
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
import { fetchWorkerDashboard, type WorkerDashboard } from '../../api/worker'
import { isDueToday, taskProgressPercent } from './workerHelpers'

export function WorkerDashboardPage() {
  const { user } = useAuth()
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

  const todayTasks = useMemo(() => {
    if (!data) return []
    const open = [...data.open_tasks, ...data.due_soon_tasks]
    const seen = new Set<string>()
    return open
      .filter((t) => {
        const id = String(t.id)
        if (seen.has(id)) return false
        seen.add(id)
        return (
          isDueToday(t.due_date) ||
          String(t.status) === 'In Progress' ||
          String(t.status) === 'Ready for Review'
        )
      })
      .slice(0, 6)
  }, [data])

  const awaitingReview = useMemo(
    () => (data?.open_tasks ?? []).filter((t) => String(t.status) === 'Ready for Review').length,
    [data],
  )

  const counts = useMemo(() => {
    if (!data) return { today: 0, completed: 0, inProgress: 0, pending: 0 }
    const all = data.open_tasks
    return {
      today: todayTasks.length || data.cards.due_soon,
      completed: data.cards.completed,
      inProgress: all.filter((t) => String(t.status) === 'In Progress').length,
      pending: all.filter((t) => String(t.status) === 'Pending').length,
    }
  }, [data, todayTasks])

  const primaryProject = data?.projects?.[0] ?? null

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
            title={greetingForNow(user?.full_name || 'Worker')}
            subtitle={`Site Worker · ${formatLongDate()}`}
          />

          <section className="metric-grid metric-grid--4" aria-label="Worker statistics">
            <MetricCard label="Today's Tasks" value={counts.today} icon="bi-list-task" tone="amber" />
            <MetricCard label="Verified" value={counts.completed} icon="bi-check2-circle" tone="green" />
            <MetricCard label="In Progress" value={counts.inProgress} icon="bi-arrow-repeat" tone="blue" />
            <MetricCard
              label="Awaiting Review"
              value={awaitingReview}
              icon="bi-hourglass-split"
              tone="slate"
            />
          </section>

          <div className="dash-layout dash-layout--worker">
            <div className="dash-stack">
              <section className="panel-card">
                <div className="panel-card__head">
                  <h2 className="panel-title">Today&apos;s Tasks</h2>
                  <Link to="/tasks">View all</Link>
                </div>
                {todayTasks.length === 0 ? (
                  <p className="empty-hint">
                    No tasks scheduled for today. Check My Tasks for upcoming work.
                  </p>
                ) : (
                  <ul className="worker-task-list">
                    {todayTasks.map((t) => (
                      <li key={String(t.id)}>
                        <Link to={`/tasks/${t.id}`} className="worker-task-row">
                          <span className="worker-task-icon" aria-hidden="true">
                            <i className="bi bi-hammer" />
                          </span>
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

              {primaryProject ? (
                <section className="panel-card">
                  <div className="panel-card__head">
                    <h2 className="panel-title">Project progress</h2>
                    <StatusPill status={String(primaryProject.status)} />
                  </div>
                  <p className="worker-task-name mb-2">{String(primaryProject.name)}</p>
                  <div className="task-progress-block">
                    <div className="task-progress-block__head">
                      <span>Overall</span>
                      <strong>{Number(primaryProject.progress ?? 0)}%</strong>
                    </div>
                    <ProgressBar value={Number(primaryProject.progress ?? 0)} />
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="dash-aside">
              <PromoCard title="Build Better Together" />
              <div className="panel-card">
                <QuickActions
                  items={[
                    { label: 'View My Tasks', to: '/tasks', icon: 'bi-list-task' },
                    { label: 'Attendance', to: '/attendance', icon: 'bi-calendar-check' },
                    { label: 'Notifications', to: '/notifications', icon: 'bi-bell' },
                  ]}
                />
              </div>
              {(data.recent_notifications ?? []).length > 0 ? (
                <section className="panel-card">
                  <h2 className="panel-title">Recent updates</h2>
                  <ul className="activity-feed">
                    {data.recent_notifications.slice(0, 5).map((n) => (
                      <li key={String(n.id)} className="activity-feed__item">
                        <span className="activity-feed__dot" aria-hidden="true" />
                        <div>
                          <strong>{String(n.title ?? n.message)}</strong>
                          <span className="activity-feed__time">{String(n.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </aside>
          </div>

          <div className="safety-banner" role="note">
            <i className="bi bi-shield-check" aria-hidden="true" />
            <div>
              <strong>Safety First</strong>
              <p>Always wear your PPE and follow site instructions.</p>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  )
}
