import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

type TopbarProps = {
  onMenuClick: () => void
  userName?: string
  userRole?: string
  unreadCount?: number
  searchPlaceholder?: string
  searchTo?: string
}

export function Topbar({
  onMenuClick,
  userName,
  userRole,
  unreadCount = 0,
  searchPlaceholder = 'Search projects, tasks, materials…',
  searchTo = '/projects',
}: TopbarProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (!q) return
    navigate(`${searchTo}?search=${encodeURIComponent(q)}`)
  }

  const initials = (userName || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

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
        <form className="topbar-search" onSubmit={onSearch} role="search">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
          />
        </form>
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
          {unreadCount > 0 ? <span className="topbar-notify__dot" aria-hidden="true" /> : null}
        </Link>
        {userName ? (
          <div className="topbar-user" title={userRole}>
            <span className="topbar-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="topbar-user-meta">
              <span className="topbar-user-name">{userName}</span>
              <span className="topbar-user-role">{userRole}</span>
            </span>
          </div>
        ) : null}
      </div>
    </header>
  )
}
