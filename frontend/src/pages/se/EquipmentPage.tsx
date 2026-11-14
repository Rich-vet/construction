import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { EquipmentImage } from '../../components/equipment/EquipmentImage'
import { EmptyState, StatusBadge } from '../../components/ui/Feedback'
import { MetricCard } from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import {
  allocateEquipment,
  completeEquipmentMaintenance,
  createEquipment,
  fetchEquipment,
  fetchEquipmentAllocations,
  fetchEquipmentRequests,
  fetchMaintenance,
  fetchSiteMeta,
  issueEquipmentRequest,
  logMaintenance,
  requestEquipment,
  returnEquipment,
  reviewEquipmentRequest,
  type EquipmentAllocationSummary,
  type EquipmentItem,
  type SiteMeta,
} from '../../api/site'

const PAGE_SIZE = 12
const CONDITION_RANK: Record<string, number> = {
  Excellent: 0,
  Good: 1,
  Fair: 2,
  Poor: 3,
}

type SortKey = 'name' | 'quantity' | 'condition'

export function EquipmentPage() {
  const [meta, setMeta] = useState<SiteMeta | null>(null)
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [allocations, setAllocations] = useState<EquipmentAllocationSummary[]>([])
  const [maintenance, setMaintenance] = useState<Array<Record<string, unknown>>>([])
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([])
  const [purpose, setPurpose] = useState('')
  const [returnCondition, setReturnCondition] = useState('Good')
  const [rejectReason, setRejectReason] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [projectId, setProjectId] = useState('')
  const [allocQty, setAllocQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [maintType, setMaintType] = useState('Routine service')
  const [newName, setNewName] = useState('')
  const [newAsset, setNewAsset] = useState('')
  const [newType, setNewType] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchSiteMeta(),
      fetchEquipment(),
      fetchEquipmentAllocations(),
      fetchMaintenance(),
      fetchEquipmentRequests(),
    ])
      .then(([m, e, a, maint, reqs]) => {
        setMeta(m)
        setEquipment(e.items)
        setAllocations(a.items as EquipmentAllocationSummary[])
        setMaintenance(maint.items)
        setRequests(reqs.items)
        if (!projectId && m.projects[0]) setProjectId(String(m.projects[0].id))
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

  const types = useMemo(
    () =>
      [...new Set(equipment.map((item) => item.equipment_type).filter(Boolean) as string[])].sort(),
    [equipment],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = equipment.filter((item) => {
      if (typeFilter && item.equipment_type !== typeFilter) return false
      if (conditionFilter && item.condition !== conditionFilter) return false
      if (statusFilter && item.status !== statusFilter) return false
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) || item.asset_id.toLowerCase().includes(query)
      )
    })
    rows.sort((a, b) => {
      if (sortKey === 'quantity') return b.quantity - a.quantity || a.name.localeCompare(b.name)
      if (sortKey === 'condition') {
        return (
          (CONDITION_RANK[a.condition] ?? 9) - (CONDITION_RANK[b.condition] ?? 9) ||
          a.name.localeCompare(b.name)
        )
      }
      return a.name.localeCompare(b.name)
    })
    return rows
  }, [equipment, search, typeFilter, conditionFilter, statusFilter, sortKey])

  useEffect(() => {
    setPage(1)
  }, [search, typeFilter, conditionFilter, statusFilter, sortKey])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selected = equipment.find((item) => item.id === selectedId) ?? null

  const summary = useMemo(() => {
    const units = equipment.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const availableUnits = equipment
      .filter((item) => item.status === 'Available')
      .reduce((sum, item) => sum + (item.available_quantity || 0), 0)
    return {
      types: equipment.length,
      units,
      available: equipment.filter((item) => item.status === 'Available').length,
      availableUnits,
      maintenance: equipment.filter((item) => item.status === 'Under Maintenance').length,
    }
  }, [equipment])

  const selectedHistory = selected
    ? allocations.filter((row) => row.equipment_id === selected.id)
    : []
  const selectedMaintenance = selected
    ? maintenance.filter((row) => Number(row.equipment_id) === selected.id)
    : []

  const onAllocate = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setError(null)
    setMessage(null)
    try {
      await requestEquipment({
        project_id: Number(projectId),
        equipment_id: selected.id,
        quantity: Number(allocQty),
        purpose: purpose || notes || 'Site allocation',
        comments: notes || null,
      })
      setMessage(`${selected.name} requested. A project manager must approve it before it is issued.`)
      setPurpose('')
      setNotes('')
      setAllocQty('1')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to allocate equipment.')
    }
  }

  const onReturn = async (id: number, name: string) => {
    if (!window.confirm(`Return ${name} from site in ${returnCondition} condition?`)) return
    setError(null)
    try {
      await returnEquipment(id, { condition: returnCondition })
      setMessage('Equipment returned and stock updated.')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to return equipment.')
    }
  }

  const onCreateEquipment = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const quantity = Number(newQty)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Quantity must be a positive whole number.')
      return
    }
    try {
      await createEquipment({
        name: newName,
        asset_id: newAsset,
        equipment_type: newType || null,
        quantity,
      })
      setMessage('Equipment added to fleet.')
      setNewName('')
      setNewAsset('')
      setNewType('')
      setNewQty('1')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create equipment.')
    }
  }

  const onMaintenance = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    if (!window.confirm(`Log maintenance for all units of ${selected.name}?`)) return
    setError(null)
    setMessage(null)
    try {
      await logMaintenance({
        equipment_id: selected.id,
        maintenance_type: maintType,
      })
      setMessage('Maintenance logged. This asset is now under maintenance.')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to log maintenance.')
    }
  }

  const onCompleteMaint = async (id: number, release = false) => {
    setError(null)
    try {
      await completeEquipmentMaintenance(id, release)
      setMessage(release ? 'Equipment released to stock after inspection.' : 'Repairs recorded. Stock stays held until inspection.')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to complete maintenance.')
    }
  }

  const canAllocate =
    Boolean(meta?.can_operate_site) &&
    selected !== null &&
    selected.status !== 'Under Maintenance' &&
    selected.status !== 'Unavailable' &&
    selected.available_quantity > 0

  return (
    <AppShell breadcrumb="Resources / Equipment" title="Equipment" phaseLabel="Fleet">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="metric-grid metric-grid--4 mb-4">
        <MetricCard
          label="Equipment types"
          value={summary.types}
          icon="bi-collection"
          tone="slate"
          hint="Catalog records, not physical units"
        />
        <MetricCard
          label="Units in inventory"
          value={summary.units}
          icon="bi-box-seam"
          tone="blue"
          hint="Sum of quantities on each record"
        />
        <MetricCard
          label="Available"
          value={summary.available}
          icon="bi-check-circle"
          tone="green"
          hint={`${summary.availableUnits} units free to allocate`}
        />
        <MetricCard
          label="Under maintenance"
          value={summary.maintenance}
          icon="bi-tools"
          tone="amber"
          hint="Records currently out of service"
        />
      </div>

      {meta?.can_manage_catalog ? (
        <section className="panel-card mb-4">
          <h2 className="section-title">Add equipment</h2>
          <Form className="form-grid" onSubmit={(event) => void onCreateEquipment(event)}>
            <Form.Group>
              <Form.Label>Name</Form.Label>
              <Form.Control required value={newName} onChange={(e) => setNewName(e.target.value)} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Asset ID</Form.Label>
              <Form.Control required value={newAsset} onChange={(e) => setNewAsset(e.target.value)} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Type</Form.Label>
              <Form.Control value={newType} onChange={(e) => setNewType(e.target.value)} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Quantity</Form.Label>
              <Form.Control
                required
                type="number"
                min={1}
                step={1}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
              />
            </Form.Group>
            <div className="form-grid__full">
              <Button type="submit">Add to fleet</Button>
            </div>
          </Form>
        </section>
      ) : null}

      <section className="panel-card mb-4">
        <h2 className="section-title">Equipment requests</h2>
        {requests.length === 0 ? (
          <p className="empty-hint mb-0">No equipment requests.</p>
        ) : (
          <ul className="mb-0">
            {requests.slice(0, 8).map((row) => (
              <li key={String(row.id)} className="mb-2">
                <StatusBadge status={String(row.status)} /> {String(row.quantity)} × {String(row.equipment_name)} for{' '}
                {String(row.project_name)} — {String(row.purpose || '')}
                {meta?.can_approve_equipment && row.status === 'Pending Approval' ? (
                  <span className="ms-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() =>
                        void reviewEquipmentRequest(Number(row.id), { status: 'Approved' }).then(() => load())
                      }
                    >
                      Approve
                    </Button>
                    <Form.Control
                      size="sm"
                      className="d-inline-block w-auto ms-2"
                      placeholder="Rejection reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline-danger"
                      className="ms-2"
                      onClick={() =>
                        void reviewEquipmentRequest(Number(row.id), {
                          status: 'Rejected',
                          notes: rejectReason,
                        }).then(() => load())
                      }
                    >
                      Reject
                    </Button>
                  </span>
                ) : null}
                {row.status === 'Approved' && (meta?.can_operate_site || meta?.can_approve_equipment) ? (
                  <Button
                    size="sm"
                    className="ms-2"
                    onClick={() => void issueEquipmentRequest(Number(row.id), {}).then(() => load())}
                  >
                    Issue equipment
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="equipment-toolbar" aria-label="Filter equipment">
        <Form.Group>
          <Form.Label>Search</Form.Label>
          <Form.Control
            value={search}
            placeholder="Name or asset ID"
            onChange={(e) => setSearch(e.target.value)}
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Category</Form.Label>
          <Form.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All categories</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label>Condition</Form.Label>
          <Form.Select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
            <option value="">All conditions</option>
            {(meta?.equipment_conditions ?? ['Excellent', 'Good', 'Fair', 'Poor']).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label>Status</Form.Label>
          <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {(meta?.equipment_statuses ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label>Sort</Form.Label>
          <Form.Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="name">Name</option>
            <option value="quantity">Quantity</option>
            <option value="condition">Condition</option>
          </Form.Select>
        </Form.Group>
      </section>

      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="bi-truck"
          title="No equipment matches"
          description="Try another search or clear the filters."
        />
      ) : (
        <>
          <p className="text-muted">
            Showing {visible.length} of {filtered.length} types
            {filtered.length !== equipment.length ? ` (${equipment.length} in the fleet)` : ''}.
          </p>
          <div className="equipment-grid">
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                className="equipment-card"
                onClick={() => setSelectedId(item.id)}
                aria-label={`Open ${item.name}, asset ${item.asset_id}`}
              >
                <div className="equipment-card__media">
                  <EquipmentImage
                    name={item.name}
                    equipmentType={item.equipment_type}
                    alt=""
                  />
                </div>
                <div className="equipment-card__body">
                  <h2 className="equipment-card__name">{item.name}</h2>
                  <p className="equipment-card__asset">{item.asset_id}</p>
                  <p className="equipment-card__type">{item.equipment_type || 'Uncategorised'}</p>
                  <p className="equipment-card__qty">{item.quantity} units</p>
                  <div className="equipment-card__badges">
                    <StatusBadge status={item.condition} />
                    <StatusBadge status={item.status} />
                  </div>
                  <span className="equipment-card__open">View details</span>
                </div>
              </button>
            ))}
          </div>
          {pageCount > 1 ? (
            <div className="equipment-pager">
              <Button
                variant="outline-secondary"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </Button>
              <span>
                Page {safePage} of {pageCount}
              </span>
              <Button
                variant="outline-secondary"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Modal
        show={selected !== null}
        onHide={() => setSelectedId(null)}
        size="lg"
        centered
        scrollable
      >
        {selected ? (
          <>
            <Modal.Header closeButton>
              <Modal.Title>
                {selected.name}
                <div className="equipment-card__asset">{selected.asset_id}</div>
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="equipment-detail">
                <div className="equipment-detail__photo">
                  <EquipmentImage
                    name={selected.name}
                    equipmentType={selected.equipment_type}
                    alt={selected.name}
                  />
                </div>
                <div>
                  <p className="equipment-card__type">{selected.equipment_type || 'Uncategorised'}</p>
                  <p className="equipment-card__qty">{selected.quantity} units in inventory</p>
                  <p className="mb-2">
                    {selected.available_quantity} free · {selected.allocated_quantity} allocated
                  </p>
                  <div className="equipment-card__badges">
                    <StatusBadge status={selected.condition} />
                    <StatusBadge status={selected.status} />
                  </div>
                  {selected.current_project_name ? (
                    <p className="mt-3 mb-0">Current site: {selected.current_project_name}</p>
                  ) : (
                    <p className="mt-3 mb-0 text-muted">Not allocated to a site.</p>
                  )}
                  {selected.description ? <p className="mt-2 mb-0">{selected.description}</p> : null}
                </div>
              </div>

              <section className="equipment-detail__section">
                <h3>Allocation</h3>
                {(selected.open_allocations ?? []).length === 0 ? (
                  <p className="text-muted">No open allocations.</p>
                ) : (
                  <ul className="mb-3">
                    {(selected.open_allocations ?? []).map((row) => (
                      <li key={row.id}>
                        {row.quantity} unit{row.quantity === 1 ? '' : 's'} on {row.project_name} since{' '}
                        {row.allocated_at}
                        {meta?.can_operate_site ? (
                          <>
                            <Form.Select
                              size="sm"
                              className="d-inline-block w-auto ms-2"
                              value={returnCondition}
                              onChange={(e) => setReturnCondition(e.target.value)}
                              aria-label="Condition on return"
                            >
                              {(meta.equipment_conditions || ['Good', 'Poor', 'Damaged', 'Needs inspection']).map(
                                (condition) => (
                                  <option key={condition}>{condition}</option>
                                ),
                              )}
                            </Form.Select>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              className="ms-2"
                              onClick={() => void onReturn(row.id, selected.name)}
                            >
                              Return
                            </Button>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {canAllocate ? (
                  <Form className="form-grid" onSubmit={(event) => void onAllocate(event)}>
                    <Form.Group>
                      <Form.Label>Project</Form.Label>
                      <Form.Select
                        required
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      >
                        <option value="">Select</option>
                        {(meta?.projects ?? []).map((project) => (
                          <option key={String(project.id)} value={String(project.id)}>
                            {String(project.name)}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group>
                      <Form.Label>Units</Form.Label>
                      <Form.Control
                        required
                        type="number"
                        min={1}
                        max={selected.available_quantity}
                        step={1}
                        value={allocQty}
                        onChange={(e) => setAllocQty(e.target.value)}
                      />
                    </Form.Group>
                    <Form.Group className="form-grid__full">
                      <Form.Label>Notes</Form.Label>
                      <Form.Control value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </Form.Group>
                    <Form.Group className="form-grid__full">
                      <Form.Label>Purpose</Form.Label>
                      <Form.Control required value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                    </Form.Group>
                    <div className="form-grid__full">
                      <Button type="submit">Request equipment</Button>
                    </div>
                  </Form>
                ) : (
                  <p className="text-muted mb-0">
                    {meta?.can_operate_site
                      ? 'This asset cannot be allocated in its current status.'
                      : 'Allocation is available to the project manager or site engineer on the job.'}
                  </p>
                )}
              </section>

              <section className="equipment-detail__section">
                <h3>Maintenance</h3>
                {selectedMaintenance.length === 0 ? (
                  <p className="text-muted">No maintenance records.</p>
                ) : (
                  <ul>
                    {selectedMaintenance.map((row) => (
                      <li key={String(row.id)}>
                        {String(row.maintenance_date)} — {String(row.maintenance_type)}
                      </li>
                    ))}
                  </ul>
                )}
                <Form className="form-grid" onSubmit={(event) => void onMaintenance(event)}>
                  <Form.Group>
                    <Form.Label>Maintenance type</Form.Label>
                    <Form.Control
                      required
                      value={maintType}
                      onChange={(e) => setMaintType(e.target.value)}
                    />
                  </Form.Group>
                  <div className="form-grid__full d-flex gap-2">
                    <Button type="submit" variant="outline-primary">
                      Log maintenance
                    </Button>
                    {selected.status === 'Under Maintenance' ? (
                      <>
                        <Button type="button" variant="outline-secondary" onClick={() => void onCompleteMaint(selected.id, false)}>
                          Record repairs
                        </Button>
                        <Button type="button" variant="outline-success" onClick={() => void onCompleteMaint(selected.id, true)}>
                          Release after inspection
                        </Button>
                      </>
                    ) : null}
                  </div>
                </Form>
              </section>

              {selectedHistory.some((row) => row.returned_at) ? (
                <section className="equipment-detail__section">
                  <h3>Returned allocations</h3>
                  <ul className="mb-0">
                    {selectedHistory
                      .filter((row) => row.returned_at)
                      .map((row) => (
                        <li key={row.id}>
                          {row.quantity} unit{row.quantity === 1 ? '' : 's'} · {row.project_name} ·
                          returned {row.returned_at}
                        </li>
                      ))}
                  </ul>
                </section>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </Modal.Footer>
          </>
        ) : null}
      </Modal>
    </AppShell>
  )
}
