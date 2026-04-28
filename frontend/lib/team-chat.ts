import { AuthApiError } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

async function request<T>(
  path: string,
  {
    token,
    method = "GET",
    body,
  }: {
    token: string
    method?: "GET" | "POST"
    body?: Record<string, unknown>
  },
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    
    body: body ? JSON.stringify(body) : undefined,
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

export interface ChatThread {
  id: string
  peer: {
    userId: string | null
    role: "streamer" | "moderator"
    name: string
    email: string | null
  }
  lastMessage: {
    body: string | null
    at: string | null
    senderUserId: string | null
  }
  unreadCount: number
  updatedAt: string | null
}

export interface ChatMessage {
  id: string
  threadId: string
  senderUserId: string
  body: string
  createdAt: string
}

export interface ListThreadsResponse {
  threads: ChatThread[]
}

export interface OpenThreadResponse {
  thread: ChatThread
}

export interface ListMessagesResponse {
  threadId: string
  messages: ChatMessage[]
}

export interface SendMessageResponse {
  message: ChatMessage
}

export function listChatThreads(token: string) {
  return request<ListThreadsResponse>("/api/chat/threads", { token, method: "GET" })
}

export function openChatThread(token: string, peerUserId: string) {
  return request<OpenThreadResponse>("/api/chat/threads", {
    token,
    method: "POST",
    body: { peerUserId },
  })
}

export function listChatMessages(token: string, threadId: string, limit = 100) {
  return request<ListMessagesResponse>(`/api/chat/threads/${encodeURIComponent(threadId)}/messages?limit=${limit}`, {
    token,
    method: "GET",
  })
}

export function sendChatMessage(token: string, threadId: string, body: string) {
  return request<SendMessageResponse>(`/api/chat/threads/${encodeURIComponent(threadId)}/messages`, {
    token,
    method: "POST",
    body: { body },
  })
}
