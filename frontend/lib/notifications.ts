import { AuthApiError } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export interface AppNotification {
  id: string
  type: "chat_message" | string
  title: string
  body: string
  href: string | null
  metadata: {
    threadId?: string
    messageId?: string
    senderName?: string
  }
  senderUserId: string | null
  readAt: string | null
  createdAt: string
  isRead: boolean
}

export interface NotificationsResponse {
  notifications: AppNotification[]
  unreadCount: number
}

async function request<T>(
  path: string,
  {
    token,
    method = "GET",
  }: {
    token: string
    method?: "GET" | "PATCH"
  },
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new AuthApiError(
      (payload && (payload.error as string)) || "Request failed.",
      response.status,
      payload && payload.details,
    )
  }

  return payload as T
}

export function listNotifications(token: string, limit = 30) {
  return request<NotificationsResponse>(`/api/notifications?limit=${limit}`, { token })
}

export function markNotificationRead(token: string, notificationId: string) {
  return request<{ notification: AppNotification; unreadCount: number }>(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    { token, method: "PATCH" },
  )
}

export function markAllNotificationsRead(token: string) {
  return request<{ unreadCount: number }>("/api/notifications/read-all", {
    token,
    method: "PATCH",
  })
}
