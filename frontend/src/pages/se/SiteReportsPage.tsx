import { Navigate, useSearchParams } from 'react-router-dom'

/** Legacy site-reports URL → Site Diary. */
export function SiteReportsPage() {
  const [params] = useSearchParams()
  const qs = params.toString()
  return <Navigate to={qs ? `/site-diary?${qs}` : '/site-diary'} replace />
}
