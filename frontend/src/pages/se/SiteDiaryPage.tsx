import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { FilterTabs, PageHero } from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import {
  createSiteDiary,
  fetchProgressUpdates,
  fetchSiteMeta,
  fetchSiteReports,
  type SiteMeta,
} from '../../api/site'

/**
 * Authoritative Site Diary UI — one form dual-writes progress + site report.
 * Legacy /progress-updates and /site-reports redirect here.
 */
export function SiteDiaryPage() {
  const [searchParams] = useSearchParams()
  const preselected = searchParams.get('project_id') || ''
  const [meta, setMeta] = useState<SiteMeta | null>(null)
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [updates, setUpdates] = useState<Array<Record<string, unknown>>>([])
  const [projectId, setProjectId] = useState(preselected)
  const [diaryDate, setDiaryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [workersPresent, setWorkersPresent] = useState('')
  const [activities, setActivities] = useState('')
  const [percentage, setPercentage] = useState('0')
  const [materialsUsed, setMaterialsUsed] = useState('')
  const [equipmentUsed, setEquipmentUsed] = useState('')
  const [problems, setProblems] = useState('')
  const [safety, setSafety] = useState('')
  const [nextActivities, setNextActivities] = useState('')
  const [historyTab, setHistoryTab] = useState<'diary' | 'progress'>('diary')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchSiteMeta(), fetchSiteReports(), fetchProgressUpdates()])
      .then(([m, r, p]) => {
        setMeta(m)
        setReports(r.items)
        setUpdates(p.items)
        if (!projectId && m.projects[0]) setProjectId(String(m.projects[0].id))
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load site diary.'),
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
      await createSiteDiary({
        project_id: Number(projectId),
        diary_date: diaryDate,
        workers_present: workersPresent ? Number(workersPresent) : null,
        activities_completed: activities,
        percentage: Number(percentage),
        materials_used: materialsUsed || null,
        equipment_used: equipmentUsed || null,
        problems: problems || null,
        safety_observations: safety || null,
        next_activities: nextActivities || null,
      })
      setMessage('Site diary submitted. Progress and daily report were recorded together.')
      setActivities('')
      setMaterialsUsed('')
      setEquipmentUsed('')
      setProblems('')
      setSafety('')
      setNextActivities('')
      setPercentage('0')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit site diary.')
    }
  }

  return (
    <AppShell>
      <PageHero
        title="Site Diary"
        subtitle="One entry for daily activities, progress %, materials, safety, and next steps."
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="panel-card mb-4">
        <h2 className="panel-title">New diary entry</h2>
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
              value={diaryDate}
              onChange={(e) => setDiaryDate(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Workers present</Form.Label>
            <Form.Control
              type="number"
              min={0}
              value={workersPresent}
              onChange={(e) => setWorkersPresent(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Overall progress %</Form.Label>
            <Form.Control
              type="number"
              min={0}
              max={100}
              step={1}
              required
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Activities completed *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              required
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              placeholder="What was completed on site today?"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Materials used</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Equipment used</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={equipmentUsed}
              onChange={(e) => setEquipmentUsed(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Problems / delays</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
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
            <Button type="submit" className="btn-primary">
              Submit Site Diary
            </Button>
          </div>
        </Form>
      </section>

      <section className="panel-card">
        <div className="panel-card__head">
          <h2 className="panel-title">History</h2>
        </div>
        <FilterTabs
          value={historyTab}
          onChange={(v) => setHistoryTab(v as 'diary' | 'progress')}
          options={[
            { value: 'diary', label: `Diary (${reports.length})` },
            { value: 'progress', label: `Progress posts (${updates.length})` },
          ]}
        />
        {loading ? (
          <div className="loading-state">
            <Spinner animation="border" />
          </div>
        ) : historyTab === 'diary' ? (
          reports.length === 0 ? (
            <p className="empty-hint">No diary entries yet.</p>
          ) : (
            <Table responsive hover size="sm" className="mb-0 data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Workers</th>
                  <th>Activities</th>
                  <th>By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={String(r.id)}>
                    <td>{String(r.report_date)}</td>
                    <td>{String(r.project_name)}</td>
                    <td>{String(r.workers_present ?? '—')}</td>
                    <td>{String(r.activities_completed ?? '—')}</td>
                    <td>{String(r.created_by_name ?? '—')}</td>
                    <td>
                      <Link to={`/projects/${r.project_id}?tab=site`}>Open project</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        ) : updates.length === 0 ? (
          <p className="empty-hint">No progress posts yet.</p>
        ) : (
          <Table responsive hover size="sm" className="mb-0 data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>%</th>
                <th>Work</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {updates.map((u) => (
                <tr key={String(u.id)}>
                  <td>{String(u.update_date)}</td>
                  <td>{String(u.project_name)}</td>
                  <td>{String(u.percentage)}%</td>
                  <td>{String(u.work_completed)}</td>
                  <td>{String(u.created_by_name ?? '—')}</td>
                  <td>
                    <Link to={`/projects/${u.project_id}?tab=site`}>Open project</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </AppShell>
  )
}
