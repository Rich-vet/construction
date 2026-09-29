import { useEffect, useState } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { PageHero } from '../../components/ui/PageChrome'
import { EmptyState, StatusBadge } from '../../components/ui/Feedback'
import { ApiError } from '../../api/auth'
import { fetchContractors, type ContractorRecord } from '../../api/admin'

export function ContractorsListPage() {
  const [items, setItems] = useState<ContractorRecord[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchContractors({ search, status })
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load contractors.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppShell>
      <PageHero
        title="Contractors"
        subtitle="External labour / trade registry. Optional link to a Worker login account."
        actions={
          <Link to="/contractors/create" className="btn btn-accent">
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Add contractor
          </Link>
        }
      />

      <div className="panel-card">
        <Form
          className="filter-bar mb-3"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <Form.Control
            placeholder="Search name, specialty, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Form.Select>
          <Button type="submit" variant="outline-secondary">
            Filter
          </Button>
        </Form>

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {loading ? (
          <div className="loading-state">
            <Spinner animation="border" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="bi-person-badge"
            title="No contractors yet"
            description="Register trade crews here. Login access is managed under Users."
            action={
              <Link to="/contractors/create" className="btn btn-accent">
                Add contractor
              </Link>
            }
          />
        ) : (
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialty</th>
                <th>Contact</th>
                <th>Linked user</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.specialty || '—'}</td>
                  <td>
                    {c.phone || '—'}
                    {c.email ? <div className="text-muted small">{c.email}</div> : null}
                  </td>
                  <td>{c.user_name || '—'}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <Link
                      to={`/contractors/${c.id}/edit`}
                      className="btn btn-sm btn-outline-secondary"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </AppShell>
  )
}
