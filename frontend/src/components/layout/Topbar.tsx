type TopbarProps = {
  breadcrumb: string
  title: string
  onMenuClick: () => void
  authPending?: boolean
}

export function Topbar({ breadcrumb, title, onMenuClick, authPending = true }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn d-lg-none"
          aria-label="Open navigation"
          aria-controls="sidebar"
          onClick={onMenuClick}
        >
          <i className="bi bi-list" aria-hidden="true" />
        </button>
        <div className="page-heading">
          <p className="breadcrumb-trail">{breadcrumb}</p>
          <h1 className="page-title">{title}</h1>
        </div>
      </div>

      <div className="topbar-right">
        {authPending ? (
          <span className="status-chip" title="Authentication arrives in Phase 2">
            <i className="bi bi-shield-lock" aria-hidden="true" />
            Auth pending
          </span>
        ) : null}
      </div>
    </header>
  )
}
