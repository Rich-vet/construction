import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  addMyTaskComment,
  fetchMyTask,
  updateMyTaskStatus,
  uploadTaskEvidence,
} from '../../api/worker'

export function TaskDetailPage() {
  const { id } = useParams()
  const taskId = Number(id)
  const [task, setTask] = useState<Record<string, unknown> | null>(null)
  const [comments, setComments] = useState<Array<Record<string, unknown>>>([])
  const [evidence, setEvidence] = useState<Array<Record<string, unknown>>>([])
  const [allowedStatuses, setAllowedStatuses] = useState<string[]>([])
  const [canUpdate, setCanUpdate] = useState(false)
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [evidenceName, setEvidenceName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchMyTask(taskId)
      .then((data) => {
        setTask(data.task)
        setComments(data.comments)
        setEvidence(data.evidence)
        setAllowedStatuses(data.allowed_statuses)
        setCanUpdate(data.can_update)
        setStatus(String(data.task.status))
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load task.'),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const onStatus = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await updateMyTaskStatus(taskId, status)
      setMessage('Task status updated.')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update status.')
    }
  }

  const onComment = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await addMyTaskComment(taskId, comment)
      setMessage('Comment added.')
      setComment('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to add comment.')
    }
  }

  const onEvidence = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please choose a file.')
      return
    }
    setError(null)
    setMessage(null)
    const form = new FormData()
    form.append('file', file)
    form.append('name', evidenceName || file.name)
    try {
      await uploadTaskEvidence(taskId, form)
      setMessage('Work evidence uploaded.')
      setFile(null)
      setEvidenceName('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to upload evidence.')
    }
  }

  if (loading && !task) {
    return (
      <AppShell breadcrumb="Tasks" title="Task" phaseLabel="Worker">
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      </AppShell>
    )
  }

  if (!task) {
    return (
      <AppShell breadcrumb="Tasks" title="Task" phaseLabel="Worker">
        <Alert variant="danger">{error ?? 'Task not found.'}</Alert>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={`Tasks / ${task.name}`} title={String(task.name)} phaseLabel="Worker">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="detail-panel mb-4">
        <div className="detail-panel__actions">
          <Link to="/tasks" className="btn btn-outline-secondary">
            Back to tasks
          </Link>
        </div>
        <p className="mb-1">
          <strong>Project:</strong> {String(task.project_name)}
        </p>
        <p className="mb-1">
          <strong>Due:</strong> {String(task.due_date ?? '—')} · <strong>Priority:</strong>{' '}
          {String(task.priority)}
        </p>
        <p className="mb-1">
          <strong>Status:</strong> <Badge bg="secondary">{String(task.status)}</Badge>
        </p>
        <p className="mb-0">{String(task.description ?? 'No description provided.')}</p>
      </div>

      {canUpdate ? (
        <section className="panel-card mb-4">
          <h2 className="section-title">Update status</h2>
          <Form className="filter-bar" onSubmit={(e) => void onStatus(e)}>
            <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {allowedStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Form.Select>
            <Button type="submit">Save status</Button>
          </Form>
        </section>
      ) : null}

      <div className="admin-panels">
        <section className="panel-card">
          <h2 className="section-title">Comments</h2>
          <Form className="mb-3" onSubmit={(e) => void onComment(e)}>
            <Form.Control
              as="textarea"
              rows={3}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a progress note..."
            />
            <Button type="submit" className="mt-2">
              Post comment
            </Button>
          </Form>
          {comments.length === 0 ? (
            <p className="text-muted mb-0">No comments yet.</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {comments.map((c) => (
                <li key={String(c.id)} className="mb-3 border-bottom pb-2">
                  <strong>{String(c.user_name)}</strong>
                  <div className="text-muted small">{String(c.created_at)}</div>
                  <div>{String(c.body)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-card">
          <h2 className="section-title">Work evidence</h2>
          <Form className="form-grid mb-3" onSubmit={(e) => void onEvidence(e)}>
            <Form.Group>
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={evidenceName}
                onChange={(e) => setEvidenceName(e.target.value)}
                placeholder="Optional"
              />
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
            <div className="form-grid__full">
              <Button type="submit">Upload evidence</Button>
            </div>
          </Form>
          {evidence.length === 0 ? (
            <p className="text-muted mb-0">No evidence uploaded yet.</p>
          ) : (
            <Table responsive hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((d) => (
                  <tr key={String(d.id)}>
                    <td>{String(d.name)}</td>
                    <td>{String(d.created_at)}</td>
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
          )}
        </section>
      </div>
    </AppShell>
  )
}
