import type { ReactNode } from 'react'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-brand">
          <img src="/logo.svg" alt="CCMS" className="auth-logo" width={180} height={46} />
          <p className="auth-brand-tag">Construction Company Management System</p>
        </div>
        <div className="auth-card">
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </div>
      <div className="auth-aside" aria-hidden="true">
        <div className="auth-aside-grid" />
        <p className="auth-aside-copy">Built for site control, structure, and accountability.</p>
      </div>
    </div>
  )
}
