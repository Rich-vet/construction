import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppShell } from '../components/layout/AppShell'

export function HomePage() {
  const { user, navigation } = useAuth()

  if (user?.role === 'Administrator') {
    return <Navigate to="/admin" replace />
  }

  return (
    <AppShell breadcrumb="Home / Dashboard" title="Dashboard" phaseLabel="Phase 2">
      <section className="foundation-hero" aria-labelledby="welcome-heading">
        <div className="foundation-hero__grid" aria-hidden="true" />
        <div className="foundation-hero__content">
          <p className="eyebrow">Signed in</p>
          <h2 id="welcome-heading" className="foundation-title">
            Welcome, {user?.full_name}
          </h2>
          <p className="foundation-lead">
            You are signed in as <strong>{user?.role}</strong>. Your role-specific dashboard and
            modules will be enabled in upcoming phases. Only menu items allowed for your role are
            shown.
          </p>
        </div>
      </section>

      <section className="status-grid" aria-label="Session summary">
        <article className="status-card" style={{ ['--delay' as string]: '0ms' }}>
          <div className="status-card__icon" aria-hidden="true">
            <i className="bi bi-shield-check" />
          </div>
          <h3 className="status-card__title">Authentication</h3>
          <p className="status-card__text">Secure session active for {user?.email}.</p>
          <span className="badge-status is-ready">Active</span>
        </article>

        <article className="status-card" style={{ ['--delay' as string]: '60ms' }}>
          <div className="status-card__icon" aria-hidden="true">
            <i className="bi bi-person-badge" />
          </div>
          <h3 className="status-card__title">Role</h3>
          <p className="status-card__text">{user?.role}</p>
          <span className="badge-status is-ready">Assigned</span>
        </article>

        <article className="status-card" style={{ ['--delay' as string]: '120ms' }}>
          <div className="status-card__icon" aria-hidden="true">
            <i className="bi bi-list-check" />
          </div>
          <h3 className="status-card__title">Authorized modules</h3>
          <p className="status-card__text">
            {navigation.length} navigation areas visible for this role.
          </p>
          <span className="badge-status is-ready">{navigation.length}</span>
        </article>
      </section>
    </AppShell>
  )
}
