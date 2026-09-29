import { Navigate, useSearchParams } from 'react-router-dom'

/** Legacy progress-updates URL → Site Diary. */
export function ProgressUpdatesPage() {
  const [params] = useSearchParams()
  const qs = params.toString()
  return <Navigate to={qs ? `/site-diary?${qs}` : '/site-diary'} replace />
}
