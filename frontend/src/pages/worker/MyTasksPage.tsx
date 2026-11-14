import { useEffect, useMemo, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { FilterTabs, PageHero, ProgressBar, StatusPill } from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import { fetchMyTasks } from '../../api/worker'
import {
  formatDueLabel,
  isDueToday,
  isOverdue,
  taskProgressPercent,
} from './workerHelpers'

type TabKey = 'today' | 'upcoming' | 'inspection' | 'rework' | 'completed' | 'overdue' | 'all'

export function MyTasksPage() {
  const [searchParams] = useSearchParams()
  const search = (searchParams.get('search') || '').trim().toLowerCase()
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [tab, setTab] = useState<TabKey>('today')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchMyTasks()
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load tasks.'),
      )
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return items
    return items.filter((t) => {
      const hay = `${t.name ?? ''} ${t.project_name ?? ''}`.toLowerCase()
      return hay.includes(search)
    })
  }, [items, search])

  const buckets = useMemo(() => {
    const today: typeof filtered = []
    const upcoming: typeof filtered = []
    const completed: typeof filtered = []
    const overdue: typeof filtered = []
    const inspection: typeof filtered = []
    const rework: typeof filtered = []
    for (const t of filtered) {
      const status = String(t.status)
      if (status === 'Completed' || status === 'Verified') {
        completed.push(t)
        continue
      }
      if (status === 'Ready for Review') {
        inspection.push(t)
        continue
      }
      if (status === 'Rework Required') {
        rework.push(t)
        continue
      }
      if (Boolean(t.is_overdue) || isOverdue(t.due_date, status)) {
        overdue.push(t)
        continue
      }
      if (isDueToday(t.due_date) || status === 'In Progress') {
        today.push(t)
        continue
      }
      upcoming.push(t)
    }
    return { today, upcoming, inspection, rework, completed, overdue, all: filtered }
  }, [filtered])

  const visible = buckets[tab]

  return (
    <AppShell>
      <PageHero
        title="My Tasks"
        subtitle={
          search
            ? `Results for “${searchParams.get('search')}”`
            : 'Stay on top of assigned site work.'
        }
      />

      <div className="panel-card">
        <FilterTabs
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
          options={[
            { value: 'today', label: `Today (${buckets.today.length})` },
            { value: 'upcoming', label: `Upcoming (${buckets.upcoming.length})` },
            { value: 'inspection', label: `Awaiting inspection (${buckets.inspection.length})` },
            { value: 'rework', label: `Rework (${buckets.rework.length})` },
            { value: 'completed', label: `Completed (${buckets.completed.length})` },
            { value: 'overdue', label: `Overdue (${buckets.overdue.length})` },
          ]}
        />

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {loading ? (
          <div className="loading-state">
            <Spinner animation="border" />
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-panel">
            <p>No tasks in this filter.</p>
          </div>
        ) : (
          <ul className="worker-task-list">
            {visible.map((t) => (
              <li key={String(t.id)}>
                <Link to={`/tasks/${t.id}`} className="worker-task-row worker-task-row--wide">
                  <span className="worker-task-icon" aria-hidden="true">
                    <i className="bi bi-clipboard-check" />
                  </span>
                  <span className="worker-task-meta">
                    <span className="worker-task-name">{String(t.name)}</span>
                    <span className="worker-task-sub">{String(t.project_name)}</span>
                    <ProgressBar value={taskProgressPercent(t.status)} />
                  </span>
                  <span className="worker-task-side">
                    <span className="worker-task-due">{formatDueLabel(t.due_date)}</span>
                    <StatusPill status={String(t.status)} />
                    <span className={`priority-chip priority-chip--${String(t.priority).toLowerCase()}`}>
                      {String(t.priority)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}
