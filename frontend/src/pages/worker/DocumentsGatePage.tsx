import { useAuth } from '../../context/AuthContext'
import { DocumentsPage } from '../se/DocumentsPage'
import { WorkerDocumentsPage } from './WorkerDocumentsPage'

export function DocumentsGatePage() {
  const { user } = useAuth()
  if (user?.role === 'Contractor/Worker') {
    return <WorkerDocumentsPage />
  }
  return <DocumentsPage />
}
