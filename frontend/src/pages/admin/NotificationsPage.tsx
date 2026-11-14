import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Spinner } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/auth'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../../api/notifications'

export function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const load = (nextPage = 1) => {
    setLoading(true)
    setError(null)
    fetchNotifications(nextPage)
      .then((data) => {
        setItems(data.items)
        setUnread(data.unread_count)
        setPage(data.page)
        setPages(data.pages)
        window.dispatchEvent(
          new CustomEvent('ccms:notifications-changed', {
            detail: { unread_count: data.unread_count },
          }),
        )
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

  const markAll = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      load(1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to mark all as read.')
    } finally {
      setMarkingAll(false)
    }
  }

  const openRelated = (note: NotificationItem) => {
    if (!note.link) return
    if (!note.is_read) {
      void markNotificationRead(note.id)
        .then(() => {
          window.dispatchEvent(
            new CustomEvent('ccms:notifications-changed', {
              detail: { unread_count: Math.max(unread - 1, 0) },
            }),
          )
        })
        .catch(() => {
          /* still open the related page */
        })
    }
    navigate(note.link)
  }

  return (
    <AppShell
      breadcrumb="System / Notifications"
      title="Notifications"
      phaseLabel={user?.role === 'Administrator' ? 'Admin' : user?.role?.split('/')[0] || 'App'}
    >
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <p className="text-muted mb-0">
          Unread: <strong>{unread}</strong>
        </p>
        {unread > 0 ? (
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={markingAll}
            onClick={() => void markAll()}
          >
            {markingAll ? 'Updating…' : 'Mark all read'}
          </Button>
        ) : null}
      </div>
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
              <li
                key={note.id}
                className={`${note.is_read ? 'is-read' : 'is-unread'}${note.link ? ' is-actionable' : ''}`}
                role={note.link ? 'link' : undefined}
                tabIndex={note.link ? 0 : undefined}
                onClick={() => openRelated(note)}
                onKeyDown={(event) => {
                  if (note.link && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    openRelated(note)
                  }
                }}
              >
                <div className="notification-list__main">
                  <div className="d-flex gap-2 align-items-center mb-1">
                    <strong>{note.title}</strong>
                    {!note.is_read ? <Badge bg="warning text-dark">Unread</Badge> : null}
                  </div>
                  <p className="mb-1">{note.message}</p>
                  <div className="small text-muted">
                    {note.created_at ? new Date(note.created_at).toLocaleString() : '—'}
                    {note.link ? ' · Open' : ''}
                  </div>
                </div>
                {!note.is_read ? (
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={busyId === note.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      void markRead(note.id)
                    }}
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
