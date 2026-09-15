import { NavLink, useLocation } from 'react-router-dom'
import { filterNavigation } from './navigation'

type SidebarProps = {
  open: boolean
  onClose: () => void
  phaseLabel?: string
  allowedNav: string[]
  onLogout?: () => void
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
  const sections = filterNavigation(allowedNav)
  const location = useLocation()

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
          <span className="brand-text">CCMS</span>
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
                        location.pathname === '/pm')
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
            onClick={onLogout}
            disabled={loggingOut}
          >
            <i className="bi bi-box-arrow-left" aria-hidden="true" />
            <span>{loggingOut ? 'Signing out…' : 'Logout'}</span>
          </button>
        ) : null}
      </div>
    </aside>
  )
}
