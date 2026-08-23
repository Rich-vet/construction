import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute'
import { RoleRoute } from './components/RoleRoute'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { HomePage } from './pages/HomePage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { UsersListPage } from './pages/admin/UsersListPage'
import { UserFormPage } from './pages/admin/UserFormPage'
import { UserDetailPage } from './pages/admin/UserDetailPage'
import { CompanyProfilePage } from './pages/admin/CompanyProfilePage'
import { ActivityLogPage } from './pages/admin/ActivityLogPage'
import { NotificationsPage } from './pages/admin/NotificationsPage'
import { SettingsPage } from './pages/admin/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />

            <Route element={<RoleRoute roles={['Administrator']} />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/users" element={<UsersListPage />} />
              <Route path="/users/create" element={<UserFormPage mode="create" />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
              <Route path="/users/:id/edit" element={<UserFormPage mode="edit" />} />
              <Route path="/company" element={<CompanyProfilePage />} />
              <Route path="/activity-log" element={<ActivityLogPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
