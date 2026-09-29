import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Badge, Button, Form, Nav, Spinner, Table, Tab } from 'react-bootstrap'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  addMember,
  completeMilestone,
  createDelivery,
  createExpense,
  createMaterialRequest,
  createMilestone,
  createPurchaseOrder,
  createQuotation,
  createTask,
  fetchProjectMeta,
  fetchProjectWorkspace,
  removeMember,
  reviewBudgetRevision,
  reviewExpense,
  reviewMaterialRequest,
  selectQuotation,
  upsertBudget,
  verifyTask,
} from '../../api/projects'

export function ProjectDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const projectId = Number(id)
  const tabParam = searchParams.get('tab')
  const initialTab =
    tabParam === 'site'
      ? 'progress'
      : tabParam === 'procurement'
        ? 'procurement'
        : tabParam &&
            [
              'overview',
              'tasks',
              'milestones',
              'team',
              'budget',
              'expenses',
              'procurement',
              'progress',
              'reports',
            ].includes(tabParam)
          ? tabParam
          : 'overview'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null)
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof fetchProjectMeta>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    Promise.all([fetchProjectWorkspace(projectId), fetchProjectMeta()])
      .then(([ws, m]) => {
        setWorkspace(ws)
        setMeta(m)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load project.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const project = workspace?.project as Record<string, unknown> | undefined
  const canManage = Boolean(workspace?.can_manage)
  const canOperateSite = Boolean(workspace?.can_operate_site)
  const totals = workspace?.totals as Record<string, number> | undefined

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setError(null)
    setMessage(null)
    try {
      await fn()
      setMessage(success)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.')
    }
  }

  if (loading && !workspace) {
    return (
      <AppShell breadcrumb="Projects" title="Project" phaseLabel="PM">
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      </AppShell>
    )
  }

  if (!project) {
    return (
      <AppShell breadcrumb="Projects" title="Project" phaseLabel="PM">
        <Alert variant="danger">{error ?? 'Project not found.'}</Alert>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={`Projects / ${project.name}`} title={String(project.name)} phaseLabel="PM">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="detail-panel mb-4">
        <div className="detail-panel__actions">
          {canManage ? (
            <Link to={`/projects/${projectId}/edit`} className="btn btn-primary">
              Edit project
            </Link>
          ) : null}
          <Link to="/projects" className="btn btn-outline-secondary">
            Back
          </Link>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Client</dt>
            <dd>{String(project.client_name)}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{String(project.location)}</dd>
          </div>
          <div>
            <dt>Manager</dt>
            <dd>{String(project.project_manager_name ?? '—')}</dd>
          </div>
          <div>
            <dt>Site engineer</dt>
            <dd>{String(project.site_engineer_name ?? '—')}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <Badge bg="secondary">{String(project.status)}</Badge>
            </dd>
          </div>
          <div>
            <dt>Progress</dt>
            <dd>{Number(project.progress)}%</dd>
          </div>
          <div>
            <dt>Budget</dt>
            <dd>K{Number(totals?.budget ?? 0).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Actual spend</dt>
            <dd>K{Number(totals?.actual_expenditure ?? 0).toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      <Tab.Container activeKey={activeTab} onSelect={(k) => k && setActiveTab(k)}>
        <Nav variant="tabs" className="mb-3 project-tabs">
          {[
            'overview',
            'tasks',
            'milestones',
            'team',
            'budget',
            'expenses',
            'procurement',
            'progress',
            'reports',
          ].map((key) => (
            <Nav.Item key={key}>
              <Nav.Link eventKey={key} className="text-capitalize">
                {key}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="overview">
            <div className="panel-card">
              <p>{String(project.description || 'No description provided.')}</p>
              <p className="text-muted mb-0">
                {String(project.start_date || '—')} → {String(project.expected_completion || '—')}
              </p>
            </div>
          </Tab.Pane>

          <Tab.Pane eventKey="tasks">
            <WorkspaceTasks
              canManage={canManage}
              canOperateSite={canOperateSite}
              projectId={projectId}
              tasks={(workspace?.tasks as Array<Record<string, unknown>>) || []}
              users={meta?.assignable_users || []}
              onCreate={(payload) =>
                run(() => createTask(payload), 'Task created successfully.')
              }
              onVerify={(tid) => run(() => verifyTask(tid), 'Task verified.')}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="milestones">
            <WorkspaceMilestones
              canManage={canManage}
              projectId={projectId}
              milestones={(workspace?.milestones as Array<Record<string, unknown>>) || []}
              onCreate={(payload) =>
                run(() => createMilestone(payload), 'Milestone created.')
              }
              onComplete={(mid) => run(() => completeMilestone(mid), 'Milestone completed.')}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="team">
            <WorkspaceTeam
              canManage={canManage}
              projectId={projectId}
              members={(workspace?.members as Array<Record<string, unknown>>) || []}
              users={meta?.assignable_users || []}
              onAdd={(payload) => run(() => addMember(projectId, payload), 'Member added.')}
              onRemove={(mid) =>
                run(async () => {
                  if (window.confirm('Remove this team member?')) await removeMember(mid)
                }, 'Member removed.')
              }
            />
          </Tab.Pane>

          <Tab.Pane eventKey="budget">
            <WorkspaceBudget
              canManage={canManage}
              projectId={projectId}
              rows={(workspace?.budget_vs_actual as Array<Record<string, unknown>>) || []}
              onSave={(category, amount) =>
                run(() => upsertBudget(projectId, category, amount), 'Budget saved.')
              }
              onReview={(category, status) =>
                run(
                  () => reviewBudgetRevision(projectId, category, status),
                  `Budget revision ${status.toLowerCase()}.`,
                )
              }
            />
          </Tab.Pane>

          <Tab.Pane eventKey="expenses">
            <WorkspaceExpenses
              canManage={canManage}
              projectId={projectId}
              expenses={(workspace?.expenses as Array<Record<string, unknown>>) || []}
              categories={meta?.budget_categories || []}
              onCreate={(payload) =>
                run(() => createExpense(payload), 'Expense submitted for approval.')
              }
              onReview={(id, status) =>
                run(() => reviewExpense(id, status), `Expense ${status.toLowerCase()}.`)
              }
            />
          </Tab.Pane>

          <Tab.Pane eventKey="procurement">
            <WorkspaceProcurement
              canManage={canManage}
              projectId={projectId}
              materials={(meta?.materials as Array<Record<string, unknown>>) || []}
              requests={(workspace?.material_requests as Array<Record<string, unknown>>) || []}
              quotations={(workspace?.quotations as Array<Record<string, unknown>>) || []}
              purchaseOrders={(workspace?.purchase_orders as Array<Record<string, unknown>>) || []}
              deliveries={(workspace?.deliveries as Array<Record<string, unknown>>) || []}
              onRequest={(payload) =>
                run(() => createMaterialRequest(payload), 'Material request submitted.')
              }
              onReview={(rid, status) =>
                run(() => reviewMaterialRequest(rid, status), `Request ${status.toLowerCase()}.`)
              }
              onQuote={(payload) => run(() => createQuotation(payload), 'Quotation recorded.')}
              onSelect={(qid) => run(() => selectQuotation(qid), 'Quotation selected.')}
              onPo={(qid) =>
                run(() => createPurchaseOrder({ quotation_id: qid }), 'Purchase order created.')
              }
              onDelivery={(payload) =>
                run(() => createDelivery(payload), 'Delivery recorded.')
              }
            />
          </Tab.Pane>

          <Tab.Pane eventKey="progress">
            <div className="panel-card mb-3">
              <p className="empty-hint mb-2">
                Progress is recorded through the Site Diary (activities + %). View recent posts below.
              </p>
              {canOperateSite ? (
                <Link to={`/site-diary?project_id=${projectId}`} className="btn btn-primary">
                  Open Site Diary
                </Link>
              ) : null}
            </div>
            <SimpleList
              title="Progress updates"
              empty="No progress updates yet."
              items={(workspace?.progress_updates as Array<Record<string, unknown>>) || []}
              render={(item) => (
                <>
                  <strong>{String(item.update_date)}</strong> — {Number(item.percentage)}%
                  <div>{String(item.work_completed)}</div>
                </>
              )}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="reports">
            <div className="panel-card mb-3">
              <p className="empty-hint mb-2">
                Daily site reports are submitted via Site Diary. This tab shows history for the project.
              </p>
              {canOperateSite ? (
                <Link to={`/site-diary?project_id=${projectId}`} className="btn btn-primary">
                  Open Site Diary
                </Link>
              ) : null}
            </div>
            <SimpleList
              title="Site reports"
              empty="No site reports yet."
              items={(workspace?.site_reports as Array<Record<string, unknown>>) || []}
              render={(item) => (
                <>
                  <strong>{String(item.report_date)}</strong>
                  <div>{String(item.activities_completed || '—')}</div>
                </>
              )}
            />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </AppShell>
  )
}

function SimpleList({
  title,
  empty,
  items,
  render,
}: {
  title: string
  empty: string
  items: Array<Record<string, unknown>>
  render: (item: Record<string, unknown>) => ReactNode
}) {
  return (
    <div className="panel-card">
      <h3 className="section-title">{title}</h3>
      {items.length === 0 ? (
        <p className="empty-hint">{empty}</p>
      ) : (
        <ul className="activity-list">
          {items.map((item) => (
            <li key={String(item.id)}>{render(item)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function WorkspaceTasks(props: {
  canManage: boolean
  canOperateSite: boolean
  projectId: number
  tasks: Array<Record<string, unknown>>
  users: Array<{ id: number; full_name: string; role: string }>
  onCreate: (payload: Record<string, unknown>) => void
  onVerify: (taskId: number) => void
}) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [assigned, setAssigned] = useState('')
  const [dueDate, setDueDate] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    props.onCreate({
      project_id: props.projectId,
      name,
      priority,
      assigned_user_id: assigned ? Number(assigned) : null,
      due_date: dueDate || null,
    })
    setName('')
  }

  return (
    <div className="panel-card">
      {props.canManage ? (
        <Form className="filter-bar mb-3" onSubmit={submit}>
          <Form.Control
            placeholder="Task name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Form.Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Form.Select>
          <Form.Select value={assigned} onChange={(e) => setAssigned(e.target.value)}>
            <option value="">Unassigned</option>
            {props.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </Form.Select>
          <Form.Control type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button type="submit">Add task</Button>
        </Form>
      ) : null}
      <Table responsive hover size="sm" className="mb-0">
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {props.tasks.map((t) => (
            <tr key={String(t.id)}>
              <td>{String(t.name)}</td>
              <td>{String(t.assigned_user_name ?? '—')}</td>
              <td>{String(t.priority)}</td>
              <td>{String(t.due_date ?? '—')}</td>
              <td>{String(t.status)}</td>
              <td className="table-actions">
                {props.canOperateSite && Boolean(t.can_verify) ? (
                  <Button size="sm" variant="success" onClick={() => props.onVerify(Number(t.id))}>
                    Verify Completion
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {props.tasks.length === 0 ? <p className="empty-hint mt-3">No tasks yet.</p> : null}
    </div>
  )
}

function WorkspaceMilestones(props: {
  canManage: boolean
  projectId: number
  milestones: Array<Record<string, unknown>>
  onCreate: (payload: Record<string, unknown>) => void
  onComplete: (id: number) => void
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  return (
    <div className="panel-card">
      {props.canManage ? (
        <Form
          className="filter-bar mb-3"
          onSubmit={(e) => {
            e.preventDefault()
            props.onCreate({ project_id: props.projectId, name, target_date: target || null })
            setName('')
          }}
        >
          <Form.Control
            placeholder="Milestone name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Form.Control type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Button type="submit">Add milestone</Button>
        </Form>
      ) : null}
      <ul className="activity-list">
        {props.milestones.map((m) => (
          <li key={String(m.id)} className="d-flex justify-content-between gap-3">
            <div>
              <strong>{String(m.name)}</strong>
              <div className="small text-muted">
                Target {String(m.target_date ?? '—')}
                {m.is_delayed ? ' · Delayed' : ''}
                {m.is_completed ? ' · Completed' : ''}
              </div>
            </div>
            {props.canManage && !m.is_completed ? (
              <Button size="sm" variant="outline-success" onClick={() => props.onComplete(Number(m.id))}>
                Complete
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {props.milestones.length === 0 ? <p className="empty-hint">No milestones yet.</p> : null}
    </div>
  )
}

function WorkspaceTeam(props: {
  canManage: boolean
  projectId: number
  members: Array<Record<string, unknown>>
  users: Array<{ id: number; full_name: string; role: string }>
  onAdd: (payload: Record<string, unknown>) => void
  onRemove: (id: number) => void
}) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('Team Member')
  return (
    <div className="panel-card">
      {props.canManage ? (
        <Form
          className="filter-bar mb-3"
          onSubmit={(e) => {
            e.preventDefault()
            props.onAdd({ user_id: Number(userId), member_role: role })
          }}
        >
          <Form.Select value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Select user</option>
            {props.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </Form.Select>
          <Form.Control value={role} onChange={(e) => setRole(e.target.value)} />
          <Button type="submit">Add member</Button>
        </Form>
      ) : null}
      <Table responsive size="sm" className="mb-0">
        <thead>
          <tr>
            <th>Name</th>
            <th>System role</th>
            <th>Project role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {props.members.map((m) => (
            <tr key={String(m.id)}>
              <td>{String(m.user_name)}</td>
              <td>{String(m.user_role)}</td>
              <td>{String(m.member_role)}</td>
              <td>
                {props.canManage ? (
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => props.onRemove(Number(m.id))}
                  >
                    Remove
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

function WorkspaceBudget(props: {
  canManage: boolean
  projectId: number
  rows: Array<Record<string, unknown>>
  onSave: (category: string, amount: number) => void
  onReview: (category: string, status: 'Approved' | 'Rejected') => void
}) {
  return (
    <div className="panel-card">
      <Table responsive className="mb-0">
        <thead>
          <tr>
            <th>Category</th>
            <th>Approved budget</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>Pending revision</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <BudgetRow
              key={String(row.category)}
              row={row}
              canManage={props.canManage}
              onSave={props.onSave}
              onReview={props.onReview}
            />
          ))}
        </tbody>
      </Table>
    </div>
  )
}

function BudgetRow({
  row,
  canManage,
  onSave,
  onReview,
}: {
  row: Record<string, unknown>
  canManage: boolean
  onSave: (category: string, amount: number) => void
  onReview: (category: string, status: 'Approved' | 'Rejected') => void
}) {
  const [amount, setAmount] = useState(String(row.budget ?? 0))
  const variance = Number(row.variance ?? 0)
  const pending = row.pending_amount != null ? Number(row.pending_amount) : null
  const canApproveRevision = Boolean(row.can_approve_revision)
  return (
    <tr>
      <td>{String(row.category)}</td>
      <td>
        {canManage ? (
          <Form.Control
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ maxWidth: 140 }}
          />
        ) : (
          `K${Number(row.budget).toLocaleString()}`
        )}
      </td>
      <td>K{Number(row.actual).toLocaleString()}</td>
      <td className={variance > 0 ? 'text-danger' : 'text-success'}>
        {variance > 0 ? '+' : ''}
        K{variance.toLocaleString()}
      </td>
      <td>
        {pending != null ? (
          <span>
            K{pending.toLocaleString()}{' '}
            <Badge bg="warning" text="dark">
              Pending
            </Badge>
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="d-flex gap-2 flex-wrap">
        {canManage ? (
          <Button size="sm" onClick={() => onSave(String(row.category), Number(amount))}>
            {Number(row.budget) === 0 && !row.budget_line_id ? 'Set' : 'Propose'}
          </Button>
        ) : null}
        {canApproveRevision ? (
          <>
            <Button
              size="sm"
              variant="success"
              onClick={() => onReview(String(row.category), 'Approved')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline-danger"
              onClick={() => onReview(String(row.category), 'Rejected')}
            >
              Reject
            </Button>
          </>
        ) : null}
      </td>
    </tr>
  )
}

function WorkspaceExpenses(props: {
  canManage: boolean
  projectId: number
  expenses: Array<Record<string, unknown>>
  categories: string[]
  onCreate: (payload: Record<string, unknown>) => void
  onReview: (id: number, status: 'Approved' | 'Rejected') => void
}) {
  const [category, setCategory] = useState('Materials')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dateValue, setDateValue] = useState('')
  return (
    <div className="panel-card">
      {props.canManage ? (
        <Form
          className="filter-bar mb-3"
          onSubmit={(e) => {
            e.preventDefault()
            props.onCreate({
              project_id: props.projectId,
              category,
              description,
              amount: Number(amount),
              expense_date: dateValue || null,
            })
            setDescription('')
            setAmount('')
          }}
        >
          <Form.Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {props.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Form.Select>
          <Form.Control
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <Form.Control
            type="number"
            min={0.01}
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Form.Control
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
          />
          <Button type="submit">Submit expense</Button>
        </Form>
      ) : null}
      <Table responsive size="sm" className="mb-0">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {props.expenses.map((e) => {
            const status = String(e.status || 'Pending')
            const badge =
              status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'warning'
            return (
              <tr key={String(e.id)}>
                <td>{String(e.expense_date)}</td>
                <td>{String(e.category)}</td>
                <td>{String(e.description)}</td>
                <td>K{Number(e.amount).toLocaleString()}</td>
                <td>
                  <Badge bg={badge} text={status === 'Pending' ? 'dark' : undefined}>
                    {status}
                  </Badge>
                </td>
                <td className="d-flex gap-2">
                  {Boolean(e.can_approve) && status === 'Pending' ? (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => props.onReview(Number(e.id), 'Approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => props.onReview(Number(e.id), 'Rejected')}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}

function WorkspaceProcurement(props: {
  canManage: boolean
  projectId: number
  materials: Array<Record<string, unknown>>
  requests: Array<Record<string, unknown>>
  quotations: Array<Record<string, unknown>>
  purchaseOrders: Array<Record<string, unknown>>
  deliveries: Array<Record<string, unknown>>
  onRequest: (payload: Record<string, unknown>) => void
  onReview: (id: number, status: string) => void
  onQuote: (payload: Record<string, unknown>) => void
  onSelect: (id: number) => void
  onPo: (quotationId: number) => void
  onDelivery: (payload: Record<string, unknown>) => void
}) {
  const [materialId, setMaterialId] = useState('')
  const [qty, setQty] = useState('1')
  const [supplier, setSupplier] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [poId, setPoId] = useState('')
  const [recvQty, setRecvQty] = useState('')

  return (
    <div className="d-grid gap-4">
      <div className="panel-card">
        <h3 className="section-title">Material requests</h3>
        {props.canManage ? (
          <Form
            className="filter-bar mb-3"
            onSubmit={(e) => {
              e.preventDefault()
              props.onRequest({
                project_id: props.projectId,
                material_id: Number(materialId),
                quantity: Number(qty),
                reason: 'Site requirement',
              })
            }}
          >
            <Form.Select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              required
            >
              <option value="">Material</option>
              {props.materials.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {String(m.name)}
                </option>
              ))}
            </Form.Select>
            <Form.Control
              type="number"
              min={0.01}
              step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <Button type="submit">Request</Button>
          </Form>
        ) : null}
        <Table responsive size="sm">
          <thead>
            <tr>
              <th>Material</th>
              <th>Qty</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {props.requests.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.material_name)}</td>
                <td>{String(r.quantity)}</td>
                <td>{String(r.status)}</td>
                <td className="table-actions">
                  {Boolean(r.can_approve) && String(r.status) === 'Pending' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline-success"
                        onClick={() => props.onReview(Number(r.id), 'Approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => props.onReview(Number(r.id), 'Rejected')}
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

      <div className="panel-card">
        <h3 className="section-title">Quotations</h3>
        {props.canManage ? (
          <Form
            className="filter-bar mb-3"
            onSubmit={(e) => {
              e.preventDefault()
              props.onQuote({
                project_id: props.projectId,
                material_id: Number(materialId),
                supplier_name: supplier,
                quantity: Number(qty),
                unit_price: Number(unitPrice),
              })
            }}
          >
            <Form.Control
              placeholder="Supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              required
            />
            <Form.Control
              type="number"
              placeholder="Unit price"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              required
            />
            <Button type="submit">Add quotation</Button>
          </Form>
        ) : null}
        <Table responsive size="sm">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Material</th>
              <th>Total</th>
              <th>Selected</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {props.quotations.map((q) => (
              <tr key={String(q.id)}>
                <td>{String(q.supplier_name)}</td>
                <td>{String(q.material_name)}</td>
                <td>K{Number(q.total_price).toLocaleString()}</td>
                <td>{q.is_selected ? 'Yes' : 'No'}</td>
                <td className="table-actions">
                  {props.canManage ? (
                    <>
                      <Button size="sm" onClick={() => props.onSelect(Number(q.id))}>
                        Prefer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => props.onPo(Number(q.id))}
                      >
                        Create PO
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="panel-card">
        <h3 className="section-title">Deliveries</h3>
        {props.canManage ? (
          <Form
            className="filter-bar mb-3"
            onSubmit={(e) => {
              e.preventDefault()
              props.onDelivery({
                purchase_order_id: Number(poId),
                quantity_received: Number(recvQty),
              })
            }}
          >
            <Form.Select value={poId} onChange={(e) => setPoId(e.target.value)} required>
              <option value="">Purchase order</option>
              {props.purchaseOrders.map((po) => (
                <option key={String(po.id)} value={String(po.id)}>
                  #{String(po.id)} {String(po.material_name)} ({String(po.status)})
                </option>
              ))}
            </Form.Select>
            <Form.Control
              type="number"
              placeholder="Qty received"
              value={recvQty}
              onChange={(e) => setRecvQty(e.target.value)}
              required
            />
            <Button type="submit">Record delivery</Button>
          </Form>
        ) : null}
        <ul className="activity-list">
          {props.deliveries.map((d) => (
            <li key={String(d.id)}>
              {String(d.material_name)} · qty {String(d.quantity_received)} on{' '}
              {String(d.delivery_date)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
