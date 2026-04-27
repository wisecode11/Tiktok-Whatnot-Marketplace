import { AuthApiError } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export interface StaffMember {
  id: string
  clerkUserId: string | null
  username: string | null
  email: string
  firstName: string
  lastName: string
  role: "staff"
  status: string
  streamerUserId: string | null
  workspaceId: string | null
  joinedAt: string | null
  createdAt: string | null
}

export interface StaffMembersResponse {
  staff: StaffMember[]
}

export interface CreateStaffMemberPayload {
  username: string
  email: string
  password: string
}

export interface CreateStaffMemberResponse {
  member: StaffMember
  emailError: string | null
  emailSent: boolean
  loginUrl: string
  message: string
}

async function request<T>(
  path: string,
  {
    token,
    method = "GET",
    body,
  }: { token: string; method?: "GET" | "POST"; body?: Record<string, unknown> },
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

export function listStaffMembers(token: string) {
  return request<StaffMembersResponse>("/api/staff/members", { token })
}

export function createStaffMember(token: string, payload: CreateStaffMemberPayload) {
  return request<CreateStaffMemberResponse>("/api/staff/members", {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}