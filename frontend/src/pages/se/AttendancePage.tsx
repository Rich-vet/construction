import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import {
  MetricCard,
  PageHero,
  StatusPill,
} from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import {
  fetchAttendance,
  fetchProjectWorkers,
  fetchSiteMeta,
  recordAttendance,
  type SiteMeta,
} from '../../api/site'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

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
  const [search, setSearch] = useState('')
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((a) => {
      const hay = `${a.worker_name ?? ''} ${a.project_name ?? ''} ${a.status ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, search])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todays = items.filter((a) => String(a.attendance_date) === today)
    const present = todays.filter((a) => String(a.status).toLowerCase() === 'present').length
    const absent = todays.filter((a) => String(a.status).toLowerCase() === 'absent').length
    const late = todays.filter((a) => String(a.status).toLowerCase() === 'late').length
    return {
      total: todays.length,
      present,
      absent,
      late,
    }
  }, [items])

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
    <AppShell>
      <PageHero
        title="Attendance"
        subtitle="View and manage site attendance for your assigned projects."
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="metric-grid metric-grid--4" aria-label="Attendance summary">
        <MetricCard label="Total Today" value={stats.total} icon="bi-people" tone="slate" />
        <MetricCard label="Present" value={stats.present} icon="bi-person-check" tone="green" />
        <MetricCard label="Absent" value={stats.absent} icon="bi-person-x" tone="red" />
        <MetricCard label="Late" value={stats.late} icon="bi-clock-history" tone="amber" />
      </section>

      <section className="panel-card mb-4">
        <h2 className="panel-title mb-3">Record attendance</h2>
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
              {(meta?.attendance_statuses ?? ['Present', 'Absent', 'Late']).map((s) => (
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
            <Button type="submit" className="btn-accent">
              Save attendance
            </Button>
          </div>
        </Form>
      </section>

      <section className="panel-card">
        <div className="panel-card__head">
          <h2 className="panel-title">Attendance records</h2>
          <Form.Control
            className="list-search"
            placeholder="Search worker or project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading-state">
            <Spinner animation="border" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-panel">
            <p>No attendance records yet.</p>
          </div>
        ) : (
          <Table responsive className="mb-0 data-table align-middle">
            <thead>
              <tr>
                <th>Member</th>
                <th>Project</th>
                <th>Date</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const name = String(a.worker_name ?? 'Worker')
                return (
                  <tr key={String(a.id)}>
                    <td>
                      <span className="person-cell">
                        <span className="person-avatar" aria-hidden="true">
                          {initials(name)}
                        </span>
                        <span className="person-cell__name">{name}</span>
                      </span>
                    </td>
                    <td>{String(a.project_name)}</td>
                    <td>{String(a.attendance_date)}</td>
                    <td>{String(a.check_in ?? '—')}</td>
                    <td>{String(a.check_out ?? '—')}</td>
                    <td>
                      <StatusPill status={String(a.status)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </section>
    </AppShell>
  )
}
