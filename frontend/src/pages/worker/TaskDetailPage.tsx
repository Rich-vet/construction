import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Form, Spinner } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ProgressBar, StatusPill } from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import {
  addMyTaskComment,
  fetchMyTask,
  updateMyTaskStatus,
  uploadTaskEvidence,
} from '../../api/worker'
import { formatDueLabel, taskProgressPercent } from './workerHelpers'

type TabKey = 'details' | 'instructions' | 'updates' | 'photos'

export function TaskDetailPage() {
  const { id } = useParams()
  const taskId = Number(id)
  const [task, setTask] = useState<Record<string, unknown> | null>(null)
  const [comments, setComments] = useState<Array<Record<string, unknown>>>([])
  const [evidence, setEvidence] = useState<Array<Record<string, unknown>>>([])
  const [allowedStatuses, setAllowedStatuses] = useState<string[]>([])
  const [canUpdate, setCanUpdate] = useState(false)
  const [tab, setTab] = useState<TabKey>('details')
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [evidenceName, setEvidenceName] = useState('')
  const [showProgressForm, setShowProgressForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
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
      setMessage('Progress updated.')
      setShowProgressForm(false)
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
      setMessage('Note added.')
      setComment('')
      setShowNoteForm(false)
      setTab('updates')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to add note.')
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
      setMessage('Photo uploaded.')
      setFile(null)
      setEvidenceName('')
      setTab('photos')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to upload evidence.')
    }
  }

  if (loading && !task) {
    return (
      <AppShell>
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      </AppShell>
    )
  }

  if (!task) {
    return (
      <AppShell>
        <Alert variant="danger">{error ?? 'Task not found.'}</Alert>
        <Link to="/tasks" className="btn btn-outline-secondary">
          Back to My Tasks
        </Link>
      </AppShell>
    )
  }

  const priority = String(task.priority || 'Medium')
  const progress = taskProgressPercent(task.status)
  const isComplete =
    String(task.status) === 'Verified' || String(task.status) === 'Completed'
  const canMarkReady = canUpdate && allowedStatuses.includes('Ready for Review') && !isComplete

  const markReadyForReview = async () => {
    if (!canMarkReady) return
    setError(null)
    setMessage(null)
    try {
      await updateMyTaskStatus(taskId, 'Ready for Review')
      setMessage('Task marked ready for review.')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit for review.')
    }
  }

  return (
    <AppShell>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="task-hero">
        <div className="task-hero__bg" aria-hidden="true" />
        <div className="task-hero__content">
          <Link to="/tasks" className="task-hero__back">
            <i className="bi bi-arrow-left" aria-hidden="true" /> My Tasks
          </Link>
          <div className="task-hero__title-row">
            <h1 className="task-hero__title">{String(task.name)}</h1>
            <StatusPill status={String(task.status)} />
          </div>
        </div>
      </div>

      <section className="panel-card task-detail-card">
        <div className="task-meta-grid">
          <div>
            <span className="task-meta-label">Project</span>
            <span className="task-meta-value">{String(task.project_name)}</span>
          </div>
          <div>
            <span className="task-meta-label">Assigned by</span>
            <span className="task-meta-value">{String(task.assigned_by_name ?? 'Site Engineer')}</span>
          </div>
          <div>
            <span className="task-meta-label">Due date</span>
            <span className="task-meta-value">{formatDueLabel(task.due_date)}</span>
          </div>
        </div>

        <div className="task-progress-block">
          <div className="task-progress-block__head">
            <span>Progress</span>
            <strong>{progress}%</strong>
          </div>
          <ProgressBar value={progress} />
        </div>

        <div className="filter-tabs task-detail-tabs" role="tablist">
          {(
            [
              ['details', 'Details'],
              ['instructions', 'Instructions'],
              ['updates', `Updates (${comments.length})`],
              ['photos', `Photos (${evidence.length})`],
            ] as Array<[TabKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`filter-tab${tab === key ? ' is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="task-tab-panel">
          {tab === 'details' ? (
            <>
              <div className="task-attr-row">
                <div className="task-attr">
                  <i className={`bi bi-flag-fill priority-icon priority-icon--${priority.toLowerCase()}`} />
                  <div>
                    <span className="task-meta-label">Priority</span>
                    <span className={`priority-chip priority-chip--${priority.toLowerCase()}`}>
                      {priority}
                    </span>
                  </div>
                </div>
                <div className="task-attr">
                  <i className="bi bi-clock" />
                  <div>
                    <span className="task-meta-label">Start date</span>
                    <span className="task-meta-value">
                      {task.start_date ? formatDueLabel(task.start_date) : '—'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="task-description">
                {String(task.description ?? 'No description provided.')}
              </p>
            </>
          ) : null}

          {tab === 'instructions' ? (
            <p className="task-description">
              {String(
                task.instructions ??
                  task.description ??
                  'Follow site engineer guidance and site safety procedures for this task.',
              )}
            </p>
          ) : null}

          {tab === 'updates' ? (
            comments.length === 0 ? (
              <p className="empty-hint">No updates yet. Add a note below.</p>
            ) : (
              <ul className="activity-feed">
                {comments.map((c) => (
                  <li key={String(c.id)} className="activity-feed__item">
                    <span className="activity-feed__dot" aria-hidden="true" />
                    <div>
                      <strong>{String(c.user_name)}</strong>
                      <p className="mb-0">{String(c.body)}</p>
                      <span className="activity-feed__time">{String(c.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'photos' ? (
            <>
              <Form className="form-grid mb-3" onSubmit={(e) => void onEvidence(e)}>
                <Form.Group>
                  <Form.Label>Photo name</Form.Label>
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
                    accept="image/*,.pdf"
                    required
                    onChange={(e) => {
                      const input = e.target as HTMLInputElement
                      setFile(input.files?.[0] ?? null)
                    }}
                  />
                </Form.Group>
                <div className="form-grid__full">
                  <button type="submit" className="btn btn-outline-secondary">
                    Upload photo
                  </button>
                </div>
              </Form>
              {evidence.length === 0 ? (
                <p className="empty-hint">No photos uploaded yet.</p>
              ) : (
                <ul className="evidence-list">
                  {evidence.map((d) => (
                    <li key={String(d.id)}>
                      <i className="bi bi-image" aria-hidden="true" />
                      <span>{String(d.name)}</span>
                      <a href={String(d.download_url)} target="_blank" rel="noreferrer">
                        View
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>

        {showProgressForm && canUpdate ? (
          <Form className="task-inline-form" onSubmit={(e) => void onStatus(e)}>
            <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {allowedStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Form.Select>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowProgressForm(false)}
            >
              Cancel
            </button>
          </Form>
        ) : null}

        {showNoteForm ? (
          <Form className="task-inline-form" onSubmit={(e) => void onComment(e)}>
            <Form.Control
              as="textarea"
              rows={3}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a progress note…"
            />
            <button type="submit" className="btn btn-primary">
              Post note
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowNoteForm(false)}
            >
              Cancel
            </button>
          </Form>
        ) : null}

        <div className="task-actions">
          {canUpdate && !isComplete ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowNoteForm(false)
                setShowProgressForm(true)
              }}
            >
              Update Progress
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              setShowProgressForm(false)
              setShowNoteForm(true)
            }}
          >
            Add Note
          </button>
          {canMarkReady ? (
            <button type="button" className="btn btn-success" onClick={() => void markReadyForReview()}>
              Mark Ready for Review
            </button>
          ) : null}
        </div>
      </section>
    </AppShell>
  )
}
