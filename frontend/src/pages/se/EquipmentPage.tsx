import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  allocateEquipment,
  fetchEquipment,
  fetchEquipmentAllocations,
  fetchSiteMeta,
  returnEquipment,
  type SiteMeta,
} from '../../api/site'

export function EquipmentPage() {
  const [meta, setMeta] = useState<SiteMeta | null>(null)
  const [equipment, setEquipment] = useState<Array<Record<string, unknown>>>([])
  const [allocations, setAllocations] = useState<Array<Record<string, unknown>>>([])
  const [projectId, setProjectId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchSiteMeta(), fetchEquipment(), fetchEquipmentAllocations()])
      .then(([m, e, a]) => {
        setMeta(m)
        setEquipment(e.items)
        setAllocations(a.items)
        if (!projectId && m.projects[0]) setProjectId(String(m.projects[0].id))
        const available = e.items.find((x) => x.status === 'Available')
        if (!equipmentId && available) setEquipmentId(String(available.id))
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load equipment.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onAllocate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await allocateEquipment({
        project_id: Number(projectId),
        equipment_id: Number(equipmentId),
        notes: notes || null,
      })
      setMessage('Equipment allocated to project.')
      setNotes('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to allocate equipment.')
    }
  }

  const onReturn = async (id: number) => {
    setError(null)
    try {
      await returnEquipment(id)
      setMessage('Equipment returned.')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to return equipment.')
    }
  }

  return (
    <AppShell breadcrumb="Resources / Equipment" title="Equipment" phaseLabel="SE">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="panel-card mb-4">
        <h2 className="section-title">Allocate to site</h2>
        <Form className="form-grid" onSubmit={(e) => void onAllocate(e)}>
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
            <Form.Label>Equipment</Form.Label>
            <Form.Select
              required
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              <option value="">Select</option>
              {equipment
                .filter((eq) => eq.status === 'Available')
                .map((eq) => (
                  <option key={String(eq.id)} value={String(eq.id)}>
                    {String(eq.name)} ({String(eq.asset_id)})
                  </option>
                ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Notes</Form.Label>
            <Form.Control value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Form.Group>
          <div className="form-grid__full">
            <Button type="submit">Allocate</Button>
          </div>
        </Form>
      </section>

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : (
        <>
          <section className="panel-card mb-4">
            <h2 className="section-title">Fleet status</h2>
            <Table responsive hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>Current site</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq) => (
                  <tr key={String(eq.id)}>
                    <td>
                      {String(eq.name)} ({String(eq.asset_id)})
                    </td>
                    <td>{String(eq.equipment_type ?? '—')}</td>
                    <td>{String(eq.condition)}</td>
                    <td>{String(eq.status)}</td>
                    <td>{String(eq.current_project_name ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>

          <section className="panel-card">
            <h2 className="section-title">Allocations</h2>
            {allocations.length === 0 ? (
              <p className="text-muted mb-0">No allocations yet.</p>
            ) : (
              <Table responsive hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Equipment</th>
                    <th>Project</th>
                    <th>Allocated</th>
                    <th>Returned</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={String(a.id)}>
                      <td>{String(a.equipment_name)}</td>
                      <td>{String(a.project_name)}</td>
                      <td>{String(a.allocated_at)}</td>
                      <td>{String(a.returned_at ?? 'On site')}</td>
                      <td>
                        {!a.returned_at ? (
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => void onReturn(Number(a.id))}
                          >
                            Return
                          </Button>
                        ) : null}
                      </td>
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
