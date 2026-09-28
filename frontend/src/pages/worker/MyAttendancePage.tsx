import { useEffect, useMemo, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { PageHero, StatusPill } from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import { fetchMyAttendance } from '../../api/worker'

function isToday(dateStr: unknown): boolean {
  if (!dateStr) return false
  const d = new Date(String(dateStr))
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
}

function formatTime(value: unknown): string {
  if (!value) return '—'
  const s = String(value)
  // Already a time string like 07:34:00 or ISO
  if (/^\d{1,2}:\d{2}/.test(s)) {
    const [h, m] = s.split(':')
    const hour = Number(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function MyAttendancePage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMyAttendance()
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load attendance.'),
      )
      .finally(() => setLoading(false))
  }, [])

  const today = useMemo(() => items.find((a) => isToday(a.attendance_date)) ?? null, [items])
  const checkedIn = Boolean(today && today.check_in)

  return (
    <AppShell>
      <PageHero
        title="Attendance"
        subtitle="Your site check-in history. Records are entered by your site engineer."
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : (
        <>
          <div className="attendance-today-grid">
            <section className="panel-card attendance-status-card">
              <div className={`attendance-clock${checkedIn ? ' is-in' : ''}`}>
                <i className="bi bi-clock-history" aria-hidden="true" />
              </div>
              <p className="attendance-status-label">
                {checkedIn ? 'Checked in today' : 'Not checked in today'}
              </p>
              <p className="attendance-status-time">
                {checkedIn ? formatTime(today?.check_in) : '—'}
              </p>
              {today?.check_out ? (
                <p className="attendance-status-sub">
                  Check out: {formatTime(today.check_out)}
                </p>
              ) : (
                <p className="attendance-status-sub">
                  {checkedIn
                    ? 'Waiting for check-out from site engineer'
                    : 'Ask your site engineer to record attendance'}
                </p>
              )}
            </section>

            <section className="panel-card">
              <h2 className="panel-title">Today&apos;s Status</h2>
              {today ? (
                <dl className="today-status-dl">
                  <div>
                    <dt>Project</dt>
                    <dd>{String(today.project_name)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusPill status={String(today.status)} />
                    </dd>
                  </div>
                  <div>
                    <dt>Check in</dt>
                    <dd>{formatTime(today.check_in)}</dd>
                  </div>
                  <div>
                    <dt>Check out</dt>
                    <dd>{formatTime(today.check_out)}</dd>
                  </div>
                  {today.notes ? (
                    <div>
                      <dt>Notes</dt>
                      <dd>{String(today.notes)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="empty-hint">No attendance recorded for today yet.</p>
              )}
            </section>
          </div>

          <section className="panel-card">
            <div className="panel-card__head">
              <h2 className="panel-title">Attendance History</h2>
            </div>
            {items.length === 0 ? (
              <p className="empty-hint">No attendance has been recorded for you yet.</p>
            ) : (
              <div className="table-panel table-panel--flush">
                <Table responsive hover className="mb-0 data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Project</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => (
                      <tr key={String(a.id)}>
                        <td>{String(a.attendance_date)}</td>
                        <td>{formatTime(a.check_in)}</td>
                        <td>{formatTime(a.check_out)}</td>
                        <td>{String(a.project_name)}</td>
                        <td>
                          <StatusPill status={String(a.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  )
}
