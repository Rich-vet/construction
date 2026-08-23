import { NavLink, useLocation } from 'react-router-dom'
import { filterNavigation } from './navigation'

type SidebarProps = {
  open: boolean
  onClose: () => void
  phaseLabel?: string
  allowedNav: string[]
}

export function Sidebar({ open, onClose, phaseLabel = 'Phase 2', allowedNav }: SidebarProps) {
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
          <img src="/logo.svg" alt="" className="brand-logo" width={140} height={36} />
          <span className="visually-hidden">CCMS</span>
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
            {section.label ? <p className="nav-section-label">{section.label}</p> : null}
            {section.items.map((item) =>
              item.implemented && item.to ? (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className={({ isActive }) => {
                    const dashboardActive =
                      item.id === 'dashboard' &&
                      (location.pathname === '/' || location.pathname === '/admin')
                    return `nav-item${isActive || dashboardActive ? ' is-active' : ''}`
                  }}
                  onClick={onClose}
                  end={item.to === '/'}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ) : (
                <span
                  key={item.id}
                  className="nav-item is-disabled"
                  title="Available in a later phase"
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
        <p className="sidebar-meta">{phaseLabel}</p>
      </div>
    </aside>
  )
}
