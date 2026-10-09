import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/auth'
import {
  createMaterialRequest,
  fetchMaterialRequests,
  fetchProjectMeta,
  fetchProjects,
  reviewMaterialRequest,
} from '../../api/projects'

export function MaterialRequestsPage() {
  const { user } = useAuth()
  const canReview = user?.role === 'Administrator' || user?.role === 'Project Manager'
  const canCreate = canReview || user?.role === 'Site Engineer'
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([])
  const [materials, setMaterials] = useState<Array<Record<string, unknown>>>([])
  const [projectId, setProjectId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchMaterialRequests(), fetchProjects(), fetchProjectMeta()])
      .then(([reqs, projs, meta]) => {
        setItems(reqs.items)
        setProjects(projs.items.map((p) => ({ id: p.id, name: p.name })))
        setMaterials(meta.materials)
        if (!projectId && projs.items[0]) setProjectId(String(projs.items[0].id))
        if (!materialId && meta.materials[0]) setMaterialId(String(meta.materials[0].id))
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load requests.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const review = async (id: number, status: string) => {
    setError(null)
    try {
      await reviewMaterialRequest(id, status)
      setMessage(`Request ${status.toLowerCase()}.`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to review request.')
    }
  }

  const selectedMaterial = materials.find((item) => String(item.id) === materialId)
  const quantityUnit = selectedMaterial ? String(selectedMaterial.unit || 'units') : ''

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await createMaterialRequest({
        project_id: Number(projectId),
        material_id: Number(materialId),
        quantity: Number(quantity),
        reason: reason || null,
      })
      setMessage('Material request submitted.')
      setQuantity('')
      setReason('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit request.')
    }
  }

  return (
    <AppShell
      breadcrumb="Procurement / Material Requests"
      title="Material requests"
      phaseLabel={user?.role === 'Site Engineer' ? 'SE' : 'PM'}
    >
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      {canCreate ? (
        <section className="panel-card mb-4">
          <h2 className="section-title">New request</h2>
          <Form className="form-grid" onSubmit={(e) => void onCreate(e)}>
            <Form.Group>
              <Form.Label>Project</Form.Label>
              <Form.Select required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Select</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Material</Form.Label>
              <Form.Select
                required
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
              >
                <option value="">Select</option>
                {materials.map((m) => (
                  <option key={String(m.id)} value={String(m.id)}>
                    {String(m.name)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Quantity</Form.Label>
              <div className="qty-unit">
                <Form.Control
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  aria-describedby="request-quantity-unit"
                />
                <span className="qty-unit__label" id="request-quantity-unit">
                  {quantityUnit || 'Select a material'}
                </span>
              </div>
            </Form.Group>
            <Form.Group className="form-grid__full">
              <Form.Label>Reason</Form.Label>
              <Form.Control value={reason} onChange={(e) => setReason(e.target.value)} />
            </Form.Group>
            <div className="form-grid__full">
              <Button type="submit">Submit request</Button>
            </div>
          </Form>
        </section>
      ) : null}

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No material requests for your projects.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Project</th>
                <th>Material</th>
                <th>Qty</th>
                <th>Requested by</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={String(r.id)}>
                  <td>{String(r.project_name)}</td>
                  <td>{String(r.material_name)}</td>
                  <td>
                    {String(r.quantity)} {String(r.unit || '')}
                  </td>
                  <td>{String(r.requested_by_name)}</td>
                  <td>{String(r.status)}</td>
                  <td className="table-actions">
                    {canReview && r.can_approve !== false && r.status === 'Pending' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline-success"
                          onClick={() => void review(Number(r.id), 'Approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => void review(Number(r.id), 'Rejected')}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
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
