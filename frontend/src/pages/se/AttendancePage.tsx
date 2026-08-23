import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  fetchAttendance,
  fetchProjectWorkers,
  fetchSiteMeta,
  recordAttendance,
  type SiteMeta,
} from '../../api/site'

export function AttendancePage() {
  const [meta, setMeta] = useState<SiteMeta | null>(null)
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [workers, setWorkers] = useState<Array<Record<string, unknown>>>([])
  const [projectId, setProjectId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [status, setStatus] = useState('Present')
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchSiteMeta(),
      fetchAttendance(projectId ? { project_id: Number(projectId) } : undefined),
    ])
      .then(([m, a]) => {
        setMeta(m)
        setItems(a.items)
        if (!projectId && m.projects[0]) {
          setProjectId(String(m.projects[0].id))
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load attendance.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!projectId) {
      setWorkers([])
      return
    }
    fetchProjectWorkers(Number(projectId))
      .then((data) => setWorkers(data.items))
      .catch(() => setWorkers([]))
  }, [projectId])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await recordAttendance({
        project_id: Number(projectId),
        worker_user_id: Number(workerId),
        status,
        attendance_date: attendanceDate,
        check_in: checkIn || null,
        check_out: checkOut || null,
        notes: notes || null,
      })
      setMessage('Attendance recorded.')
      setNotes('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to record attendance.')
    }
  }

  return (
    <AppShell breadcrumb="People / Attendance" title="Attendance" phaseLabel="SE">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="panel-card mb-4">
        <h2 className="section-title">Record attendance</h2>
        <Form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          <Form.Group>
            <Form.Label>Project</Form.Label>
            <Form.Select
              required
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                setWorkerId('')
              }}
            >
              <option value="">Select project</option>
              {(meta?.projects ?? []).map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Worker</Form.Label>
            <Form.Select required value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">Select worker</option>
              {workers.map((w) => (
                <option key={String(w.user_id)} value={String(w.user_id)}>
                  {String(w.full_name)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              required
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Status</Form.Label>
            <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {(meta?.attendance_statuses ?? ['Present']).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Check in</Form.Label>
            <Form.Control value={checkIn} onChange={(e) => setCheckIn(e.target.value)} placeholder="07:30" />
          </Form.Group>
          <Form.Group>
            <Form.Label>Check out</Form.Label>
            <Form.Control
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              placeholder="17:00"
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Notes</Form.Label>
            <Form.Control value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Form.Group>
          <div className="form-grid__full">
            <Button type="submit" variant="primary">
              Save attendance
            </Button>
          </div>
        </Form>
      </section>

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No attendance records yet.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Worker</th>
                <th>Status</th>
                <th>In</th>
                <th>Out</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={String(a.id)}>
                  <td>{String(a.attendance_date)}</td>
                  <td>{String(a.project_name)}</td>
                  <td>{String(a.worker_name)}</td>
                  <td>{String(a.status)}</td>
                  <td>{String(a.check_in ?? '—')}</td>
                  <td>{String(a.check_out ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
