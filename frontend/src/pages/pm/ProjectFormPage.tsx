import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  createProject,
  fetchProjectMeta,
  fetchProjectWorkspace,
  updateProject,
} from '../../api/projects'

type Mode = 'create' | 'edit'

export function ProjectFormPage({ mode }: { mode: Mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const projectId = id ? Number(id) : null

  const [users, setUsers] = useState<
    Array<{ id: number; full_name: string; email: string; role: string }>
  >([])
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [expected, setExpected] = useState('')
  const [budget, setBudget] = useState('0')
  const [status, setStatus] = useState('Planned')
  const [engineerId, setEngineerId] = useState('')
  const [loading, setLoading] = useState(mode === 'edit')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjectMeta()
      .then((meta) => setUsers(meta.assignable_users))
      .catch(() => undefined)

    if (mode === 'edit' && projectId) {
      fetchProjectWorkspace(projectId)
        .then((ws) => {
          const p = ws.project as Record<string, unknown>
          setName(String(p.name ?? ''))
          setClientName(String(p.client_name ?? ''))
          setClientPhone(String(p.client_phone ?? ''))
          setClientEmail(String(p.client_email ?? ''))
          setLocation(String(p.location ?? ''))
          setDescription(String(p.description ?? ''))
          setStartDate(String(p.start_date ?? ''))
          setExpected(String(p.expected_completion ?? ''))
          setBudget(String(p.budget ?? '0'))
          setStatus(String(p.status ?? 'Planned'))
          setEngineerId(p.site_engineer_id ? String(p.site_engineer_id) : '')
        })
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : 'Unable to load project.'),
        )
        .finally(() => setLoading(false))
    }
  }, [mode, projectId])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const payload = {
      name,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      location,
      description,
      start_date: startDate || null,
      expected_completion: expected || null,
      budget: Number(budget || 0),
      status,
      site_engineer_id: engineerId ? Number(engineerId) : null,
    }
    try {
      if (mode === 'create') {
        const result = await createProject(payload)
        navigate(`/projects/${result.project.id}`)
      } else if (projectId) {
        await updateProject(projectId, payload)
        navigate(`/projects/${projectId}`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save project.')
    } finally {
      setSubmitting(false)
    }
  }

  const engineers = users.filter((u) => u.role === 'Site Engineer')

  return (
    <AppShell
      breadcrumb={mode === 'create' ? 'Projects / Create' : 'Projects / Edit'}
      title={mode === 'create' ? 'Create project' : 'Edit project'}
      phaseLabel="PM"
    >
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="form-panel">
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Project name *</Form.Label>
              <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
            </Form.Group>
            <div className="row">
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Client name *</Form.Label>
                  <Form.Control
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Client phone</Form.Label>
                  <Form.Control
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Client email</Form.Label>
                  <Form.Control
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-3">
              <Form.Label>Location *</Form.Label>
              <Form.Control
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Form.Group>
            <div className="row">
              <div className="col-md-3">
                <Form.Group className="mb-3">
                  <Form.Label>Start date</Form.Label>
                  <Form.Control
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group className="mb-3">
                  <Form.Label>Expected completion</Form.Label>
                  <Form.Control
                    type="date"
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group className="mb-3">
                  <Form.Label>Budget (K)</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {['Planned', 'Active', 'On Hold', 'Completed', 'Cancelled'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-4">
              <Form.Label>Site engineer</Form.Label>
              <Form.Select value={engineerId} onChange={(e) => setEngineerId(e.target.value)}>
                <option value="">Not assigned</option>
                {engineers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
              <Link to="/projects" className="btn btn-outline-secondary">
                Cancel
              </Link>
            </div>
          </Form>
        </div>
      )}
    </AppShell>
  )
}
