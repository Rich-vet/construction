import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  createProgressUpdate,
  fetchProgressUpdates,
  fetchSiteMeta,
  type SiteMeta,
} from '../../api/site'

export function ProgressUpdatesPage() {
  const [meta, setMeta] = useState<SiteMeta | null>(null)
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [projectId, setProjectId] = useState('')
  const [updateDate, setUpdateDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [work, setWork] = useState('')
  const [percentage, setPercentage] = useState('0')
  const [problems, setProblems] = useState('')
  const [nextActivities, setNextActivities] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchSiteMeta(), fetchProgressUpdates()])
      .then(([m, p]) => {
        setMeta(m)
        setItems(p.items)
        if (!projectId && m.projects[0]) setProjectId(String(m.projects[0].id))
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load progress updates.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await createProgressUpdate({
        project_id: Number(projectId),
        update_date: updateDate,
        work_completed: work,
        percentage: Number(percentage),
        problems: problems || null,
        next_activities: nextActivities || null,
      })
      setMessage('Progress update submitted.')
      setWork('')
      setProblems('')
      setNextActivities('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit update.')
    }
  }

  return (
    <AppShell breadcrumb="Progress / Updates" title="Progress updates" phaseLabel="SE">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="panel-card mb-4">
        <h2 className="section-title">Submit progress update</h2>
        <Form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          <Form.Group>
            <Form.Label>Project</Form.Label>
            <Form.Select required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Select</option>
              {(meta?.projects ?? []).map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              required
              value={updateDate}
              onChange={(e) => setUpdateDate(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Overall %</Form.Label>
            <Form.Control
              type="number"
              min="0"
              max="100"
              required
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Work completed</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              required
              value={work}
              onChange={(e) => setWork(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Problems</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Next activities</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={nextActivities}
              onChange={(e) => setNextActivities(e.target.value)}
            />
          </Form.Group>
          <div className="form-grid__full">
            <Button type="submit">Submit update</Button>
          </div>
        </Form>
      </section>

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No progress updates yet.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>%</th>
                <th>Work completed</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={String(u.id)}>
                  <td>{String(u.update_date)}</td>
                  <td>{String(u.project_name)}</td>
                  <td>{String(u.percentage)}</td>
                  <td>{String(u.work_completed)}</td>
                  <td>{String(u.created_by_name ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
