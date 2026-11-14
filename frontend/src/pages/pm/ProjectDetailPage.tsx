import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap'
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
  requestTaskRework,
  verifyTask,
} from '../../api/projects'

export function ProjectDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const projectId = Number(id)
  const tabParam = searchParams.get('tab')
  const sectionKeys = [
    'overview',
    'tasks',
    'milestones',
    'team',
    'budget',
    'expenses',
    'procurement',
    'progress',
    'reports',
  ]
  const initialTab =
    tabParam === 'site'
      ? 'progress'
      : tabParam && sectionKeys.includes(tabParam)
        ? tabParam
        : null
  const [activeTab, setActiveTab] = useState<string | null>(initialTab)
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
        <div className="project-hero">
          <figure className="project-hero__media">
            <img src={sitePhotoFor(project, projectId)} alt={`Construction crew at ${String(project.name)}`} />
          </figure>
          <div className="project-hero__body">
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
        </div>
      </div>

      <div className="project-folds">
        {(
          [
            {
              key: 'overview',
              label: 'Overview',
              content: (
                <div className="panel-card">
                  <p>{String(project.description || 'No description provided.')}</p>
                  <p className="text-muted mb-0">
                    {String(project.start_date || '—')} → {String(project.expected_completion || '—')}
                  </p>
                </div>
              ),
            },
            {
              key: 'tasks',
              label: 'Tasks',
              content: (
                <WorkspaceTasks
                  canManage={canManage}
                  canOperateSite={canOperateSite}
                  projectId={projectId}
                  tasks={(workspace?.tasks as Array<Record<string, unknown>>) || []}
                  users={meta?.assignable_users || []}
                  members={(workspace?.members as Array<Record<string, unknown>>) || []}
                  onCreate={(payload) =>
                    run(() => createTask(payload), 'Task created successfully.')
                  }
                  onVerify={(tid) => run(() => verifyTask(tid), 'Work approved.')}
                  onRework={(tid, payload) =>
                    run(() => requestTaskRework(tid, payload), 'Task returned for rework.')
                  }
                />
              ),
            },
            {
              key: 'milestones',
              label: 'Milestones',
              content: (
                <WorkspaceMilestones
                  canManage={canManage}
                  projectId={projectId}
                  milestones={(workspace?.milestones as Array<Record<string, unknown>>) || []}
                  onCreate={(payload) =>
                    run(() => createMilestone(payload), 'Milestone created.')
                  }
                  onComplete={(mid) => run(() => completeMilestone(mid), 'Milestone completed.')}
                />
              ),
            },
            {
              key: 'team',
              label: 'Team',
              content: (
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
              ),
            },
            {
              key: 'budget',
              label: 'Budget',
              content: (
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
              ),
            },
            {
              key: 'expenses',
              label: 'Expenses',
              content: (
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
              ),
            },
            {
              key: 'procurement',
              label: 'Procurement',
              content: (
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
              ),
            },
            {
              key: 'progress',
              label: 'Progress',
              content: (
                <>
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
                </>
              ),
            },
            {
              key: 'reports',
              label: 'Reports',
              content: (
                <>
                  <div className="panel-card mb-3">
                    <p className="empty-hint mb-2">
                      Daily site reports are submitted via Site Diary. This section shows history for the project.
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
                </>
              ),
            },
          ] as Array<{ key: string; label: string; content: ReactNode }>
        ).map((section) => {
          const open = activeTab === section.key
          return (
            <section
              key={section.key}
              id={`project-section-${section.key}`}
              className={`project-fold${open ? ' is-open' : ''}`}
            >
              <button
                type="button"
                className="project-fold__trigger"
                aria-expanded={open}
                aria-controls={`project-panel-${section.key}`}
                onClick={() => {
                  setActiveTab(open ? null : section.key)
                }}
              >
                <span>{section.label}</span>
                <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
              </button>
              {open ? (
                <div className="project-fold__panel" id={`project-panel-${section.key}`}>
                  {section.content}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </AppShell>
  )
}

const SITE_PHOTOS = ['/sites/site-warehouse.jpg', '/sites/site-housing.jpg', '/sites/site-civic.jpg']

function sitePhotoFor(project: Record<string, unknown>, projectId: number) {
  const label = `${String(project.name || '')} ${String(project.location || '')}`.toLowerCase()
  if (label.includes('warehouse') || label.includes('ndola')) return SITE_PHOTOS[0]
  if (label.includes('housing') || label.includes('kitwe')) return SITE_PHOTOS[1]
  if (label.includes('civic') || label.includes('lusaka')) return SITE_PHOTOS[2]
  return SITE_PHOTOS[Math.abs(projectId) % SITE_PHOTOS.length]
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
  members: Array<Record<string, unknown>>
  onCreate: (payload: Record<string, unknown>) => void
  onVerify: (taskId: number) => void
  onRework: (taskId: number, payload: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [checklist, setChecklist] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [assigned, setAssigned] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [reworkFor, setReworkFor] = useState<number | null>(null)
  const [reworkNotes, setReworkNotes] = useState('')
  const [reworkDeadline, setReworkDeadline] = useState('')
  const siteWorkers = props.members.filter((member) => {
    const role = String(member.user_role || '')
    return role === 'Contractor/Worker' || role === ''
  })
  const canCreate = props.canManage || props.canOperateSite

  const submit = (e: FormEvent) => {
    e.preventDefault()
    props.onCreate({
      project_id: props.projectId,
      name,
      description,
      instructions,
      checklist: checklist.split('\n'),
      priority,
      assigned_user_id: assigned ? Number(assigned) : null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      require_evidence: false,
    })
    setName('')
    setDescription('')
    setInstructions('')
    setChecklist('')
  }

  return (
    <div className="panel-card">
      {canCreate ? (
        <Form className="form-grid mb-3" onSubmit={submit}>
          <Form.Group>
            <Form.Label>Task title</Form.Label>
            <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
          </Form.Group>
          <Form.Group>
            <Form.Label>Priority</Form.Label>
            <Form.Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {['Low', 'Medium', 'High', 'Urgent', 'Critical'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Site worker</Form.Label>
            <Form.Select value={assigned} onChange={(e) => setAssigned(e.target.value)} required>
              <option value="">Select a worker on this site</option>
              {siteWorkers.map((member) => (
                <option key={String(member.user_id)} value={String(member.user_id)}>
                  {String(member.user_name)} ({String(member.user_role || 'Member')})
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Deadline</Form.Label>
            <Form.Control type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Description</Form.Label>
            <Form.Control value={description} onChange={(e) => setDescription(e.target.value)} />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Work instructions</Form.Label>
            <Form.Control as="textarea" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Form.Group>
          <Form.Group className="form-grid__full">
            <Form.Label>Checklist (one item per line)</Form.Label>
            <Form.Control as="textarea" rows={2} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
          </Form.Group>
          <div className="form-grid__full">
            <Button type="submit">Create task</Button>
          </div>
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
              <td>
                {String(t.due_date ?? '—')}
                {t.is_overdue ? ' · Overdue' : ''}
              </td>
              <td>{String(t.status)}</td>
              <td className="table-actions">
                {props.canOperateSite && Boolean(t.can_verify) ? (
                  <>
                    <Button size="sm" variant="success" onClick={() => props.onVerify(Number(t.id))}>
                      Approve work
                    </Button>
                    <Button size="sm" variant="outline-warning" onClick={() => setReworkFor(Number(t.id))}>
                      Request rework
                    </Button>
                  </>
                ) : null}
                {t.completion_report ? (
                  <div className="small text-muted mt-1">{String(t.completion_report)}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {props.tasks.length === 0 ? <p className="empty-hint mt-3">No tasks yet.</p> : null}
      {reworkFor ? (
        <Form
          className="form-grid mt-3"
          onSubmit={(event) => {
            event.preventDefault()
            props.onRework(reworkFor, {
              instructions: reworkNotes,
              deficiencies: reworkNotes,
              new_deadline: new Date(reworkDeadline).toISOString(),
            })
            setReworkFor(null)
            setReworkNotes('')
            setReworkDeadline('')
          }}
        >
          <Form.Group className="form-grid__full">
            <Form.Label>Correction instructions</Form.Label>
            <Form.Control
              as="textarea"
              required
              value={reworkNotes}
              onChange={(e) => setReworkNotes(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>New deadline</Form.Label>
            <Form.Control
              type="datetime-local"
              required
              value={reworkDeadline}
              onChange={(e) => setReworkDeadline(e.target.value)}
            />
          </Form.Group>
          <div className="form-grid__full d-flex gap-2">
            <Button type="submit" variant="warning">
              Return for rework
            </Button>
            <Button type="button" variant="outline-secondary" onClick={() => setReworkFor(null)}>
              Cancel
            </Button>
          </div>
        </Form>
      ) : null}
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
  const selectedMaterial = props.materials.find((item) => String(item.id) === materialId)
  const quantityUnit = selectedMaterial ? String(selectedMaterial.unit || 'units') : ''
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
            <div className="qty-unit">
              <Form.Control
                type="number"
                min={0.01}
                step="0.01"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                aria-label="Quantity"
                aria-describedby="project-request-quantity-unit"
              />
              <span className="qty-unit__label" id="project-request-quantity-unit">
                {quantityUnit || 'Unit'}
              </span>
            </div>
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
                <td>
                  {String(r.quantity)} {String(r.unit || '')}
                </td>
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
