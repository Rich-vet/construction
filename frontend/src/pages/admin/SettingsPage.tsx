import { useEffect, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchSettings } from '../../api/admin'

export function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appName, setAppName] = useState('')
  const [currency, setCurrency] = useState('')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        setAppName(data.app_name)
        setCurrency(`${data.currency_symbol} (${data.currency_code})`)
        setCompanyName(data.company.name)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load settings.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="System / Settings" title="Settings" phaseLabel="Admin">
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {!loading && !error ? (
        <div className="detail-panel">
          <dl className="detail-grid">
            <div>
              <dt>Application</dt>
              <dd>{appName}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{companyName}</dd>
            </div>
            <div>
              <dt>Currency display</dt>
              <dd>{currency}</dd>
            </div>
          </dl>
          <div className="detail-panel__actions mt-3">
            <Link to="/company" className="btn btn-primary">
              Manage company profile
            </Link>
            <Link to="/users" className="btn btn-outline-secondary">
              Manage users
            </Link>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
