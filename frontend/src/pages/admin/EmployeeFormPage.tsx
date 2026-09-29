import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Form, Spinner } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { PageHero } from '../../components/ui/PageChrome'
import { LoadingButton } from '../../components/ui/Feedback'
import { ApiError } from '../../api/auth'
import {
  createEmployee,
  fetchEmployee,
  fetchEmployeeMeta,
  updateEmployee,
} from '../../api/admin'

type Mode = 'create' | 'edit'

export function EmployeeFormPage({ mode }: { mode: Mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const employeeId = id ? Number(id) : null
  const [statuses, setStatuses] = useState<string[]>(['Active', 'Inactive', 'On Leave'])
  const [fullName, setFullName] = useState('')
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [skills, setSkills] = useState('')
  const [status, setStatus] = useState('Active')
  const [loading, setLoading] = useState(mode === 'edit')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEmployeeMeta()
      .then((data) => setStatuses(data.statuses))
      .catch(() => undefined)
    if (mode === 'edit' && employeeId) {
      fetchEmployee(employeeId)
        .then(({ employee }) => {
          setFullName(employee.full_name)
          setCode(employee.employee_code ?? '')
          setPhone(employee.phone ?? '')
          setEmail(employee.email ?? '')
          setPosition(employee.position ?? '')
          setSkills(employee.skills ?? '')
          setStatus(employee.status)
        })
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : 'Unable to load employee.'),
        )
        .finally(() => setLoading(false))
    }
  }, [mode, employeeId])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }
    setSubmitting(true)
    const payload = {
      full_name: fullName.trim(),
      employee_code: code.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      position: position.trim() || null,
      skills: skills.trim() || null,
      status,
    }
    try {
      if (mode === 'create') {
        await createEmployee(payload)
      } else if (employeeId) {
        await updateEmployee(employeeId, payload)
      }
      navigate('/employees')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save employee.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <PageHero
        title={mode === 'create' ? 'Add employee' : 'Edit employee'}
        subtitle="Staff registry record for the company."
        actions={
          <Link to="/employees" className="btn btn-outline-secondary">
            Back to list
          </Link>
        }
      />
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="panel-card" style={{ maxWidth: 640 }}>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Form onSubmit={(e) => void onSubmit(e)} noValidate>
            <Form.Group className="mb-3" controlId="emp-name">
              <Form.Label>Full name *</Form.Label>
              <Form.Control
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={submitting}
              />
            </Form.Group>
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="emp-code">
                  <Form.Label>Employee code</Form.Label>
                  <Form.Control
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={submitting}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="emp-status">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={submitting}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-3" controlId="emp-position">
              <Form.Label>Position</Form.Label>
              <Form.Control
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={submitting}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="emp-skills">
              <Form.Label>Skills</Form.Label>
              <Form.Control
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                disabled={submitting}
              />
            </Form.Group>
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="emp-phone">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={submitting}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="emp-email">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                  />
                </Form.Group>
              </div>
            </div>
            <LoadingButton type="submit" className="btn btn-accent" loading={submitting}>
              {mode === 'create' ? 'Create employee' : 'Save changes'}
            </LoadingButton>
          </Form>
        </div>
      )}
    </AppShell>
  )
}
