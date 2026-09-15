import { NavLink, useLocation } from 'react-router-dom'
import { filterNavigation } from './navigation'
import { useAuth } from '../../context/AuthContext'

type SidebarProps = {
  open: boolean
  onClose: () => void
  phaseLabel?: string
  allowedNav: string[]
  onLogout?: () => void | Promise<void>
  loggingOut?: boolean
  unreadCount?: number
}

export function Sidebar({
  open,
  onClose,
  allowedNav,
  onLogout,
  loggingOut,
  unreadCount = 0,
}: SidebarProps) {
  const { user } = useAuth()
  const sections = filterNavigation(allowedNav)
  const location = useLocation()

  const initials = (user?.full_name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <aside
      className={`sidebar${open ? ' is-open' : ''}`}
      id="sidebar"
      aria-label="Primary navigation"
    >
      <div className="sidebar-brand">
        <NavLink to="/" className="brand-link" aria-label="CCMS home" onClick={onClose}>
          <span className="brand-mark" aria-hidden="true">
            <img src="/logo-mark.svg" alt="" width={32} height={32} />
          </span>
          <span className="brand-text-wrap">
            <span className="brand-text">CCMS</span>
            <span className="brand-sub">Construction Management</span>
          </span>
        </NavLink>
        <button
          type="button"
          className="sidebar-close d-lg-none"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      {user ? (
        <div className="sidebar-user">
          <span className="sidebar-user__avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="sidebar-user__meta">
            <span className="sidebar-user__name">{user.full_name}</span>
            <span className="sidebar-user__role">{user.role}</span>
          </span>
        </div>
      ) : null}

      <nav className="sidebar-nav" aria-label="Application modules">
        {sections.map((section) => (
          <div className="nav-section" key={section.label ?? 'main'}>
            {section.items.map((item) =>
              item.implemented && item.to ? (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className={({ isActive }) => {
                    const dashboardActive =
                      item.id === 'dashboard' &&
                      (location.pathname === '/' ||
                        location.pathname === '/admin' ||
                        location.pathname === '/pm' ||
                        location.pathname === '/se' ||
                        location.pathname === '/worker')
                    return `nav-item${isActive || dashboardActive ? ' is-active' : ''}`
                  }}
                  onClick={onClose}
                  end={item.to === '/'}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.id === 'notifications' && unreadCount > 0 ? (
                    <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  ) : null}
                </NavLink>
              ) : (
                <span
                  key={item.id}
                  className="nav-item is-disabled"
                  title="Coming soon"
                  aria-disabled="true"
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              ),
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {onLogout ? (
          <button
            type="button"
            className="nav-item sidebar-logout"
            onClick={() => {
              void onLogout()
            }}
            disabled={loggingOut}
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            <span>{loggingOut ? 'Signing out…' : 'Logout'}</span>
          </button>
        ) : null}
      </div>
    </aside>
  )
}
