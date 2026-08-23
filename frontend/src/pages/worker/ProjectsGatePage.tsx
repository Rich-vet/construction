import { useAuth } from '../../context/AuthContext'
import { ProjectsListPage } from '../pm/ProjectsListPage'
import { WorkerProjectsPage } from './WorkerProjectsPage'

/** Role-aware projects list: workers get a read-only team view. */
export function ProjectsGatePage() {
  const { user } = useAuth()
  if (user?.role === 'Contractor/Worker') {
    return <WorkerProjectsPage />
  }
  return <ProjectsListPage />
}
