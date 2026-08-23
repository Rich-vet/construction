import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

type AppShellProps = {
  breadcrumb: string
  title: string
  phaseLabel?: string
  children: ReactNode
}

export function AppShell({ breadcrumb, title, phaseLabel, children }: AppShellProps) {
  const { user, navigation, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    const onResize = () => {
      if (window.matchMedia('(min-width: 992px)').matches) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className={`app-frame${sidebarOpen ? ' sidebar-open' : ''}`} id="app-frame">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          phaseLabel={phaseLabel}
          allowedNav={navigation}
        />
        <div className="app-main">
          <Topbar
            breadcrumb={breadcrumb}
            title={title}
            onMenuClick={() => setSidebarOpen(true)}
            userName={user?.full_name}
            userRole={user?.role}
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
          <main id="main-content" className="app-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop is-visible"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
    </>
  )
}
