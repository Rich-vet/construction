import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import { fetchMaterialRequests } from '../../api/projects'
import {
  createMaterial,
  fetchMaterialTransactions,
  fetchMaterialsStock,
  fetchSiteMeta,
  recordMaterialUsage,
  type SiteMeta,
} from '../../api/site'

export function MaterialsPage() {
  const [meta, setMeta] = useState<SiteMeta | null>(null)
  const [stock, setStock] = useState<Array<Record<string, unknown>>>([])
  const [txns, setTxns] = useState<Array<Record<string, unknown>>>([])
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([])
  const [projectId, setProjectId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [txType, setTxType] = useState('USAGE')
  const [notes, setNotes] = useState('')
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('unit')
  const [newMin, setNewMin] = useState('0')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchSiteMeta(),
      fetchMaterialsStock(),
      fetchMaterialTransactions(),
      fetchMaterialRequests(),
    ])
      .then(([m, s, t, r]) => {
        setMeta(m)
        setStock(s.items)
        setTxns(t.items)
        setRequests(r.items)
        if (!projectId && m.projects[0]) setProjectId(String(m.projects[0].id))
        if (!materialId && m.materials[0]) setMaterialId(String(m.materials[0].id))
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load materials.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onUsage = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await recordMaterialUsage({
        project_id: projectId ? Number(projectId) : null,
        material_id: Number(materialId),
        quantity: Number(quantity),
        transaction_type: txType,
        notes: notes || null,
      })
      setMessage('Material transaction recorded.')
      setQuantity('')
      setNotes('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to record usage.')
    }
  }

  const onCreateMaterial = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await createMaterial({
        name: newName,
        unit: newUnit,
        minimum_stock: Number(newMin),
      })
      setMessage('Material added to catalog.')
      setNewName('')
      setNewMin('0')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create material.')
    }
  }

  return (
    <AppShell breadcrumb="Resources / Materials" title="Materials" phaseLabel="SE">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="admin-panels">
        {meta?.can_manage_catalog ? (
          <section className="panel-card">
            <h2 className="section-title">Add material to catalog</h2>
            <Form className="form-grid" onSubmit={(e) => void onCreateMaterial(e)}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control required value={newName} onChange={(e) => setNewName(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Unit</Form.Label>
                <Form.Control value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Minimum stock</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={newMin}
                  onChange={(e) => setNewMin(e.target.value)}
                />
              </Form.Group>
              <div className="form-grid__full">
                <Button type="submit">Add material</Button>
              </div>
            </Form>
          </section>
        ) : null}

        <section className="panel-card">
          <h2 className="section-title">Record stock movement</h2>
          <Form className="form-grid" onSubmit={(e) => void onUsage(e)}>
            <Form.Group>
              <Form.Label>Project {txType === 'USAGE' || txType === 'RETURN' ? '' : '(optional)'}</Form.Label>
              <Form.Select
                required={txType === 'USAGE' || txType === 'RETURN'}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Select</option>
                {(meta?.projects ?? []).map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.name)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Material</Form.Label>
              <Form.Select required value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                <option value="">Select</option>
                {(meta?.materials ?? []).map((m) => (
                  <option key={String(m.id)} value={String(m.id)}>
                    {String(m.name)} ({String(m.quantity)} {String(m.unit ?? '')})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Type</Form.Label>
              <Form.Select value={txType} onChange={(e) => setTxType(e.target.value)}>
                {(meta?.transaction_types ?? ['USAGE', 'RETURN']).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Quantity</Form.Label>
              <Form.Control
                type="number"
                min="0.01"
                step="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="form-grid__full">
              <Form.Label>Notes</Form.Label>
              <Form.Control value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Form.Group>
            <div className="form-grid__full">
              <Button type="submit">Save transaction</Button>
            </div>
          </Form>
        </section>

        <section className="panel-card">
          <h2 className="section-title">Material requests</h2>
          <p className="empty-hint mb-3">
            Create and review material requests in the authoritative Material Requests workflow — not
            from stock movements.
          </p>
          <Link to="/material-requests" className="btn btn-primary">
            Open Material Requests
          </Link>
          {requests.length > 0 ? (
            <p className="text-muted small mt-3 mb-0">
              {requests.length} request(s) visible for your projects (status list below).
            </p>
          ) : null}
        </section>
      </div>

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : (
        <>
          <section className="panel-card mt-4">
            <h2 className="section-title">Current stock</h2>
            <Table responsive hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Min</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((m) => (
                  <tr key={String(m.id)}>
                    <td>{String(m.name)}</td>
                    <td>
                      {String(m.quantity)} {String(m.unit ?? '')}
                    </td>
                    <td>{String(m.minimum_stock)}</td>
                    <td>{m.is_low_stock ? 'Low' : 'OK'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>

          <section className="panel-card mt-4">
            <h2 className="section-title">Recent usage</h2>
            {txns.length === 0 ? (
              <p className="text-muted mb-0">No transactions yet.</p>
            ) : (
              <Table responsive hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Material</th>
                    <th>Type</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.slice(0, 20).map((t) => (
                    <tr key={String(t.id)}>
                      <td>{String(t.transaction_date)}</td>
                      <td>{String(t.project_name ?? '—')}</td>
                      <td>{String(t.material_name)}</td>
                      <td>{String(t.transaction_type)}</td>
                      <td>{String(t.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>

          <section className="panel-card mt-4">
            <h2 className="section-title">My / project requests</h2>
            {requests.length === 0 ? (
              <p className="text-muted mb-0">No material requests.</p>
            ) : (
              <Table responsive hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={String(r.id)}>
                      <td>{String(r.project_name)}</td>
                      <td>{String(r.material_name)}</td>
                      <td>{String(r.quantity)}</td>
                      <td>{String(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        </>
      )}
    </AppShell>
  )
}
