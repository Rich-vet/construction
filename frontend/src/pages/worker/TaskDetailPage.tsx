import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Form, Spinner } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ProgressBar, StatusPill } from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import {
  addMyTaskComment,
  addTaskProgress,
  fetchMyTask,
  submitTaskForInspection,
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
  const [progressPct, setProgressPct] = useState('0')
  const [progressNote, setProgressNote] = useState('')
  const [workDone, setWorkDone] = useState('')
  const [challenges, setChallenges] = useState('')
  const [completionReport, setCompletionReport] = useState('')
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [now, setNow] = useState(() => Date.now())
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [progressAttempted, setProgressAttempted] = useState(false)
  const [focusTarget, setFocusTarget] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchMyTask(taskId)
      .then((data) => {
        setTask(data.task)
        setComments(data.comments)
        setEvidence(data.evidence)
        setReports((data.progress_reports as Array<Record<string, unknown>>) || [])
        setAllowedStatuses(data.allowed_statuses)
        setCanUpdate(data.can_update)
        setStatus(String(data.task.status))
        setCompletionReport((current) => current || String(data.task.completion_report || ''))
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Unable to load task.')
        setFocusTarget('task-page-error')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!focusTarget) return
    const el = document.getElementById(focusTarget)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus()
    setFocusTarget(null)
  }, [focusTarget, tab])

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
      setFocusTarget('task-page-error')
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
      setFocusTarget('task-page-error')
    }
  }

  const onEvidence = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Choose a photo file before uploading.')
      setFocusTarget('submit-photos')
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
      setFocusTarget('submit-photos')
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
  const progress =
    task.progress_percent === undefined || task.progress_percent === null
      ? taskProgressPercent(task.status)
      : Number(task.progress_percent)
  const deadline = task.deadline_at ? new Date(String(task.deadline_at)).getTime() : null
  const remainingMs = deadline === null ? null : deadline - now
  const isComplete =
    String(task.status) === 'Verified' || String(task.status) === 'Completed'
  const overdue = Boolean(task.is_overdue) || (remainingMs !== null && remainingMs < 0 && !isComplete)
  let countdown = 'No deadline set'
  if (remainingMs !== null) {
    if (remainingMs <= 0) countdown = 'OVERDUE'
    else {
      const minutes = Math.floor(remainingMs / 60000)
      const days = Math.floor(minutes / (60 * 24))
      const hours = Math.floor((minutes % (60 * 24)) / 60)
      const mins = minutes % 60
      countdown = `${days} days, ${String(hours).padStart(2, '0')} hours, ${String(mins).padStart(2, '0')} minutes remaining`
    }
  }
  const statusName = String(task.status)
  const canStart = canUpdate && (statusName === 'Pending' || statusName === 'Rework Required')
  const canReport = canUpdate && (statusName === 'In Progress' || statusName === 'Rework Required')
  const canMarkReady = canUpdate && allowedStatuses.includes('Ready for Review') && !isComplete

  const needsPhotos = Boolean(task.require_evidence)
  const percentValue = Number(progressPct)
  const percentFilled = progressPct.trim() !== '' && !Number.isNaN(percentValue) && percentValue >= 0 && percentValue <= 100
  const progressDetailFilled = progressNote.trim() !== '' || workDone.trim() !== ''
  const reportFilled = completionReport.trim() !== ''
  const photosFilled = !needsPhotos || evidence.length > 0
  const progressSteps = [
    { id: 'progress-percent', label: 'Progress %', done: percentFilled },
    { id: 'progress-detail', label: 'What changed or work performed', done: progressDetailFilled },
  ]
  const submitSteps = [
    { id: 'submit-report', label: 'Completion report', done: reportFilled },
    { id: 'submit-confirm', label: 'Confirm the work is finished', done: confirmComplete },
    ...(needsPhotos ? [{ id: 'submit-photos', label: 'Completion photos', done: photosFilled }] : []),
  ]
  const progressReady = progressSteps.every((step) => step.done)
  const submitReady = submitSteps.every((step) => step.done)

  const revealGaps = (steps: Array<{ id: string; done: boolean }>, mark: (value: boolean) => void) => {
    mark(true)
    const first = steps.find((step) => !step.done)
    if (!first) return
    if (first.id === 'submit-photos') setTab('photos')
    setFocusTarget(first.id)
  }

  const markReadyForReview = async () => {
    if (!canMarkReady) return
    if (!submitReady) {
      revealGaps(submitSteps, setSubmitAttempted)
      return
    }
    setError(null)
    setMessage(null)
    try {
      await submitTaskForInspection(taskId, {
        completion_report: completionReport,
        confirm_complete: confirmComplete,
      })
      setMessage('Submitted for inspection.')
      setSubmitAttempted(false)
      load()
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Unable to submit for review.'
      setError(text)
      setSubmitAttempted(true)
      const lower = text.toLowerCase()
      if (lower.includes('photo') || lower.includes('evidence')) {
        setTab('photos')
        setFocusTarget('submit-photos')
      } else if (lower.includes('confirm')) {
        setFocusTarget('submit-confirm')
      } else {
        setFocusTarget('submit-report')
      }
    }
  }

  return (
    <AppShell>
      {error ? (
        <Alert id="task-page-error" variant="danger" tabIndex={-1}>
          {error}
        </Alert>
      ) : null}
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

        <p className={`deadline-readout${overdue ? ' is-overdue' : ''}`}>
          {overdue ? 'OVERDUE' : countdown}
          {overdue ? <span className="visually-hidden"> past the deadline</span> : null}
        </p>
        {task.rework_notes ? (
          <Alert variant="warning">
            Rework required ({String(task.rework_count || 0)} cycle
            {Number(task.rework_count) === 1 ? '' : 's'}): {String(task.rework_notes)}
          </Alert>
        ) : null}
        {statusName === 'Ready for Review' ? (
          <p className="text-muted">Awaiting inspection. This task is out of your active queue.</p>
        ) : null}
        <div className="d-flex flex-wrap gap-2 mb-3">
          {canStart ? (
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => void updateMyTaskStatus(taskId, 'In Progress').then(() => load())}
            >
              Start task
            </button>
          ) : null}
        </div>
        {canReport ? (
          <Form
            className="form-grid mb-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!progressReady) {
                revealGaps(progressSteps, setProgressAttempted)
                return
              }
              setError(null)
              void addTaskProgress(taskId, {
                percentage: Number(progressPct),
                description: progressNote,
                work_performed: workDone,
                challenges,
              })
                .then(() => {
                  setMessage('Progress recorded.')
                  setProgressNote('')
                  setWorkDone('')
                  setChallenges('')
                  setProgressAttempted(false)
                  load()
                })
                .catch((err: unknown) => {
                  const text = err instanceof ApiError ? err.message : 'Unable to save progress.'
                  setError(text)
                  setProgressAttempted(true)
                  setFocusTarget(text.toLowerCase().includes('percentage') ? 'progress-percent' : 'progress-detail')
                })
            }}
          >
            <AreaProgress
              title="Progress update"
              steps={progressSteps}
              attempted={progressAttempted}
              onJump={(id) => setFocusTarget(id)}
            />
            <Form.Group>
              <Form.Label>Progress %</Form.Label>
              <Form.Control
                id="progress-percent"
                type="number"
                min={0}
                max={100}
                value={progressPct}
                isInvalid={progressAttempted && !percentFilled}
                onChange={(e) => setProgressPct(e.target.value)}
              />
              {progressAttempted && !percentFilled ? (
                <div className="field-error">Enter a progress percentage from 0 to 100.</div>
              ) : null}
            </Form.Group>
            <Form.Group>
              <Form.Label>What changed</Form.Label>
              <Form.Control
                id="progress-detail"
                value={progressNote}
                isInvalid={progressAttempted && !progressDetailFilled}
                onChange={(e) => setProgressNote(e.target.value)}
              />
              {progressAttempted && !progressDetailFilled ? (
                <div className="field-error">Describe what changed or the work performed.</div>
              ) : null}
            </Form.Group>
            <Form.Group className="form-grid__full">
              <Form.Label>Work performed</Form.Label>
              <Form.Control
                id="progress-work"
                value={workDone}
                isInvalid={progressAttempted && !progressDetailFilled}
                onChange={(e) => setWorkDone(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="form-grid__full">
              <Form.Label>Challenges</Form.Label>
              <Form.Control value={challenges} onChange={(e) => setChallenges(e.target.value)} />
            </Form.Group>
            <div className="form-grid__full">
              <button
                type="submit"
                className="btn btn-outline-secondary"
                aria-disabled={!progressReady}
                onClick={(event) => {
                  if (!progressReady) {
                    event.preventDefault()
                    revealGaps(progressSteps, setProgressAttempted)
                  }
                }}
              >
                Save progress
              </button>
            </div>
          </Form>
        ) : null}
        {canReport ? (
          <Form
            className="form-grid mb-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!submitReady) {
                revealGaps(submitSteps, setSubmitAttempted)
                return
              }
              setError(null)
              void submitTaskForInspection(taskId, {
                completion_report: completionReport,
                confirm_complete: confirmComplete,
              })
                .then(() => {
                  setMessage('Submitted for inspection.')
                  setSubmitAttempted(false)
                  load()
                })
                .catch((err: unknown) => {
                  const text = err instanceof ApiError ? err.message : 'Unable to submit task.'
                  setError(text)
                  setSubmitAttempted(true)
                  const lower = text.toLowerCase()
                  if (lower.includes('photo') || lower.includes('evidence')) {
                    setTab('photos')
                    setFocusTarget('submit-photos')
                  } else if (lower.includes('confirm')) {
                    setFocusTarget('submit-confirm')
                  } else {
                    setFocusTarget('submit-report')
                  }
                })
            }}
          >
            <AreaProgress
              title="Inspection submission"
              steps={submitSteps}
              attempted={submitAttempted}
              onJump={(id) => {
                if (id === 'submit-photos') setTab('photos')
                setFocusTarget(id)
              }}
            />
            <Form.Group className="form-grid__full">
              <Form.Label>Completion report</Form.Label>
              <Form.Control
                id="submit-report"
                as="textarea"
                rows={3}
                value={completionReport}
                isInvalid={submitAttempted && !reportFilled}
                onChange={(e) => setCompletionReport(e.target.value)}
              />
              {submitAttempted && !reportFilled ? (
                <div className="field-error">Completion report is required.</div>
              ) : null}
            </Form.Group>
            <Form.Group className="form-grid__full">
              <Form.Check
                id="submit-confirm"
                label="The required work is finished"
                checked={confirmComplete}
                isInvalid={submitAttempted && !confirmComplete}
                onChange={(e) => setConfirmComplete(e.target.checked)}
              />
              {submitAttempted && !confirmComplete ? (
                <div className="field-error">Confirm that the required work is finished.</div>
              ) : null}
            </Form.Group>
            <div className="form-grid__full">
              <button
                type="submit"
                className="btn btn-accent"
                aria-disabled={!submitReady}
                onClick={(event) => {
                  if (!submitReady) {
                    event.preventDefault()
                    revealGaps(submitSteps, setSubmitAttempted)
                  }
                }}
              >
                Submit for inspection
              </button>
            </div>
          </Form>
        ) : null}
        {reports.length > 0 ? (
          <ul className="activity-feed">
            {reports.map((row) => (
              <li key={String(row.id)}>
                {String(row.percentage)}% — {String(row.description || row.work_performed || 'Update')}
              </li>
            ))}
          </ul>
        ) : null}

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
                    id="submit-photos"
                    type="file"
                    accept="image/*,.pdf"
                    isInvalid={submitAttempted && needsPhotos && !photosFilled}
                    onChange={(e) => {
                      const input = e.target as HTMLInputElement
                      setFile(input.files?.[0] ?? null)
                    }}
                  />
                  {submitAttempted && needsPhotos && !photosFilled ? (
                    <div className="field-error">Upload completion photos before submitting this task.</div>
                  ) : null}
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
            <button
              type="button"
              className="btn btn-success"
              aria-disabled={!submitReady}
              onClick={() => void markReadyForReview()}
            >
              Mark Ready for Review
            </button>
          ) : null}
        </div>
      </section>
    </AppShell>
  )
}

function AreaProgress({
  title,
  steps,
  attempted,
  onJump,
}: {
  title: string
  steps: Array<{ id: string; label: string; done: boolean }>
  attempted: boolean
  onJump: (id: string) => void
}) {
  const done = steps.filter((step) => step.done).length
  const remaining = steps.filter((step) => !step.done)
  const pct = steps.length === 0 ? 0 : Math.round((done / steps.length) * 100)
  return (
    <div className="submit-progress form-grid__full" id={`${title.toLowerCase().replace(/\s+/g, '-')}-progress`}>
      <div className="submit-progress__head">
        <span>{title}</span>
        <strong>
          {remaining.length === 0
            ? 'All areas complete'
            : `${remaining.length} area${remaining.length === 1 ? '' : 's'} remaining`}
        </strong>
      </div>
      <ProgressBar value={pct} />
      {remaining.length > 0 ? (
        <ul className="submit-progress__remaining">
          {remaining.map((step) => (
            <li key={step.id}>
              <button type="button" onClick={() => onJump(step.id)}>
                {attempted ? 'Required: ' : 'Still needed: '}
                {step.label}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="submit-progress__ready">Every required area is filled.</p>
      )}
    </div>
  )
}
