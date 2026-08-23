import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/auth'
import { fetchProjects, type ProjectSummary } from '../../api/projects'

export function ProjectsListPage() {
  const { user } = useAuth()
  const canCreate = user?.role === 'Administrator' || user?.role === 'Project Manager'
  const phase = user?.role === 'Site Engineer' ? 'SE' : 'PM'
  const [items, setItems] = useState<ProjectSummary[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchProjects({ search, status })
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load projects.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppShell breadcrumb="Projects" title="Projects" phaseLabel={phase}>
      <div className="page-toolbar">
        <Form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <Form.Control
            placeholder="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['Planned', 'Active', 'On Hold', 'Completed', 'Cancelled'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Form.Select>
          <Button type="submit" variant="primary">
            Filter
          </Button>
        </Form>
        {canCreate ? (
          <Link to="/projects/create" className="btn btn-primary">
            Create project
          </Link>
        ) : null}
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>
            {canCreate
              ? 'No projects have been created yet.'
              : 'No projects are assigned to you yet.'}
          </p>
          {canCreate ? (
            <Link to="/projects/create" className="btn btn-primary">
              Create Project
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Location</th>
                <th>Manager</th>
                <th>Progress</th>
                <th>Budget</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.client_name}</td>
                  <td>{p.location}</td>
                  <td>{p.project_manager_name}</td>
                  <td>{p.progress}%</td>
                  <td>K{Number(p.budget).toLocaleString()}</td>
                  <td>
                    <Badge bg="secondary">{p.status}</Badge>
                  </td>
                  <td>
                    <Link to={`/projects/${p.id}`} className="btn btn-sm btn-outline-secondary">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
