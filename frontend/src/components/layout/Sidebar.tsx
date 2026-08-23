import { NavLink } from 'react-router-dom'
import { navigation } from './navigation'

type SidebarProps = {
  open: boolean
  onClose: () => void
  phaseLabel?: string
}

export function Sidebar({ open, onClose, phaseLabel = 'Phase 1' }: SidebarProps) {
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
        {navigation.map((section) => (
          <div className="nav-section" key={section.label ?? 'main'}>
            {section.label ? <p className="nav-section-label">{section.label}</p> : null}
            {section.items.map((item) =>
              item.disabled || !item.to ? (
                <span
                  key={item.label}
                  className="nav-item is-disabled"
                  title="Available in a later phase"
                  aria-disabled="true"
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
                  onClick={onClose}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ),
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="sidebar-meta">{phaseLabel} · Foundation</p>
      </div>
    </aside>
  )
}
