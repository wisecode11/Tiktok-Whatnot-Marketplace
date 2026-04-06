import { AuthApiError } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export interface ModeratorProfileResponse {
  profile: {
    id: string
    userId: string
    displayName: string
    headline: string
    bio: string
    yearsExperience: number | null
    hourlyRateCents: number | null
    responseTimeMinutes: number | null
    averageRating: number | null
    ratingCount: number
    skills: string[]
    availabilitySummary: string
    publicSlug: string | null
    profileStatus: "draft" | "pending_kyc" | "published" | "suspended"
    isPublished: boolean
    createdAt: string | null
    updatedAt: string | null
  }
}

export interface UpdateModeratorProfilePayload {
  displayName?: string
  headline?: string
  bio?: string
  yearsExperience?: number | null
  hourlyRateCents?: number | null
  responseTimeMinutes?: number | null
  skills?: string[]
  availabilitySummary?: string
  isPublished?: boolean
}

async function request<T>(
  path: string,
  {
    token,
    method = "GET",
    body,
  }: {
    token: string
    method?: "GET" | "POST" | "PUT"
    body?: Record<string, unknown>
  },
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

export function getMyModeratorProfile(token: string) {
  return request<ModeratorProfileResponse>("/api/moderator-profile/me", {
    token,
  })
}

export function updateMyModeratorProfile(token: string, payload: UpdateModeratorProfilePayload) {
  return request<ModeratorProfileResponse>("/api/moderator-profile/me", {
    token,
    method: "PUT",
    body: payload as Record<string, unknown>,
  })
}

export function publishMyModeratorProfile(token: string, payload?: UpdateModeratorProfilePayload) {
  return request<ModeratorProfileResponse>("/api/moderator-profile/me/publish", {
    token,
    method: "POST",
    body: payload as Record<string, unknown> | undefined,
  })
}
