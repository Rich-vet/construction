import { useEffect, useMemo, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/ui/Feedback'
import {
  FilterTabs,
  PageHero,
  ProgressBar,
  StatusPill,
} from '../../components/ui/PageChrome'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/auth'
import { fetchProjects, type ProjectSummary } from '../../api/projects'

export function ProjectsListPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const canCreate = user?.role === 'Administrator' || user?.role === 'Project Manager'
  const [items, setItems] = useState<ProjectSummary[]>([])
  const [tab, setTab] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const search = searchParams.get('search') || ''

  useEffect(() => {
    setLoading(true)
    fetchProjects({ search: search || undefined })
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load projects.'),
      )
      .finally(() => setLoading(false))
  }, [search])

  const filtered = useMemo(() => {
    if (tab === 'All') return items
    if (tab === 'Delayed') {
      return items.filter((p) => p.status === 'On Hold' || p.status === 'Cancelled')
    }
    return items.filter((p) => p.status === tab)
  }, [items, tab])

  return (
    <AppShell>
      <PageHero
        title="Projects"
        subtitle={search ? `Results for “${search}”` : 'Track progress across every site.'}
        actions={
          canCreate ? (
            <Link to="/projects/create" className="btn btn-accent">
              <i className="bi bi-plus-lg me-1" aria-hidden="true" />
              New Project
            </Link>
          ) : null
        }
      />

      <div className="panel-card">
        <FilterTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'All', label: 'All' },
            { value: 'Active', label: 'Active' },
            { value: 'Completed', label: 'Completed' },
            { value: 'Delayed', label: 'Delayed' },
          ]}
        />

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {loading ? (
          <div className="loading-state">
            <Spinner animation="border" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="bi-building"
            title={search ? 'No matching projects' : 'No projects yet'}
            description={
              canCreate
                ? 'Create a project to start planning budget, tasks, and site work.'
                : 'No projects are assigned to you yet.'
            }
            action={
              canCreate ? (
                <Link to="/projects/create" className="btn btn-accent">
                  Create Project
                </Link>
              ) : null
            }
          />
        ) : (
          <ul className="project-card-list">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="project-card-row">
                  <span className="project-overview-thumb" aria-hidden="true">
                    <i className="bi bi-building" />
                  </span>
                  <span className="project-card-main">
                    <span className="project-overview-name">{p.name}</span>
                    <span className="project-overview-sub">
                      {p.location} · {p.client_name}
                    </span>
                    <ProgressBar value={p.progress} />
                  </span>
                  <span className="project-card-meta">
                    <StatusPill status={p.status} />
                    <span className="project-card-dates">
                      {p.start_date || '—'} → {p.expected_completion || '—'}
                    </span>
                    <span className="project-card-budget">K{Number(p.budget).toLocaleString()}</span>
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
