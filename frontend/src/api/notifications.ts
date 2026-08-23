import { apiRequest } from './auth'

export type NotificationItem = {
  id: number
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string | null
}

type PaginatedNotifications = {
  items: NotificationItem[]
  unread_count: number
  page: number
  pages: number
  total: number
}

export function fetchNotifications(page = 1) {
  return apiRequest<PaginatedNotifications>(`/api/notifications?page=${page}`)
}

export function fetchUnreadCount() {
  return apiRequest<{ unread_count: number }>('/api/notifications/unread-count')
}

export function markNotificationRead(id: number) {
  return apiRequest<{ message: string; notification: NotificationItem }>(
    `/api/notifications/${id}/read`,
    { method: 'POST', csrf: true },
  )
}

export function markAllNotificationsRead() {
  return apiRequest<{ message: string; updated: number }>('/api/notifications/read-all', {
    method: 'POST',
    csrf: true,
  })
}
