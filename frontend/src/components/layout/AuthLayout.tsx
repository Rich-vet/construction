import { useState, type ReactNode } from 'react'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
  showSitePhoto?: boolean
}

export function AuthLayout({ title, subtitle, children, showSitePhoto = false }: AuthLayoutProps) {
  const [photoReady, setPhotoReady] = useState(showSitePhoto)

  return (
    <div className="auth-screen">
      {photoReady ? (
        <aside className="auth-aside auth-aside--photo">
          <img
            className="auth-aside-photo"
            src="/main_construction_site.jpg"
            alt=""
            onError={() => setPhotoReady(false)}
          />
          <div className="auth-aside-overlay" />
          <div className="auth-aside-content">
            <p className="auth-aside-kicker">CCMS</p>
            <p className="auth-aside-copy">Building Projects. Managing Progress.</p>
          </div>
        </aside>
      ) : (
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
      )}

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
