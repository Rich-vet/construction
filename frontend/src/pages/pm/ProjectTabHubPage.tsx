import { useEffect, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { PageHero } from '../../components/ui/PageChrome'
import { EmptyState, StatusBadge } from '../../components/ui/Feedback'
import { ApiError } from '../../api/auth'
import { fetchProjects, type ProjectSummary } from '../../api/projects'

const TAB_COPY: Record<
  string,
  { title: string; subtitle: string; icon: string; empty: string }
> = {
  milestones: {
    title: 'Milestones',
    subtitle: 'Open a project to manage milestone targets and completion.',
    icon: 'bi-flag',
    empty: 'Create a project first, then add milestones from its workspace.',
  },
  budget: {
    title: 'Budgets',
    subtitle: 'Open a project Budget tab to propose or approve category amounts.',
    icon: 'bi-wallet2',
    empty: 'Create a project first to allocate category budgets.',
  },
  expenses: {
    title: 'Expenses',
    subtitle: 'Open a project Expenses tab to submit and approve spend.',
    icon: 'bi-cash-stack',
    empty: 'Create a project first to record expenses.',
  },
}

export function ProjectTabHubPage({ tab }: { tab: 'milestones' | 'budget' | 'expenses' }) {
  const copy = TAB_COPY[tab]
  const [items, setItems] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchProjects()
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load projects.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <PageHero
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <Link to="/projects" className="btn btn-outline-secondary">
            All projects
          </Link>
        }
      />

      <div className="panel-card">
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {loading ? (
          <div className="loading-state">
            <Spinner animation="border" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={copy.icon}
            title={`No projects for ${copy.title.toLowerCase()}`}
            description={copy.empty}
            action={
              <Link to="/projects/create" className="btn btn-accent">
                New project
              </Link>
            }
          />
        ) : (
          <ul className="hub-project-list">
            {items.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}?tab=${tab}`} className="hub-project-link">
                  <span className="hub-project-link__main">
                    <i className={`bi ${copy.icon}`} aria-hidden="true" />
                    <span>
                      <strong>{p.name}</strong>
                      <span className="hub-project-link__meta">{p.location}</span>
                    </span>
                  </span>
                  <StatusBadge status={p.status} />
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}
