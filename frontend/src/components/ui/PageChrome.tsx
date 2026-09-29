import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export { StatusBadge, StatusPill } from './Feedback'

type MetricTone = 'amber' | 'green' | 'blue' | 'red' | 'slate'

const toneIcon: Record<MetricTone, string> = {
  amber: 'metric-card__icon--amber',
  green: 'metric-card__icon--green',
  blue: 'metric-card__icon--blue',
  red: 'metric-card__icon--red',
  slate: 'metric-card__icon--slate',
}

export function greetingForNow(name: string): string {
  const hour = new Date().getHours()
  const first = name.split(/\s+/)[0] || name
  if (hour < 12) return `Good morning, ${first}!`
  if (hour < 17) return `Good afternoon, ${first}!`
  return `Good evening, ${first}!`
}

export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function PageHero({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="page-hero">
      <div>
        <h1 className="page-hero__title">{title}</h1>
        {subtitle ? <p className="page-hero__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-hero__actions">{actions}</div> : null}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  icon,
  tone = 'amber',
  hint,
}: {
  label: string
  value: string | number
  icon: string
  tone?: MetricTone
  hint?: string
}) {
  return (
    <article className="metric-card">
      <div className={`metric-card__icon ${toneIcon[tone]}`} aria-hidden="true">
        <i className={`bi ${icon}`} />
      </div>
      <div className="metric-card__body">
        <p className="metric-card__label">{label}</p>
        <p className="metric-card__value">{value}</p>
        {hint ? <p className="metric-card__hint">{hint}</p> : null}
      </div>
    </article>
  )
}

export function FilterTabs({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="filter-tabs" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`filter-tab${value === opt.value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="progress-track" aria-label={`${pct}% complete`}>
      <div className="progress-track__fill" style={{ width: `${pct}%` }} />
      <span className="progress-track__label">{pct}%</span>
    </div>
  )
}

export function QuickActions({
  items,
}: {
  items: Array<{ label: string; to: string; icon: string }>
}) {
  return (
    <div className="quick-actions">
      <h2 className="panel-title">Quick Actions</h2>
      <div className="quick-actions__list">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="quick-action">
            <i className={`bi ${item.icon}`} aria-hidden="true" />
            <span>{item.label}</span>
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export function PromoCard({
  title = 'Building the future, one project at a time.',
}: {
  title?: string
}) {
  return (
    <div className="promo-card">
      <div className="promo-card__overlay" />
      <p className="promo-card__copy">{title}</p>
    </div>
  )
}
