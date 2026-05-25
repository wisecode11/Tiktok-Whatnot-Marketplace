"use client"

import { useAuth } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { io, type Socket } from "socket.io-client"

import { useToast } from "@/hooks/use-toast"
import { waitForSessionToken } from "@/lib/auth"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications"

const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"
const CHAT_SOCKET_PATH = "/socket.io/"
const POLL_MS = 30_000

interface ChatNotificationsContextValue {
  notifications: AppNotification[]
  unreadCount: number
  isLoading: boolean
  refreshNotifications: () => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const ChatNotificationsContext = createContext<ChatNotificationsContextValue | null>(null)

export function useChatNotifications() {
  const context = useContext(ChatNotificationsContext)

  if (!context) {
    throw new Error("useChatNotifications must be used within ChatNotificationsProvider")
  }

  return context
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) {
    return "Just now"
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  return date.toLocaleString()
}

function shouldSuppressToast({
  pathname,
  notification,
}: {
  pathname: string
  notification: AppNotification
}) {
  if (!pathname.includes("/chat")) {
    return false
  }

  const peerId = notification.senderUserId
  if (!peerId || typeof window === "undefined") {
    return false
  }

  const params = new URLSearchParams(window.location.search)
  if (params.get("peer") === String(peerId)) {
    return true
  }

  const activePeer = window.sessionStorage.getItem("activeChatPeerId")
  return activePeer === String(peerId)
}

export function ChatNotificationsProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth()
  const pathname = usePathname()
  const { toast } = useToast()
  const getTokenRef = useRef(getToken)
  const socketRef = useRef<Socket | null>(null)
  const seenNotificationIdsRef = useRef<Set<string>>(new Set())

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  getTokenRef.current = getToken

  const refreshNotifications = useCallback(async () => {
    if (!isLoaded) {
      return
    }

    try {
      const token = await waitForSessionToken(() => getTokenRef.current({ skipCache: true }))
      const result = await listNotifications(token)

      for (const item of result.notifications) {
        seenNotificationIdsRef.current.add(item.id)
      }

      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
    } catch {
      // Keep the last known notification state if polling fails.
    } finally {
      setIsLoading(false)
    }
  }, [isLoaded])

  const handleIncomingNotification = useCallback((notification: AppNotification) => {
    if (seenNotificationIdsRef.current.has(notification.id)) {
      return
    }

    seenNotificationIdsRef.current.add(notification.id)

    setNotifications((previous) => {
      const withoutDuplicate = previous.filter((item) => item.id !== notification.id)
      return [notification, ...withoutDuplicate].slice(0, 50)
    })

    if (!notification.isRead) {
      setUnreadCount((count) => count + 1)
    }

    if (!shouldSuppressToast({ pathname, notification })) {
      toast({
        title: notification.title,
        description: notification.body,
      })

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          const browserNotification = new window.Notification(notification.title, {
            body: notification.body,
            tag: notification.id,
          })

          browserNotification.onclick = () => {
            window.focus()
            if (notification.href) {
              window.location.href = notification.href
            }
          }
        } catch {
          // Ignore browser notification errors.
        }
      }
    }
  }, [pathname, toast])

  const markRead = useCallback(async (notificationId: string) => {
    const token = await waitForSessionToken(() => getTokenRef.current({ skipCache: true }))
    const result = await markNotificationRead(token, notificationId)

    setNotifications((previous) =>
      previous.map((item) =>
        item.id === notificationId
          ? { ...item, isRead: true, readAt: result.notification.readAt }
          : item,
      ),
    )
    setUnreadCount(result.unreadCount)
  }, [])

  const markAllRead = useCallback(async () => {
    const token = await waitForSessionToken(() => getTokenRef.current({ skipCache: true }))
    const result = await markAllNotificationsRead(token)

    setNotifications((previous) =>
      previous.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })),
    )
    setUnreadCount(result.unreadCount)
  }, [])

  useEffect(() => {
    void refreshNotifications()
  }, [refreshNotifications])

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") {
      return
    }

    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission()
    }
  }, [isLoaded])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    let cancelled = false

    async function connectNotificationSocket() {
      try {
        const token = await waitForSessionToken(() => getTokenRef.current({ skipCache: true }))
        const socket = io(SOCKET_BASE_URL, {
          path: CHAT_SOCKET_PATH,
          transports: ["polling", "websocket"],
          auth: { token },
          query: { token },
          reconnection: true,
          reconnectionAttempts: 8,
        })

        socketRef.current = socket

        socket.io.on("reconnect_attempt", () => {
          void waitForSessionToken(() => getTokenRef.current({ skipCache: true }))
            .then((freshToken) => {
              socket.auth = { token: freshToken }
              socket.io.opts.query = { token: freshToken }
            })
            .catch(() => {
              // Ignore token refresh errors during reconnect.
            })
        })

        socket.on("notification:new", (payload) => {
          if (!payload?.notification || cancelled) {
            return
          }

          handleIncomingNotification(payload.notification as AppNotification)
        })
      } catch {
        // REST polling still keeps the inbox usable.
      }
    }

    void connectNotificationSocket()

    const pollId = window.setInterval(() => {
      void refreshNotifications()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(pollId)

      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [isLoaded, handleIncomingNotification, refreshNotifications])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      refreshNotifications,
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, isLoading, refreshNotifications, markRead, markAllRead],
  )

  return (
    <ChatNotificationsContext.Provider value={value}>
      {children}
    </ChatNotificationsContext.Provider>
  )
}

export { formatRelativeTime }
