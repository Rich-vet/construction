import { useEffect, useState } from 'react'
import { Spinner, Button } from 'react-bootstrap'
import { AppShell } from '../components/layout/AppShell'
import { getFoundation, type FoundationResponse } from '../api/client'

const checkIcons: Record<string, string> = {
  factory: 'bi-building-gear',
  database: 'bi-database',
  design: 'bi-palette',
  security: 'bi-shield-check',
}

export function FoundationPage() {
  const [data, setData] = useState<FoundationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError(null)
    getFoundation()
      .then(setData)
      .catch((err: Error) => setError(err.message || 'Unable to load foundation status.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <AppShell breadcrumb="Home / Foundation" title="Project Foundation">
        <div className="loading-state" role="status" aria-live="polite">
          <Spinner animation="border" variant="secondary" className="mb-3" />
          <p className="mb-0 text-muted">Loading foundation status…</p>
        </div>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell breadcrumb="Home / Foundation" title="Project Foundation">
        <div className="error-state" role="alert">
          <p className="mb-3">{error ?? 'Unable to load foundation status.'}</p>
          <p className="mb-3 small">
            Ensure the Flask API is running on port 5000, then retry.
          </p>
          <Button variant="primary" onClick={load}>
            Retry
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      breadcrumb="Home / Foundation"
      title="Project Foundation"
      phaseLabel={data.phase}
    >
      <section className="foundation-hero" aria-labelledby="foundation-heading">
        <div className="foundation-hero__grid" aria-hidden="true" />
        <div className="foundation-hero__content">
          <p className="eyebrow">{data.phase_label}</p>
          <h2 id="foundation-heading" className="foundation-title">
            {data.company_name} is ready to build on
          </h2>
          <p className="foundation-lead">{data.message}</p>
        </div>
      </section>

      <section className="status-grid" aria-label="Foundation status">
        {data.checks.map((check, index) => (
          <article
            key={check.id}
            className="status-card"
            style={{ ['--delay' as string]: `${index * 60}ms` }}
          >
            <div className="status-card__icon" aria-hidden="true">
              <i className={`bi ${checkIcons[check.id] ?? 'bi-check-circle'}`} />
            </div>
            <h3 className="status-card__title">{check.title}</h3>
            <p className="status-card__text">{check.text}</p>
            <span className="badge-status is-ready">Ready</span>
          </article>
        ))}
      </section>

      <section className="next-panel" aria-labelledby="next-heading">
        <div>
          <h2 id="next-heading" className="section-title">
            {data.next.title}
          </h2>
          <p className="section-text">{data.next.text}</p>
        </div>
        <p className="next-note">
          <i className="bi bi-info-circle" aria-hidden="true" /> {data.next.note}
        </p>
      </section>
    </AppShell>
  )
}
