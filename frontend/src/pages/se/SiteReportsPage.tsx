import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  createSiteReport,
  fetchSiteMeta,
  fetchSiteReports,
  type SiteMeta,
} from '../../api/site'

export function SiteReportsPage() {
  const [meta, setMeta] = useState<SiteMeta | null>(null)
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [projectId, setProjectId] = useState('')
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [workersPresent, setWorkersPresent] = useState('')
  const [activities, setActivities] = useState('')
  const [materialsUsed, setMaterialsUsed] = useState('')
  const [equipmentUsed, setEquipmentUsed] = useState('')
  const [problems, setProblems] = useState('')
  const [safety, setSafety] = useState('')
  const [nextActivities, setNextActivities] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchSiteMeta(), fetchSiteReports()])
      .then(([m, r]) => {
        setMeta(m)
        setItems(r.items)
        if (!projectId && m.projects[0]) setProjectId(String(m.projects[0].id))
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load site reports.'),
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
      await createSiteReport({
        project_id: Number(projectId),
        report_date: reportDate,
        workers_present: workersPresent ? Number(workersPresent) : null,
        activities_completed: activities || null,
        materials_used: materialsUsed || null,
        equipment_used: equipmentUsed || null,
        problems: problems || null,
        safety_observations: safety || null,
        next_activities: nextActivities || null,
      })
      setMessage('Site report submitted.')
      setActivities('')
      setMaterialsUsed('')
      setEquipmentUsed('')
      setProblems('')
      setSafety('')
      setNextActivities('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit report.')
    }
  }

  return (
    <AppShell breadcrumb="Progress / Site Reports" title="Site reports" phaseLabel="SE">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="panel-card mb-4">
        <h2 className="section-title">Daily / site report</h2>
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
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Workers present</Form.Label>
            <Form.Control
              type="number"
              min="0"
              value={workersPresent}
              onChange={(e) => setWorkersPresent(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Activities completed</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Materials used</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Equipment used</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={equipmentUsed}
              onChange={(e) => setEquipmentUsed(e.target.value)}
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
            <Form.Label>Safety observations</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={safety}
              onChange={(e) => setSafety(e.target.value)}
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
            <Button type="submit">Submit report</Button>
          </div>
        </Form>
      </section>

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No site reports yet.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Workers</th>
                <th>Activities</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={String(r.id)}>
                  <td>{String(r.report_date)}</td>
                  <td>{String(r.project_name)}</td>
                  <td>{String(r.workers_present ?? '—')}</td>
                  <td>{String(r.activities_completed ?? '—')}</td>
                  <td>{String(r.created_by_name ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
