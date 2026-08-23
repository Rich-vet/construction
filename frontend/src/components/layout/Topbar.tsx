import { Link } from 'react-router-dom'

type TopbarProps = {
  breadcrumb: string
  title: string
  onMenuClick: () => void
  userName?: string
  userRole?: string
  unreadCount?: number
  onLogout?: () => void
  loggingOut?: boolean
}

export function Topbar({
  breadcrumb,
  title,
  onMenuClick,
  userName,
  userRole,
  unreadCount = 0,
  onLogout,
  loggingOut,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn d-lg-none"
          aria-label="Open navigation"
          aria-controls="sidebar"
          onClick={onMenuClick}
        >
          <i className="bi bi-list" aria-hidden="true" />
        </button>
        <div className="page-heading">
          <p className="breadcrumb-trail">{breadcrumb}</p>
          <h1 className="page-title">{title}</h1>
        </div>
      </div>

      <div className="topbar-right">
        <Link
          to="/notifications"
          className="icon-btn topbar-notify"
          aria-label={
            unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'
          }
          title="Notifications"
        >
          <i className="bi bi-bell" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="topbar-notify__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          ) : null}
        </Link>
        {userName ? (
          <>
            <span className="status-chip" title={userRole}>
              <i className="bi bi-person-circle" aria-hidden="true" />
              {userName}
            </span>
            {onLogout ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onLogout}
                disabled={loggingOut}
              >
                {loggingOut ? 'Signing out…' : 'Logout'}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  )
}
