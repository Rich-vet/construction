import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button, Modal, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'

/** Status with icon + text (not colour-only). */
const STATUS_ICONS: Record<string, string> = {
  pending: 'bi-hourglass-split',
  'in-progress': 'bi-play-circle',
  'ready-for-review': 'bi-eye',
  verified: 'bi-check2-circle',
  completed: 'bi-check2-circle',
  cancelled: 'bi-x-circle',
  approved: 'bi-check-circle',
  rejected: 'bi-x-octagon',
  fulfilled: 'bi-box-seam',
  delivered: 'bi-truck',
  active: 'bi-lightning-charge',
  'on-leave': 'bi-cup-hot',
  planned: 'bi-calendar2',
  'on-hold': 'bi-pause-circle',
  draft: 'bi-pencil',
  overdue: 'bi-exclamation-triangle',
  urgent: 'bi-exclamation-diamond',
  high: 'bi-arrow-up-circle',
  medium: 'bi-dash-circle',
  low: 'bi-arrow-down-circle',
  present: 'bi-person-check',
  good: 'bi-emoji-smile',
  delayed: 'bi-clock-history',
  unavailable: 'bi-slash-circle',
  available: 'bi-check-circle',
  allocated: 'bi-geo-alt',
  'under-maintenance': 'bi-tools',
  excellent: 'bi-star',
  fair: 'bi-exclamation-circle',
  poor: 'bi-exclamation-octagon',
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/\s+/g, '-')
  const icon = STATUS_ICONS[key] || 'bi-circle'
  return (
    <span className={`status-pill status-pill--${key}`} title={status}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      <span>{status}</span>
    </span>
  )
}

/** @deprecated Prefer StatusBadge — kept as alias for existing imports. */
export function StatusPill({ status }: { status: string }) {
  return <StatusBadge status={status} />
}

export function EmptyState({
  icon = 'bi-inbox',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state__icon" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__text">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: string
  size?: 'sm' | 'lg'
  children: ReactNode
}

export function LoadingButton({
  loading = false,
  disabled,
  children,
  className,
  variant,
  size,
  type = 'button',
  ...rest
}: LoadingButtonProps) {
  const bsVariant = variant || undefined
  if (bsVariant || size) {
    return (
      <Button
        type={type}
        variant={bsVariant as 'primary'}
        size={size}
        disabled={disabled || loading}
        className={className}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
            <span className="visually-hidden">Loading</span>
          </>
        ) : null}
        {children}
      </Button>
    )
  }
  return (
    <button
      type={type}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
          <span className="visually-hidden">Loading</span>
        </>
      ) : null}
      {children}
    </button>
  )
}

export function ConfirmDialog({
  show,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  show: boolean
  title: string
  body: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{body}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <LoadingButton
          variant={variant}
          loading={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </LoadingButton>
      </Modal.Footer>
    </Modal>
  )
}

export function EmptyStateLink({
  to,
  children,
}: {
  to: string
  children: ReactNode
}) {
  return (
    <Link to={to} className="btn btn-accent">
      {children}
    </Link>
  )
}
