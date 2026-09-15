import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppShell } from '../components/layout/AppShell'

export function HomePage() {
  const { user } = useAuth()

  if (user?.role === 'Administrator') {
    return <Navigate to="/admin" replace />
  }

  if (user?.role === 'Project Manager') {
    return <Navigate to="/pm" replace />
  }

  if (user?.role === 'Site Engineer') {
    return <Navigate to="/se" replace />
  }

  if (user?.role === 'Contractor/Worker') {
    return <Navigate to="/worker" replace />
  }

  return (
    <AppShell>
      <section className="foundation-hero" aria-labelledby="welcome-heading">
        <div className="foundation-hero__grid" aria-hidden="true" />
        <div className="foundation-hero__content">
          <p className="eyebrow">Signed in</p>
          <h2 id="welcome-heading" className="foundation-title">
            Welcome, {user?.full_name}
          </h2>
          <p className="foundation-lead">
            You are signed in as <strong>{user?.role}</strong>. Your role-specific dashboard and
            modules are available from the sidebar.
          </p>
        </div>
      </section>
    </AppShell>
  )
}
