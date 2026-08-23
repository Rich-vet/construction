import type { ReactNode } from 'react'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="auth-screen">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-grid" />
        <div className="auth-aside-beam" />
        <div className="auth-aside-content">
          <p className="auth-aside-kicker">Site operations</p>
          <p className="auth-aside-copy">
            Built for site control, structure, and accountability.
          </p>
        </div>
      </aside>

      <div className="auth-panel">
        <div className="auth-brand">
          <img src="/logo.svg" alt="" className="auth-logo" width={200} height={52} />
          <h1 className="auth-brand-name">CCMS</h1>
          <p className="auth-brand-tag">Construction Company Management System</p>
        </div>
        <div className="auth-card">
          <h2 className="auth-title">{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
