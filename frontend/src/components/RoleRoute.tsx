import { Navigate, Outlet } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext'

type RoleRouteProps = {
  roles: string[]
}

export function RoleRoute({ roles }: RoleRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-loading" role="status">
        <Spinner animation="border" />
        <p>Checking permissions…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
