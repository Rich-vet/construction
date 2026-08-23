import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  fetchDocuments,
  fetchSiteMeta,
  uploadDocument,
  type SiteMeta,
} from '../../api/site'

export function DocumentsPage() {
  const [meta, setMeta] = useState<SiteMeta | null>(null)
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [docType, setDocType] = useState('Photo')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchSiteMeta(), fetchDocuments()])
      .then(([m, d]) => {
        setMeta(m)
        setItems(d.items)
        if (!projectId && m.projects[0]) setProjectId(String(m.projects[0].id))
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load documents.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please choose a file.')
      return
    }
    setError(null)
    setMessage(null)
    const form = new FormData()
    form.append('project_id', projectId)
    form.append('name', name || file.name)
    form.append('document_type', docType)
    form.append('description', description)
    form.append('file', file)
    try {
      await uploadDocument(form)
      setMessage('Document uploaded.')
      setName('')
      setDescription('')
      setFile(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to upload document.')
    }
  }

  return (
    <AppShell breadcrumb="Documents" title="Documents & photos" phaseLabel="SE">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="panel-card mb-4">
        <h2 className="section-title">Upload</h2>
        <Form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          <Form.Group>
            <Form.Label>Project</Form.Label>
            <Form.Select required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Select</option>
              {(meta?.projects ?? []).map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Type</Form.Label>
            <Form.Select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {(meta?.document_types ?? ['Photo']).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Name</Form.Label>
            <Form.Control value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </Form.Group>
          <Form.Group>
            <Form.Label>File</Form.Label>
            <Form.Control
              type="file"
              required
              onChange={(e) => {
                const input = e.target as HTMLInputElement
                setFile(input.files?.[0] ?? null)
              }}
            />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Description</Form.Label>
            <Form.Control value={description} onChange={(e) => setDescription(e.target.value)} />
          </Form.Group>
          <div className="form-grid__full">
            <Button type="submit">Upload</Button>
          </div>
        </Form>
      </section>

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Project</th>
                <th>Uploaded by</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={String(d.id)}>
                  <td>{String(d.name)}</td>
                  <td>{String(d.document_type)}</td>
                  <td>{String(d.project_name)}</td>
                  <td>{String(d.uploaded_by_name ?? '—')}</td>
                  <td>
                    <a
                      className="btn btn-sm btn-outline-secondary"
                      href={String(d.download_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
