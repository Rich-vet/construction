import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import {
  MetricCard,
  PageHero,
  QuickActions,
  StatusPill,
  formatLongDate,
  greetingForNow,
} from '../../components/ui/PageChrome'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/auth'
import { fetchWorkerDashboard, type WorkerDashboard } from '../../api/worker'

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
            subtitle={formatLongDate()}
          />

          <section className="metric-grid" aria-label="Worker statistics">
            <MetricCard label="My Projects" value={data.cards.assigned_projects} icon="bi-building" tone="blue" />
            <MetricCard label="Open Tasks" value={data.cards.my_tasks} icon="bi-list-task" tone="amber" />
            <MetricCard label="Due Soon" value={data.cards.due_soon} icon="bi-calendar-event" tone="slate" />
            <MetricCard label="Overdue" value={data.cards.overdue} icon="bi-exclamation-triangle" tone="red" />
            <MetricCard label="Completed" value={data.cards.completed} icon="bi-check2-circle" tone="green" />
            <MetricCard
              label="Notifications"
              value={data.cards.unread_notifications}
              icon="bi-bell"
              tone="amber"
            />
          </section>

          <div className="dash-layout">
            <section className="panel-card dash-span-2">
              <div className="panel-card__head">
                <h2 className="panel-title">Due soon</h2>
                <Link to="/tasks">All tasks</Link>
              </div>
              {data.due_soon_tasks.length === 0 ? (
                <p className="empty-hint">Nothing due in the next 7 days.</p>
              ) : (
                <Table responsive size="sm" className="mb-0 data-table">
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
                        <td>{String(t.due_date ?? '—')}</td>
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
              <div className="panel-card">
                <QuickActions
                  items={[
                    { label: 'My Tasks', to: '/tasks', icon: 'bi-list-task' },
                    { label: 'My Projects', to: '/projects', icon: 'bi-building' },
                    { label: 'Attendance', to: '/attendance', icon: 'bi-calendar-check' },
                    { label: 'Notifications', to: '/notifications', icon: 'bi-bell' },
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
