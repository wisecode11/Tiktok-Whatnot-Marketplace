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

export type PublicModeratorProfile = ModeratorProfileResponse["profile"] & {
  availability: {
    timezone: string
    weekly: Array<{
      dayOfWeek: number
      isAvailable: boolean
      startTime: string
      endTime: string
      breaks: Array<{ startTime: string; endTime: string }>
    }>
    holidays: string[]
    timeOffRanges: Array<{
      startAt: string
      endAt: string
      reason: string
    }>
  }
}

export interface PublicModeratorProfileResponse {
  profile: PublicModeratorProfile
}

export interface PublicModeratorsResponse {
  moderators: ModeratorProfileResponse["profile"][]
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

export interface ModeratorAvailabilityResponse {
  availability: {
    timezone: string
    weekly: Array<{
      dayOfWeek: number
      isAvailable: boolean
      startTime: string
      endTime: string
      breaks: Array<{ startTime: string; endTime: string }>
    }>
    holidays: string[]
    timeOffRanges: Array<{
      startAt: string
      endAt: string
      reason: string
    }>
  }
}

export interface UpdateModeratorAvailabilityPayload {
  timezone: string
  weekly: Array<{
    dayOfWeek: number
    isAvailable: boolean
    startTime: string
    endTime: string
  }>
  breaks: Array<{
    dayOfWeek: number
    startTime: string
    endTime: string
  }>
  holidays: string[]
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

async function requestPublic<T>(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
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

export function getMyModeratorAvailability(token: string) {
  return request<ModeratorAvailabilityResponse>("/api/moderator-profile/me/availability", {
    token,
  })
}

export function updateMyModeratorAvailability(token: string, payload: UpdateModeratorAvailabilityPayload) {
  return request<ModeratorAvailabilityResponse>("/api/moderator-profile/me/availability", {
    token,
    method: "PUT",
    body: payload as Record<string, unknown>,
  })
}

export function listPublicModerators(params?: {
  search?: string
  skills?: string[]
  minExperience?: number | null
  minRating?: number | null
}) {
  const query = new URLSearchParams()

  if (params?.search) {
    query.set("search", params.search)
  }

  if (params?.skills?.length) {
    query.set("skills", params.skills.join(","))
  }

  if (params?.minExperience !== null && params?.minExperience !== undefined) {
    query.set("minExperience", String(params.minExperience))
  }

  if (params?.minRating !== null && params?.minRating !== undefined) {
    query.set("minRating", String(params.minRating))
  }

  const suffix = query.toString() ? `?${query.toString()}` : ""
  return requestPublic<PublicModeratorsResponse>(`/api/moderator-profile/public${suffix}`)
}

export function getPublicModeratorProfileBySlug(slug: string) {
  return requestPublic<PublicModeratorProfileResponse>(`/api/moderator-profile/public/${encodeURIComponent(slug)}`)
}

export function getPublicModeratorProfileByUserId(userId: string) {
  return requestPublic<PublicModeratorProfileResponse>(`/api/moderator-profile/public/user/${encodeURIComponent(userId)}`)
}
