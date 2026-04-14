export type AppRole = "streamer" | "moderator" | "admin"

export interface AuthUserProfile {
  id: string
  clerkUserId: string
  email: string
  firstName: string
  lastName: string
  role: AppRole
  backendRole: "seller" | "moderator" | "admin"
  status: string
  dashboardPath: string
}

export interface AuthResponse {
  user: AuthUserProfile
  redirectTo: string
}

export interface ConnectedAccountResponse {
  accounts: Array<{
    id: string
    platform: string
    connected: boolean
    status: string
    username: string | null
    externalId: string | null
    expiresAt: string | null
  }>
}

export interface PlatformConnectionResponse {
  authorizationUrl: string
}

export interface TikTokProfileResponse {
  connected: boolean
  profile: {
    openId: string | null
    unionId: string | null
    avatarUrl: string | null
    avatarLargeUrl: string | null
    displayName: string | null
    username: string | null
    bioDescription: string | null
    profileDeepLink: string | null
    isVerified: boolean | null
    followerCount: number | null
    followingCount: number | null
    likesCount: number | null
    videoCount: number | null
  } | null
  account: {
    platform: string
    status: string
    username: string | null
    externalId: string | null
    expiresAt: string | null
    lastSyncedAt: string | null
    scopes: string | null
    fields: string | null
  } | null
}

export interface TikTokVideoAnalyticsResponse {
  connected: boolean
  hasVideoScope: boolean
  account: {
    platform: string
    status: string
    username: string | null
    scopes: string | null
  } | null
  followerBreakdown: {
    followers: number | null
    following: number | null
    likes: number | null
    videos: number | null
  } | null
  summary: {
    totalVideos: number
    totalViews: number | null
    totalComments: number | null
    totalLikes: number | null
    totalShares: number | null
  }
  videos: Array<{
    id: string | null
    title: string | null
    coverImageUrl: string | null
    shareUrl: string | null
    createTime: number | null
    viewCount: number | null
    commentCount: number | null
    likeCount: number | null
    shareCount: number | null
  }>
  pagination: {
    cursor: number | null
    hasMore: boolean
  }
}

export interface TikTokCreatorInfoResponse {
  connected: boolean
  creator: {
    avatarUrl: string | null
    username: string | null
    nickname: string | null
    privacyLevelOptions: string[]
    commentDisabled: boolean
    duetDisabled: boolean
    stitchDisabled: boolean
    maxVideoPostDurationSec: number | null
    canPost: boolean
    cannotPostReason: string | null
  }
  account: {
    platform: string
    username: string | null
    externalId: string | null
    scopes: string | null
    expiresAt: string | null
    isAudited: boolean
  }
}

export interface TikTokPostRecord {
  id: string
  publishId: string
  mediaType: "VIDEO" | "PHOTO"
  postMode: "DIRECT_POST" | "MEDIA_UPLOAD"
  sourceType: "PULL_FROM_URL" | "FILE_UPLOAD"
  status: string
  failReason: string | null
  publiclyAvailablePostIds: string[]
  mediaUrls: string[]
  title: string | null
  description: string | null
  privacyLevel: string | null
  creatorUsername: string | null
  creatorNickname: string | null
  requestedAt: string | null
  completedAt: string | null
  lastStatusCheckedAt: string | null
}

export interface CreateTikTokVideoPostPayload {
  title?: string
  privacyLevel: string
  videoUrl: string
  videoCoverTimestampMs?: number
  videoDurationSec?: number
  disableDuet?: boolean
  disableComment?: boolean
  disableStitch?: boolean
  brandContentToggle?: boolean
  brandOrganicToggle?: boolean
  isAigc?: boolean
}

export interface CreateTikTokPhotoPostPayload {
  title?: string
  description?: string
  privacyLevel: string
  photoImages: string[]
  photoCoverIndex?: number
  disableComment?: boolean
  autoAddMusic?: boolean
  brandContentToggle?: boolean
  brandOrganicToggle?: boolean
}

export interface TikTokPublishResponse {
  publishId: string
  creator: TikTokCreatorInfoResponse["creator"]
  post: TikTokPostRecord
}

export interface TikTokPostStatusResponse {
  post: TikTokPostRecord
  status: {
    status: string
    failReason: string | null
    uploadedBytes: number | null
    downloadedBytes: number | null
    publiclyAvailablePostIds: string[]
  }
}

export class AuthApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "AuthApiError"
    this.status = status
    this.details = details
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) {
    return null
  }

  const value = role.toLowerCase()

  if (value === "seller" || value === "streamer") {
    return "streamer"
  }

  if (value === "moderator" || value === "admin") {
    return value
  }

  return null
}

export function buildPath(
  path: string,
  params: Record<string, string | null | undefined> = {},
) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value)
    }
  }

  const query = searchParams.toString()
  return query ? `${path}?${query}` : path
}

export function getDashboardPath(role: AppRole) {
  if (role === "admin") {
    return "/admin"
  }

  if (role === "moderator") {
    return "/moderator"
  }

  return "/seller"
}

export function getSignupRedirectPath(role: AppRole) {
  if (role === "admin") {
    return getDashboardPath(role)
  }

  return `/launch-pad?role=${role}`
}

export function getClerkErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
    (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.length
  ) {
    const firstError = (error as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
    return firstError.longMessage || firstError.message || "Authentication failed."
  }

  if (error instanceof AuthApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

export async function waitForSessionToken(
  getToken: () => Promise<string | null>,
  maxAttempts = 8,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = await getToken()

    if (token) {
      return token
    }

    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  throw new Error("Unable to establish an authenticated session.")
}

async function request<T>(
  path: string,
  {
    token,
    method = "GET",
    body,
  }: { token: string; method?: "GET" | "POST" | "DELETE"; body?: Record<string, unknown> },
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

export async function syncCurrentUser(token: string, role: AppRole) {
  return request<AuthResponse>("/api/auth/sync-user", {
    method: "POST",
    token,
    body: { role },
  })
}

export async function loginWithRole(token: string, role: AppRole) {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    token,
    body: { role },
  })
}

export async function getCurrentUserProfile(token: string) {
  return request<AuthResponse>("/api/auth/me", {
    token,
  })
}

export async function getConnectedAccounts(token: string) {
  return request<ConnectedAccountResponse>("/api/integrations/accounts", {
    token,
  })
}

export async function startPlatformConnection(token: string, platform: string, role: AppRole) {
  return request<PlatformConnectionResponse>("/api/integrations/connect", {
    token,
    method: "POST",
    body: { platform, role },
  })
}

export async function disconnectPlatform(token: string, platform: string) {
  return request<{ success: boolean }>(`/api/integrations/accounts/${platform}`, {
    token,
    method: "DELETE",
  })
}

export interface StripeStatusResponse {
  connected: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  requirements: string[]
  detailsSubmitted: boolean
  stripeAccountId: string
}

export async function getStripeStatus(token: string) {
  return request<StripeStatusResponse>("/api/integrations/stripe/status", { token })
}

export async function getTikTokProfile(token: string) {
  return request<TikTokProfileResponse>("/api/integrations/tiktok/profile", { token })
}

export async function getTikTokCreatorInfo(token: string) {
  return request<TikTokCreatorInfoResponse>("/api/integrations/tiktok/creator-info", { token })
}

export async function createTikTokVideoPost(token: string, payload: CreateTikTokVideoPostPayload) {
  return request<TikTokPublishResponse>("/api/integrations/tiktok/posts/video", {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}

export async function createTikTokPhotoPost(token: string, payload: CreateTikTokPhotoPostPayload) {
  return request<TikTokPublishResponse>("/api/integrations/tiktok/posts/photo", {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}

export async function getTikTokPostStatus(token: string, publishId: string) {
  return request<TikTokPostStatusResponse>("/api/integrations/tiktok/posts/status", {
    token,
    method: "POST",
    body: { publishId },
  })
}

export async function getTikTokVideoAnalytics(token: string, params?: { cursor?: number; maxCount?: number }) {
  const search = new URLSearchParams()

  if (typeof params?.cursor === "number") {
    search.set("cursor", String(params.cursor))
  }

  if (typeof params?.maxCount === "number") {
    search.set("maxCount", String(params.maxCount))
  }

  const query = search.toString()
  const path = query ? `/api/integrations/tiktok/video-analytics?${query}` : "/api/integrations/tiktok/video-analytics"

  return request<TikTokVideoAnalyticsResponse>(path, { token })
}
