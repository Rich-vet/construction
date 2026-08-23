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
import { PmDashboardPage } from './pages/pm/PmDashboardPage'
import { ProjectFormPage } from './pages/pm/ProjectFormPage'
import { ProjectDetailPage } from './pages/pm/ProjectDetailPage'
import { MaterialRequestsPage } from './pages/pm/MaterialRequestsPage'
import { PmReportsPage } from './pages/pm/PmReportsPage'
import { SeDashboardPage } from './pages/se/SeDashboardPage'
import { MaterialsPage } from './pages/se/MaterialsPage'
import { EquipmentPage } from './pages/se/EquipmentPage'
import { ProgressUpdatesPage } from './pages/se/ProgressUpdatesPage'
import { SiteReportsPage } from './pages/se/SiteReportsPage'
import { DocumentsPage } from './pages/se/DocumentsPage'
import { WorkerDashboardPage } from './pages/worker/WorkerDashboardPage'
import { MyTasksPage } from './pages/worker/MyTasksPage'
import { TaskDetailPage } from './pages/worker/TaskDetailPage'
import { ProjectsGatePage } from './pages/worker/ProjectsGatePage'
import { AttendanceGatePage } from './pages/worker/AttendanceGatePage'

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
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route
              element={
                <RoleRoute
                  roles={[
                    'Administrator',
                    'Project Manager',
                    'Site Engineer',
                    'Contractor/Worker',
                  ]}
                />
              }
            >
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/projects" element={<ProjectsGatePage />} />
              <Route path="/attendance" element={<AttendanceGatePage />} />
            </Route>

            <Route
              element={
                <RoleRoute roles={['Administrator', 'Project Manager', 'Site Engineer']} />
              }
            >
              <Route path="/material-requests" element={<MaterialRequestsPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/equipment" element={<EquipmentPage />} />
              <Route path="/progress-updates" element={<ProgressUpdatesPage />} />
              <Route path="/site-reports" element={<SiteReportsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
            </Route>

            <Route element={<RoleRoute roles={['Administrator', 'Project Manager']} />}>
              <Route path="/pm" element={<PmDashboardPage />} />
              <Route path="/projects/create" element={<ProjectFormPage mode="create" />} />
              <Route path="/projects/:id/edit" element={<ProjectFormPage mode="edit" />} />
              <Route path="/reports" element={<PmReportsPage />} />
            </Route>

            <Route
              element={
                <RoleRoute roles={['Administrator', 'Project Manager', 'Site Engineer']} />
              }
            >
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
            </Route>

            <Route element={<RoleRoute roles={['Site Engineer', 'Administrator']} />}>
              <Route path="/se" element={<SeDashboardPage />} />
            </Route>

            <Route element={<RoleRoute roles={['Contractor/Worker', 'Administrator']} />}>
              <Route path="/worker" element={<WorkerDashboardPage />} />
              <Route path="/tasks" element={<MyTasksPage />} />
              <Route path="/tasks/:id" element={<TaskDetailPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
