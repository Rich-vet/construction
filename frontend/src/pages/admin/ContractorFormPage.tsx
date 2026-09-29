import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Form, Spinner } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { PageHero } from '../../components/ui/PageChrome'
import { LoadingButton } from '../../components/ui/Feedback'
import { ApiError } from '../../api/auth'
import {
  createContractor,
  fetchContractor,
  fetchContractorMeta,
  updateContractor,
} from '../../api/admin'

type Mode = 'create' | 'edit'

export function ContractorFormPage({ mode }: { mode: Mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const contractorId = id ? Number(id) : null
  const [statuses, setStatuses] = useState<string[]>(['Active', 'Inactive'])
  const [workers, setWorkers] = useState<Array<{ id: number; full_name: string; email: string }>>(
    [],
  )
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('Active')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(mode === 'edit')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchContractorMeta()
      .then((data) => {
        setStatuses(data.statuses)
        setWorkers(data.linkable_users)
      })
      .catch(() => undefined)
    if (mode === 'edit' && contractorId) {
      fetchContractor(contractorId)
        .then(({ contractor }) => {
          setName(contractor.name)
          setSpecialty(contractor.specialty ?? '')
          setPhone(contractor.phone ?? '')
          setEmail(contractor.email ?? '')
          setStatus(contractor.status)
          setUserId(contractor.user_id ? String(contractor.user_id) : '')
        })
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : 'Unable to load contractor.'),
        )
        .finally(() => setLoading(false))
    }
  }, [mode, contractorId])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSubmitting(true)
    const payload = {
      name: name.trim(),
      specialty: specialty.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      status,
      user_id: userId ? Number(userId) : null,
    }
    try {
      if (mode === 'create') {
        await createContractor(payload)
      } else if (contractorId) {
        await updateContractor(contractorId, payload)
      }
      navigate('/contractors')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save contractor.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <PageHero
        title={mode === 'create' ? 'Add contractor' : 'Edit contractor'}
        subtitle="Trade crew or firm on the company register."
        actions={
          <Link to="/contractors" className="btn btn-outline-secondary">
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
            <Form.Group className="mb-3" controlId="con-name">
              <Form.Label>Name *</Form.Label>
              <Form.Control
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="con-specialty">
              <Form.Label>Specialty</Form.Label>
              <Form.Control
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                disabled={submitting}
              />
            </Form.Group>
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="con-phone">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={submitting}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="con-email">
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
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="con-status">
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
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="con-user">
                  <Form.Label>Linked Worker login (optional)</Form.Label>
                  <Form.Select
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">None</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name} ({w.email})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
            </div>
            <LoadingButton type="submit" className="btn btn-accent" loading={submitting}>
              {mode === 'create' ? 'Create contractor' : 'Save changes'}
            </LoadingButton>
          </Form>
        </div>
      )}
    </AppShell>
  )
}
