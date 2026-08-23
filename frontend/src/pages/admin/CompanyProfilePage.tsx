import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchCompany, updateCompany, type CompanyProfile } from '../../api/admin'

export function CompanyProfilePage() {
  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [registration, setRegistration] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchCompany()
      .then(({ company: data }) => {
        setCompany(data)
        setName(data.name)
        setDescription(data.description ?? '')
        setPhone(data.phone ?? '')
        setEmail(data.email ?? '')
        setAddress(data.address ?? '')
        setRegistration(data.registration_info ?? '')
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load company profile.'),
      )
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (!name.trim()) {
      setError('Company name is required.')
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      form.set('name', name.trim())
      form.set('description', description.trim())
      form.set('phone', phone.trim())
      form.set('email', email.trim())
      form.set('address', address.trim())
      form.set('registration_info', registration.trim())
      if (logoFile) form.set('logo', logoFile)
      const result = await updateCompany(form)
      setCompany(result.company)
      setMessage(result.message)
      setLogoFile(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save company profile.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell breadcrumb="System / Company" title="Company profile" phaseLabel="Admin">
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="form-panel">
          {error ? <Alert variant="danger">{error}</Alert> : null}
          {message ? <Alert variant="success">{message}</Alert> : null}

          {company?.logo_url ? (
            <div className="company-logo-preview mb-4">
              <img src={company.logo_url} alt={`${company.name} logo`} />
            </div>
          ) : null}

          <Form onSubmit={onSubmit} noValidate>
            <Form.Group className="mb-3" controlId="company-name">
              <Form.Label>Company name *</Form.Label>
              <Form.Control
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="company-description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              />
            </Form.Group>
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="company-phone">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={submitting}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3" controlId="company-email">
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
            <Form.Group className="mb-3" controlId="company-address">
              <Form.Label>Address</Form.Label>
              <Form.Control
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={submitting}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="company-reg">
              <Form.Label>Registration information</Form.Label>
              <Form.Control
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                disabled={submitting}
              />
            </Form.Group>
            <Form.Group className="mb-4" controlId="company-logo">
              <Form.Label>Logo</Form.Label>
              <Form.Control
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const input = e.target as HTMLInputElement
                  setLogoFile(input.files?.[0] ?? null)
                }}
                disabled={submitting}
              />
              <Form.Text>PNG, JPG, or WEBP only.</Form.Text>
            </Form.Group>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save company profile'}
            </Button>
          </Form>
        </div>
      )}
    </AppShell>
  )
}
