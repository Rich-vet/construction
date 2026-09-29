import { Navigate } from 'react-router-dom'

/** Company profile now lives under Settings — keep route for old links. */
export function CompanyProfilePage() {
  return <Navigate to="/settings" replace />
}
