import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { PageHero } from '../../components/ui/PageChrome'
import { EmptyState, StatusBadge } from '../../components/ui/Feedback'
import { ApiError } from '../../api/auth'
import {
  fetchEmployees,
  type EmployeeRecord,
} from '../../api/admin'

export function EmployeesListPage() {
  const [items, setItems] = useState<EmployeeRecord[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchEmployees({ search, status })
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load employees.'),
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
        title="Employees"
        subtitle="Company staff registry (separate from login users)."
        actions={
          <Link to="/employees/create" className="btn btn-accent">
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Add employee
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
            placeholder="Search name, code, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
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
            icon="bi-people"
            title="No employees yet"
            description="Add staff records for HR tracking. Login accounts stay under Users."
            action={
              <Link to="/employees/create" className="btn btn-accent">
                Add employee
              </Link>
            }
          />
        ) : (
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Position</th>
                <th>Contact</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <strong>{emp.full_name}</strong>
                    {emp.skills ? (
                      <div className="text-muted small">{emp.skills}</div>
                    ) : null}
                  </td>
                  <td>{emp.employee_code || '—'}</td>
                  <td>{emp.position || '—'}</td>
                  <td>
                    {emp.phone || '—'}
                    {emp.email ? <div className="text-muted small">{emp.email}</div> : null}
                  </td>
                  <td>
                    <StatusBadge status={emp.status} />
                  </td>
                  <td>
                    <Link to={`/employees/${emp.id}/edit`} className="btn btn-sm btn-outline-secondary">
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
