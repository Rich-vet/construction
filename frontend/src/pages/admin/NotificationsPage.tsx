import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  fetchNotifications,
  markNotificationRead,
  type NotificationItem,
} from '../../api/admin'

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = (nextPage = 1) => {
    setLoading(true)
    setError(null)
    fetchNotifications(nextPage)
      .then((data) => {
        setItems(data.items)
        setUnread(data.unread_count)
        setPage(data.page)
        setPages(data.pages)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load notifications.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(1)
  }, [])

  const markRead = async (id: number) => {
    setBusyId(id)
    try {
      await markNotificationRead(id)
      load(page)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update notification.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell breadcrumb="System / Notifications" title="Notifications" phaseLabel="Admin">
      <p className="text-muted mb-3">
        Unread: <strong>{unread}</strong>
      </p>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>You have no notifications yet.</p>
        </div>
      ) : (
        <>
          <ul className="notification-list">
            {items.map((note) => (
              <li key={note.id} className={note.is_read ? 'is-read' : 'is-unread'}>
                <div className="notification-list__main">
                  <div className="d-flex gap-2 align-items-center mb-1">
                    <strong>{note.title}</strong>
                    {!note.is_read ? <Badge bg="warning text-dark">Unread</Badge> : null}
                  </div>
                  <p className="mb-1">{note.message}</p>
                  <div className="small text-muted">{note.created_at}</div>
                  {note.link ? (
                    <Link to={note.link} className="small">
                      Open related record
                    </Link>
                  ) : null}
                </div>
                {!note.is_read ? (
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={busyId === note.id}
                    onClick={() => void markRead(note.id)}
                  >
                    Mark read
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="pager">
            <div className="pager-controls">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {Math.max(pages, 1)}
              </span>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={page >= pages}
                onClick={() => load(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
