import { useAuth } from '../../context/AuthContext'
import { AttendancePage } from '../se/AttendancePage'
import { MyAttendancePage } from './MyAttendancePage'

/** Role-aware attendance: workers view own records; SE/PM record attendance. */
export function AttendanceGatePage() {
  const { user } = useAuth()
  if (user?.role === 'Contractor/Worker') {
    return <MyAttendancePage />
  }
  return <AttendancePage />
}
