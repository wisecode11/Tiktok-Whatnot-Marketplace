import { AuthApiError } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export interface ShowHostAssignment {
  showId: string
  platform: string
  showTitle: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  hostStaffUserId: string
  hostName: string | null
  hostEmail: string | null
  assignedAt: string | null
  updatedAt: string | null
}

export interface ShowHostAssignmentsResponse {
  assignments: ShowHostAssignment[]
}

export interface AssignShowHostPayload {
  hostStaffUserId: string
  showTitle?: string
  scheduledStartAt?: string
  scheduledEndAt?: string
  platform?: string
}

export interface AssignShowHostResponse {
  assignment: ShowHostAssignment
}

async function request<T>(
  path: string,
  {
    token,
    method = "GET",
    body,
  }: { token: string; method?: "GET" | "PUT"; body?: Record<string, unknown> },
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
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

export function listShowHostAssignments(token: string) {
  return request<ShowHostAssignmentsResponse>("/api/staff/show-host-assignments", { token })
}

export function assignShowHost(token: string, showId: string, payload: AssignShowHostPayload) {
  return request<AssignShowHostResponse>(`/api/staff/show-host-assignments/${encodeURIComponent(showId)}`, {
    token,
    method: "PUT",
    body: payload as unknown as Record<string, unknown>,
  })
}

export function listMyShowAssignments(token: string) {
  return request<ShowHostAssignmentsResponse>("/api/staff/my-show-assignments", { token })
}
