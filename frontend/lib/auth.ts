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
