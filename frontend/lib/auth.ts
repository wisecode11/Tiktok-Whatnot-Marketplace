export type AppRole = "streamer" | "staff" | "moderator" | "admin"

export interface AuthUserProfile {
  id: string
  clerkUserId: string
  email: string
  firstName: string
  lastName: string
  role: AppRole
  backendRole: "seller" | "staff" | "moderator" | "admin"
  activeWorkspaceId: string | null
  status: string
  dashboardPath: string
}

export interface AuthResponse {
  user: AuthUserProfile
  redirectTo: string
}

export interface SellerOrganization {
  id: string
  name: string
  slug: string | null
  clerkOrganizationId: string | null
  status: string
  isActive: boolean
  createdAt: string | null
}

export interface SellerOrganizationsResponse {
  organizations: SellerOrganization[]
  activeWorkspaceId: string | null
  hasOrganizations: boolean
}

export interface SellerOrganizationMutationResponse {
  organization: SellerOrganization
  redirectTo: string
}

export interface SellerOrganizationMembersSyncResponse {
  organization: SellerOrganization
  syncedUsers: number
  syncedMemberships: number
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

export interface WhatnotProductEdge {
  cursor: string | null
  node: {
    id: string | null
    title: string | null
    description: string | null
  }
}

export interface WhatnotInventorySnapshotResponse {
  connected: boolean
  source: "live" | "mock" | "none"
  fallbackReason: "access_denied" | "empty_response" | null
  account: {
    platform: string
    status: string
    username: string | null
    externalId: string | null
    expiresAt: string | null
    scopes: string | null
  } | null
  data: {
    products: {
      pageInfo: {
        hasNextPage: boolean
        hasPreviousPage: boolean
        startCursor: string | null
        endCursor: string | null
      }
      edges: WhatnotProductEdge[]
    }
  }
}

export interface WhatnotInventoryLiveResponse {
  status: "ACTIVE" | "DRAFT" | "INACTIVE" | "SOLD_OUT"
  syncedAt: string | null
  snapshotId: string | null
  responsePayload: {
    data?: {
      me?: {
        inventory?: {
          edges?: Array<{
            node?: {
              id?: string | null
              title?: string | null
              subtitle?: string | null
              description?: string | null
              status?: string | null
              publicStatus?: string | null
              quantity?: number | null
              transactionType?: string | null
              price?: { amount?: number | null; currency?: string | null }
              product?: { category?: { label?: string | null } }
            }
          }>
        }
      }
    }
  }
}

export interface WhatnotEarlyPayoutMoney {
  amount?: number | null
  currency?: string | null
  amountSafe?: number | null
}

export interface WhatnotEarlyPayoutBalanceResponse {
  syncedAt: string | null
  responsePayload: {
    data?: {
      me?: {
        id?: string | null
        balances?: {
          completedSalesBalance?: WhatnotEarlyPayoutMoney | null
          processingSalesBalance?: WhatnotEarlyPayoutMoney | null
          totalSalesBalance?: WhatnotEarlyPayoutMoney | null
          totalSalesAltCurrencyBalance?: WhatnotEarlyPayoutMoney | null
        } | null
      } | null
    } | null
    errors?: Array<{ message?: string }>
  }
}

export interface WhatnotInventoryCreateFormOptionsResponse {
  subcategories: Array<{
    id: string
    label: string
    categoryId?: string | null
  }>
  shippingProfiles: Array<{
    id: string
    name: string
  }>
}

export interface WhatnotGenerateMediaUploadUrlsResponse {
  data?: {
    addListingPhoto?: {
      image?: {
        id?: string
        url?: string
      }
      success?: boolean
      message?: string
    }
  }
  errors?: Array<{ message?: string }>
}

export interface CreateWhatnotListingPayload {
  title: string
  description: string
  quantity: number
  priceUsd: number
  subcategoryId: string
  shippingProfileId: string
  hazmatType: string
  imageId: string
  /** Optional; when omitted backend infers defaults from cached category data when possible. */
  productAttributeValues?: Array<{ id: string; value: string }>
}

export interface CreateWhatnotListingResponse {
  data?: {
    createListing?: {
      listingNode?: {
        id?: string
        uuid?: string
        title?: string
      }
      error?: string | null
    }
  }
  errors?: Array<{ message?: string }>
}

export interface CreateStaffPendingInventoryPayload {
  subcategoryId: string
  title: string
  description: string
  quantity: number
  priceUsd: number
  shippingProfileId: string
  hazmatType: string
  imageId: string
  imagePayload: {
    media: Array<{ id: string; extension: string }>
    fileBase64: string
    fileContentType?: string
  }
}

export interface CreateStaffPendingInventoryResponse {
  item: {
    id: string
    ownerSellerUserId: string
    createdByUserId: string
    createdByClerkUserId: string
    subcategoryId: string
    title: string
    description: string
    quantity: number
    priceUsd: number
    shippingProfileId: string
    hazmatType: string
    imageId: string
    imagePayload: {
      media: Array<{ id: string; extension: string }>
      fileBase64: string
      fileContentType?: string
    }
    status: string
    source: string
    createdAt: string
    updatedAt: string
  }
  message: string
}

export interface SellerPendingInventoryItem {
  id: string
  ownerSellerUserId: string
  createdByUserId: string
  createdByClerkUserId: string
  createdByRole: string | null
  createdByName: string | null
  createdByEmail: string | null
  subcategoryId: string
  title: string
  description: string
  quantity: number
  priceUsd: number
  shippingProfileId: string
  hazmatType: string
  imageId: string
  imagePayload: {
    media?: Array<{ id?: string; extension?: string }>
    fileBase64?: string
    fileContentType?: string
  }
  status: "PENDING" | "SYNCED" | "FAILED" | string
  syncedListingId: string | null
  syncedListingUuid: string | null
  syncedAt: string | null
  syncError: string | null
  source: string
  createdAt: string
  updatedAt: string
}

export interface SellerPendingInventoryListResponse {
  items: SellerPendingInventoryItem[]
}

export interface SellerPendingInventorySyncResponse {
  item: {
    id: string
    status: string
    imageId: string
    syncedListingId: string | null
    syncedListingUuid: string | null
    syncedAt: string | null
    syncError: string | null
  }
  message: string
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

export interface WhatnotBioUpdateResponse {
  success: boolean
  message?: string
  bio: string
  response: {
    data?: {
      updateProfile?: {
        id?: string | null
        bio?: string | null
        __typename?: string
      } | null
    }
    errors?: Array<{ message?: string }>
  }
}

export interface WhatnotExtensionStatusResponse {
  connected: boolean
  extensionInstalled: boolean
  bridgeOnline: boolean
  hasSavedSession: boolean
  status: "connected" | "disconnected" | "not_installed"
  savedSession: {
    connectedAt: string | null
    updatedAt: string | null
    whatnotUsername: string | null
    extensionTabId: number | null
  } | null
}

export interface WhatnotOrderItem {
  id: string
  whatnotOrderId: string | null
  orderNumber: string | null
  status: string | null
  buyerUsername: string | null
  buyerName: string | null
  listingTitle: string | null
  priceAmount: number | null
  priceCurrency: string | null
  orderedAt: string | null
  updatedAt: string | null
  rawPayload: Record<string, unknown>
}

export interface WhatnotOrdersResponse {
  orders: WhatnotOrderItem[]
}

export interface WhatnotOrdersSyncResponse {
  triggered: boolean
  reason: string
  fetchedCount: number | null
}

/** Proxies TikTok Shop Partner API `POST /order/202309/orders/search`. */
export interface TikTokShopOrdersSearchResponse {
  configured: boolean
  /** True when Partner app + shop token + shop_cipher are wired and live API calls are used (not demo data). */
  shopConnected: boolean
  /** Demo dataset from the server when shop is not connected yet. */
  isMockData: boolean
  reason?: string | null
  /** Human-readable UX note (e.g. mock mode explanation). */
  note?: string | null
  totalCount: number
  nextPageToken: string | null
  orders: Record<string, unknown>[]
  requestId?: string | null
}

/** `GET /order/202309/orders` (proxied) single order detail envelope. */
export interface TikTokShopOrderDetailResponse {
  configured: boolean
  shopConnected: boolean
  isMockData: boolean
  reason?: string | null
  note?: string | null
  order: Record<string, unknown> | null
  requestId?: string | null
}

export interface TikTokShopPackageSku {
  id?: string
  name?: string
  image_url?: string
  quantity?: number
}

export interface TikTokShopPackageOrder {
  id?: string
  skus?: TikTokShopPackageSku[]
}

export interface TikTokShopPackage {
  id?: string
  orders?: TikTokShopPackageOrder[]
  create_time?: number
  update_time?: number
  status?: string
  tracking_number?: string
  shipping_provider_name?: string
  shipping_provider_id?: string
  order_line_item_ids?: string[]
}

export interface TikTokShopPackagesSearchResponse {
  configured: boolean
  shopConnected: boolean
  isMockData: boolean
  reason?: string | null
  note?: string | null
  totalCount: number
  nextPageToken: string | null
  packages: TikTokShopPackage[]
  requestId?: string | null
}

export interface TikTokFinanceStatementItem {
  id: string
  statement_time: number
  settlement_amount: string
  currency: string
  revenue_amount?: string
  fee_amount?: string
  adjustment_amount?: string
  payment_status?: string
  payment_id?: string
  net_sales_amount?: string
  shipping_cost_amount?: string
  payment_time?: number
}

export interface TikTokFinanceStatementsResponse {
  configured: boolean
  shopConnected: boolean
  isMockData: boolean
  reason?: string | null
  note?: string | null
  nextPageToken: string | null
  statements: TikTokFinanceStatementItem[]
  requestId?: string | null
}

export interface TikTokFinanceAmount {
  value?: string
  currency?: string
}

export interface TikTokFinancePaymentItem {
  create_time?: number
  id: string
  status?: string
  amount?: TikTokFinanceAmount
  settlement_amount?: TikTokFinanceAmount
  reserve_amount?: TikTokFinanceAmount
  payment_amount_before_exchange?: TikTokFinanceAmount
  exchange_rate?: string
  paid_time?: number
  bank_account?: string
}

export interface TikTokFinancePaymentsResponse {
  configured: boolean
  shopConnected: boolean
  isMockData: boolean
  reason?: string | null
  note?: string | null
  nextPageToken: string | null
  payments: TikTokFinancePaymentItem[]
  requestId?: string | null
}

export interface TikTokFinanceWithdrawalItem {
  id: string
  type?: string
  amount?: string
  currency?: string
  status?: string
  create_time?: number
}

export interface TikTokFinanceWithdrawalsResponse {
  configured: boolean
  shopConnected: boolean
  isMockData: boolean
  reason?: string | null
  note?: string | null
  nextPageToken: string | null
  totalCount: number
  withdrawals: TikTokFinanceWithdrawalItem[]
  requestId?: string | null
}

export interface TikTokFinanceStatementTransactionItem {
  id: string
  type?: string
  order_id?: string
  order_create_time?: number
  adjustment_id?: string
  adjustment_order_id?: string
  adjustment_amount?: string
  settlement_amount?: string
  revenue_amount?: string
  revenue_breakdown?: Record<string, unknown>
  shipping_cost_amount?: string
  shipping_cost_breakdown?: Record<string, unknown>
  fee_tax_amount?: string
  fee_tax_breakdown?: Record<string, unknown>
  supplementary_component?: Record<string, unknown>
  reserve_id?: string
  reserve_amount?: string
  associated_order_id?: string
  reserve_status?: string
  estimated_release_time?: number | string
}

export interface TikTokFinanceStatementTransactionsResponse {
  configured: boolean
  shopConnected: boolean
  isMockData: boolean
  reason?: string | null
  note?: string | null
  nextPageToken: string | null
  id: string
  createTime?: number | null
  status?: string | null
  currency?: string | null
  payableAmount?: string | null
  totalReserveAmount?: string | null
  totalSettlementAmount?: string | null
  totalSettlementBreakdown?: Record<string, unknown> | null
  totalCount: number
  transactions: TikTokFinanceStatementTransactionItem[]
  requestId?: string | null
}

export interface TikTokFinanceUnsettledOrderItem {
  type?: string
  id: string
  status?: string
  currency?: string
  estimated_settlement?: number | string
  unsettled_reason?: string
  order_create_time?: number
  order_delivery_time?: number
  order_id?: string
  adjustment_id?: string
  adjustment_order_id?: string
  est_adjustment_amount?: string
  est_settlement_amount?: string
  est_revenue_amount?: string
  revenue_breakdown?: Record<string, unknown>
  est_shipping_cost_amount?: string
  shipping_cost_breakdown?: Record<string, unknown>
  est_fee_tax_amount?: string
  fee_tax_breakdown?: Record<string, unknown>
}

export interface TikTokFinanceUnsettledOrdersResponse {
  configured: boolean
  shopConnected: boolean
  isMockData: boolean
  reason?: string | null
  note?: string | null
  nextPageToken: string | null
  totalCount: number
  sumEstSettlementAmount: string
  sumEstRevenueAmount: string
  sumEstAdjustmentAmount: string
  sumEstFeeAmount: string
  transactions: TikTokFinanceUnsettledOrderItem[]
  requestId?: string | null
}

export interface WhatnotMoneySnapshot {
  amount?: number
  currency?: string
  amountSafe?: number
  __typename?: string
}

export interface WhatnotMyLiveStatistic {
  totalCount?: number
  totalSales?: WhatnotMoneySnapshot
  totalEarned?: WhatnotMoneySnapshot
  totalEarnings?: WhatnotMoneySnapshot
  totalPendingEarned?: WhatnotMoneySnapshot
  totalCancellations?: number
  totalShippingSpend?: WhatnotMoneySnapshot
  totalCouponSpend?: WhatnotMoneySnapshot
  pendingShipments?: number
  deliveredShipments?: number
  runningTask?: boolean
  manifestUrls?: string[]
  __typename?: string
}

export interface FetchWhatnotMyLiveStatsResponse {
  liveId: string
  statistic: WhatnotMyLiveStatistic | null
  raw: Record<string, unknown>
}

export interface WhatnotUpcomingShowSummary {
  id: string | null
  uuid: string | null
  title: string | null
  scheduledAt: string | number | null
  userId: string | null
  raw: Record<string, unknown>
}

export interface WhatnotLiveShowItem {
  id: string | null
  title: string | null
  startTime: number | null
  endTime: number | null
  status: string | null
  userId: string | null
  showType: "Live" | "Upcoming" | "Past"
  link: string | null
}

export interface WhatnotShowTabResponse {
  sellerId: string | null
  upcomingShowUserId: string | null
  upcomingShows: WhatnotUpcomingShowSummary[]
  shows: WhatnotLiveShowItem[]
  liveReadiness: Record<string, unknown> | null
  sellerHomeDashboard: Record<string, unknown> | null
}

export interface ScheduleWhatnotShowPayload {
  name: string
  showDate: string
  showTime: string
  repeats: string
  primarySellingFormat: string
  primarySellingFormatId: string | null
  primarySellingFormatName: string | null
  primarySellingFormatLabel: string | null
  primaryLanguage: string
  discovery: "public" | "private"
  categoryId: string
  mainCategoryId: string | null
}

export interface WhatnotPrimaryShowFormatTag {
  id: string | null
  name: string | null
  label: string | null
  description: string | null
  canScheduleLive: boolean
  applicationLink: string | null
  raw: Record<string, unknown>
}

export interface WhatnotPrimaryShowFormatTagsResponse {
  categoryId: string
  primaryShowFormatTags: WhatnotPrimaryShowFormatTag[]
  response: Record<string, unknown>
}

export interface WhatnotLivestreamRefinementCategoryItem {
  id: string
  mainCategoryId: string
  name: string | null
  label: string | null
}

export interface WhatnotLivestreamMainCategoryItem {
  id: string
  name: string | null
  label: string | null
  refinements: WhatnotLivestreamRefinementCategoryItem[]
}

export interface WhatnotLivestreamCategoryTreeResponse {
  categories: WhatnotLivestreamMainCategoryItem[]
}

export interface WhatnotLivestreamIdSummary {
  id: string
  title: string | null
  startTime: number | null
}

export interface WhatnotShipmentsLivestreamsCurrentResponse {
  liveId: string | null
  title: string | null
  startTime: number | null
  livestreams: WhatnotLivestreamIdSummary[]
}

export interface WhatnotShipmentTableRow {
  shipmentId: string
  shipment: Record<string, unknown> | null
  error: string | null
}

export interface FetchWhatnotShipmentsTableResponse {
  rows: WhatnotShipmentTableRow[]
  requestedIds: string[]
  hint?: string
}

export interface StaffOrderManagementShipmentRow {
  shipmentKey: string | null
  shipmentIdInput: string | null
  shipmentGlobalId: string | null
  shipment: Record<string, unknown> | null
  syncedAt: string | null
  updatedAt: string | null
}

export interface StaffOrderManagementSnapshotResponse {
  stats: {
    liveId: string | null
    statistic: WhatnotMyLiveStatistic | null
    syncedAt: string | null
    updatedAt: string | null
  } | null
  shipments: StaffOrderManagementShipmentRow[]
  source: "db"
  parentSellerClerkUserId: string
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

  if (value === "staff") {
    return "staff"
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

  if (role === "staff") {
    return "/staff"
  }

  return "/seller"
}

export function getSignupRedirectPath(role: AppRole) {
  if (role === "admin" || role === "staff") {
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

export async function getSellerOrganizations(token: string) {
  return request<SellerOrganizationsResponse>("/api/auth/seller-organizations", {
    token,
  })
}

export async function createSellerOrganization(token: string, payload: { name: string; slug?: string }) {
  return request<SellerOrganizationMutationResponse>("/api/auth/seller-organizations", {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}

export async function activateSellerOrganization(token: string, workspaceId: string) {
  return request<SellerOrganizationMutationResponse>("/api/auth/seller-organizations/activate", {
    token,
    method: "POST",
    body: { workspaceId },
  })
}

export async function syncSellerActiveOrganization(token: string, clerkOrganizationId: string) {
  return request<SellerOrganizationMutationResponse>("/api/auth/seller-organizations/sync-active", {
    token,
    method: "POST",
    body: { clerkOrganizationId },
  })
}

export async function syncSellerOrganizationMembers(token: string, clerkOrganizationId: string) {
  return request<SellerOrganizationMembersSyncResponse>("/api/auth/seller-organizations/sync-members", {
    token,
    method: "POST",
    body: { clerkOrganizationId },
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

export async function getWhatnotInventorySnapshot(token: string, params?: { first?: number }) {
  const search = new URLSearchParams()

  if (typeof params?.first === "number") {
    search.set("first", String(params.first))
  }

  const query = search.toString()
  const path = query
    ? `/api/integrations/whatnot/inventory-snapshot?${query}`
    : "/api/integrations/whatnot/inventory-snapshot"

  return request<WhatnotInventorySnapshotResponse>(path, { token })
}

export async function updateWhatnotProfileBio(token: string, bio: string) {
  return request<WhatnotBioUpdateResponse>("/api/integrations/whatnot/profile/bio", {
    token,
    method: "POST",
    body: { bio },
  })
}

export async function getWhatnotExtensionStatus(token: string) {
  return request<WhatnotExtensionStatusResponse>("/api/integrations/whatnot/extension-status", {
    token,
  })
}

export async function getWhatnotOrders(token: string, params?: { limit?: number }) {
  const search = new URLSearchParams()

  if (typeof params?.limit === "number") {
    search.set("limit", String(params.limit))
  }

  const query = search.toString()
  const path = query ? `/api/integrations/whatnot/orders?${query}` : "/api/integrations/whatnot/orders"
  return request<WhatnotOrdersResponse>(path, { token })
}

export async function syncWhatnotOrders(token: string) {
  return request<WhatnotOrdersSyncResponse>("/api/integrations/whatnot/orders/sync", {
    token,
    method: "POST",
  })
}

export async function searchTikTokShopOrders(
  token: string,
  payload?: {
    filters?: Record<string, unknown>
    pageSize?: number
    pageToken?: string
    sortOrder?: "ASC" | "DESC"
    sortField?: string
  },
) {
  return request<TikTokShopOrdersSearchResponse>("/api/integrations/tiktok/shop/orders/search", {
    token,
    method: "POST",
    body: (payload || {}) as Record<string, unknown>,
  })
}

export async function searchTikTokShopPackages(
  token: string,
  payload?: {
    filters?: {
      create_time_ge?: number
      create_time_lt?: number
      update_time_ge?: number
      update_time_lt?: number
      package_status?: "PROCESSING" | "FULFILLING" | "COMPLETED" | "CANCELLED" | string
    }
    pageSize?: number
    pageToken?: string
    sortOrder?: "ASC" | "DESC"
    sortField?: string
  },
) {
  return request<TikTokShopPackagesSearchResponse>("/api/integrations/tiktok/shop/packages/search", {
    token,
    method: "POST",
    body: (payload || {}) as Record<string, unknown>,
  })
}

export async function getTikTokShopOrderDetail(token: string, orderId: string) {
  const id = typeof orderId === "string" ? orderId.trim() : ""
  if (!id) {
    throw new Error("orderId is required.")
  }
  return request<TikTokShopOrderDetailResponse>(
    `/api/integrations/tiktok/shop/orders/${encodeURIComponent(id)}`,
    { token },
  )
}

export interface CreatePackagePayload {
  ship_type: string
  order_id?: string
  order_line_item?: Array<{ order_line_id: string; sub_item_id?: string }>
  order_list_ids?: string[]
  dimension?: { length: string; width: string; height: string; unit: string }
  shipping_service_id?: string
  weight?: { value: string; unit: string }
}

export interface CreatePackageResponse {
  shopConnected: boolean
  isMockData: boolean
  reason: string | null
  requestBody: Record<string, unknown>
  package_id: string | null
  dimension: { length: string; width: string; height: string; unit: string } | null
  weight: { value: string; unit: string } | null
  shipping_service_info: {
    id: string
    name: string
    price: string
    currency: string
    earliest_delivery_days: number
    latest_delivery_days: number
    shipping_provider_id?: string
    shipping_provider_name?: string
  } | null
  create_time: number
}

export interface SplitOrderPayload {
  splittable_groups: Array<{
    id: string
    order_line_item_ids: string[]
  }>
  splittable_groups_v2: Array<{
    id: string
    order_line_list: Array<{
      order_line_id: string
      sub_item_id: string
    }>
  }>
}

export interface SplitOrderResponse {
  shopConnected: boolean
  isMockData: boolean
  reason: string | null
  orderId: string
  requestBody: SplitOrderPayload
  packages: Array<{
    splittable_group_id: string
    id: string
  }>
  requestId?: string | null
}

export async function createTikTokShopPackage(token: string, payload: CreatePackagePayload) {
  return request<CreatePackageResponse>("/api/integrations/tiktok/shop/packages", {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}

export async function splitTikTokShopOrder(token: string, orderId: string, payload: SplitOrderPayload) {
  const id = typeof orderId === "string" ? orderId.trim() : ""
  if (!id) {
    throw new Error("orderId is required.")
  }
  return request<SplitOrderResponse>(`/api/integrations/tiktok/shop/orders/${encodeURIComponent(id)}/split`, {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}

export interface ShipPackagePayload {
  handover_method?: "PICKUP" | "DROP_OFF" | string
  pickup_slot?: {
    start_time: number
    end_time: number
  }
  self_shipment?: {
    tracking_number: string
    shipping_provider_id: string
  }
}

export interface ShipPackageResponse {
  shopConnected: boolean
  isMockData: boolean
  reason: string | null
  packageId: string
  requestBody: Record<string, unknown>
  code: number
  message: string
  data: Record<string, unknown>
  requestId?: string | null
}

export async function shipTikTokPackage(token: string, packageId: string, payload: ShipPackagePayload) {
  const id = typeof packageId === "string" ? packageId.trim() : ""
  if (!id) {
    throw new Error("packageId is required.")
  }
  return request<ShipPackageResponse>(
    `/api/integrations/tiktok/shop/packages/${encodeURIComponent(id)}/ship`,
    {
      token,
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    }
  )
}

export async function getTikTokFinanceStatements(
  token: string,
  params?: {
    statementTimeGe?: number
    statementTimeLt?: number
    paymentStatus?: string
    pageSize?: number
    pageToken?: string
    sortOrder?: "ASC" | "DESC"
    sortField?: string
  },
) {
  const search = new URLSearchParams()
  if (typeof params?.statementTimeGe === "number") {
    search.set("statementTimeGe", String(params.statementTimeGe))
  }
  if (typeof params?.statementTimeLt === "number") {
    search.set("statementTimeLt", String(params.statementTimeLt))
  }
  if (typeof params?.paymentStatus === "string" && params.paymentStatus.trim()) {
    search.set("paymentStatus", params.paymentStatus.trim())
  }
  if (typeof params?.pageSize === "number") {
    search.set("pageSize", String(params.pageSize))
  }
  if (typeof params?.pageToken === "string" && params.pageToken.trim()) {
    search.set("pageToken", params.pageToken.trim())
  }
  if (params?.sortOrder === "ASC" || params?.sortOrder === "DESC") {
    search.set("sortOrder", params.sortOrder)
  }
  if (typeof params?.sortField === "string" && params.sortField.trim()) {
    search.set("sortField", params.sortField.trim())
  }

  const query = search.toString()
  const path = query
    ? `/api/integrations/tiktok/shop/finance/statements?${query}`
    : "/api/integrations/tiktok/shop/finance/statements"
  return request<TikTokFinanceStatementsResponse>(path, { token })
}

export async function getTikTokFinancePayments(
  token: string,
  params?: {
    createTimeGe?: number
    createTimeLt?: number
    pageSize?: number
    pageToken?: string
    sortOrder?: "ASC" | "DESC"
    sortField?: string
  },
) {
  const search = new URLSearchParams()
  if (typeof params?.createTimeGe === "number") {
    search.set("createTimeGe", String(params.createTimeGe))
  }
  if (typeof params?.createTimeLt === "number") {
    search.set("createTimeLt", String(params.createTimeLt))
  }
  if (typeof params?.pageSize === "number") {
    search.set("pageSize", String(params.pageSize))
  }
  if (typeof params?.pageToken === "string" && params.pageToken.trim()) {
    search.set("pageToken", params.pageToken.trim())
  }
  if (params?.sortOrder === "ASC" || params?.sortOrder === "DESC") {
    search.set("sortOrder", params.sortOrder)
  }
  if (typeof params?.sortField === "string" && params.sortField.trim()) {
    search.set("sortField", params.sortField.trim())
  }

  const query = search.toString()
  const path = query
    ? `/api/integrations/tiktok/shop/finance/payments?${query}`
    : "/api/integrations/tiktok/shop/finance/payments"
  return request<TikTokFinancePaymentsResponse>(path, { token })
}

export async function getTikTokFinanceWithdrawals(
  token: string,
  params?: {
    createTimeGe?: number
    createTimeLt?: number
    types?: string[]
    pageSize?: number
    pageToken?: string
  },
) {
  const search = new URLSearchParams()
  if (typeof params?.createTimeGe === "number") {
    search.set("createTimeGe", String(params.createTimeGe))
  }
  if (typeof params?.createTimeLt === "number") {
    search.set("createTimeLt", String(params.createTimeLt))
  }
  if (Array.isArray(params?.types) && params.types.length > 0) {
    search.set("types", params.types.join(","))
  }
  if (typeof params?.pageSize === "number") {
    search.set("pageSize", String(params.pageSize))
  }
  if (typeof params?.pageToken === "string" && params.pageToken.trim()) {
    search.set("pageToken", params.pageToken.trim())
  }

  const query = search.toString()
  const path = query
    ? `/api/integrations/tiktok/shop/finance/withdrawals?${query}`
    : "/api/integrations/tiktok/shop/finance/withdrawals"
  return request<TikTokFinanceWithdrawalsResponse>(path, { token })
}

export async function getTikTokFinanceStatementTransactions(
  token: string,
  statementId: string,
  params?: {
    pageSize?: number
    pageToken?: string
    sortOrder?: "ASC" | "DESC"
    sortField?: string
  },
) {
  const id = typeof statementId === "string" ? statementId.trim() : ""
  if (!id) {
    throw new Error("statementId is required.")
  }

  const search = new URLSearchParams()
  if (typeof params?.pageSize === "number") {
    search.set("pageSize", String(params.pageSize))
  }
  if (typeof params?.pageToken === "string" && params.pageToken.trim()) {
    search.set("pageToken", params.pageToken.trim())
  }
  if (params?.sortOrder === "ASC" || params?.sortOrder === "DESC") {
    search.set("sortOrder", params.sortOrder)
  }
  if (typeof params?.sortField === "string" && params.sortField.trim()) {
    search.set("sortField", params.sortField.trim())
  }

  const query = search.toString()
  const basePath = `/api/integrations/tiktok/shop/finance/statements/${encodeURIComponent(id)}/transactions`
  const path = query ? `${basePath}?${query}` : basePath
  return request<TikTokFinanceStatementTransactionsResponse>(path, { token })
}

export async function getTikTokFinanceUnsettledOrders(
  token: string,
  params?: {
    pageSize?: number
    pageToken?: string
    sortOrder?: "ASC" | "DESC"
    sortField?: string
    searchTimeGe?: number
    searchTimeLt?: number
  },
) {
  const search = new URLSearchParams()
  if (typeof params?.pageSize === "number") {
    search.set("pageSize", String(params.pageSize))
  }
  if (typeof params?.pageToken === "string" && params.pageToken.trim()) {
    search.set("pageToken", params.pageToken.trim())
  }
  if (params?.sortOrder === "ASC" || params?.sortOrder === "DESC") {
    search.set("sortOrder", params.sortOrder)
  }
  if (typeof params?.sortField === "string" && params.sortField.trim()) {
    search.set("sortField", params.sortField.trim())
  }
  if (typeof params?.searchTimeGe === "number") {
    search.set("searchTimeGe", String(params.searchTimeGe))
  }
  if (typeof params?.searchTimeLt === "number") {
    search.set("searchTimeLt", String(params.searchTimeLt))
  }

  const query = search.toString()
  const path = query
    ? `/api/integrations/tiktok/shop/finance/orders/unsettled?${query}`
    : "/api/integrations/tiktok/shop/finance/orders/unsettled"
  return request<TikTokFinanceUnsettledOrdersResponse>(path, { token })
}

export async function fetchWhatnotMyLiveStats(token: string, liveId: string) {
  return request<FetchWhatnotMyLiveStatsResponse>("/api/integrations/whatnot/my-live-stats", {
    token,
    method: "POST",
    body: { liveId },
  })
}

export async function fetchWhatnotShowTabData(
  token: string,
  upcomingShowsCount = 0,
  options?: { forceRefresh?: boolean },
) {
  return request<WhatnotShowTabResponse>("/api/integrations/whatnot/show-tab", {
    token,
    method: "POST",
    body: { upcomingShowsCount, forceRefresh: Boolean(options?.forceRefresh) },
  })
}

export async function getWhatnotLivestreamCategoryTree(token: string) {
  return request<WhatnotLivestreamCategoryTreeResponse>("/api/integrations/whatnot/livestream-category-tree", {
    token,
  })
}

export async function scheduleWhatnotShow(token: string, payload: ScheduleWhatnotShowPayload) {
  return request<{ success: boolean; accepted: boolean; message: string }>(
    "/api/integrations/whatnot/show-tab/schedule",
    {
      token,
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    },
  )
}

export async function fetchWhatnotPrimaryShowFormatTags(token: string, categoryId: string) {
  return request<WhatnotPrimaryShowFormatTagsResponse>("/api/integrations/whatnot/show-tab/primary-show-format-tags", {
    token,
    method: "POST",
    body: { categoryId },
  })
}

export async function getWhatnotShipmentsLivestreamsCurrentLiveId(token: string) {
  return request<WhatnotShipmentsLivestreamsCurrentResponse>(
    "/api/integrations/whatnot/shipments-livestreams/current",
    { token },
  )
}

export async function fetchWhatnotShipmentsTable(
  token: string,
  body: { liveId?: string; shipmentIds?: string[]; shipmentIdsText?: string; manifestUrls?: string[] },
) {
  return request<FetchWhatnotShipmentsTableResponse>("/api/integrations/whatnot/shipments/table", {
    token,
    method: "POST",
    body: body as Record<string, unknown>,
  })
}

export async function syncWhatnotInventoryLive(
  token: string,
  status: "ACTIVE" | "DRAFT" | "INACTIVE" | "SOLD_OUT",
) {
  return request<WhatnotInventoryLiveResponse>("/api/integrations/whatnot/inventory/sync", {
    token,
    method: "POST",
    body: { status },
  })
}

export async function syncWhatnotEarlyPayoutBalance(token: string) {
  return request<WhatnotEarlyPayoutBalanceResponse>(
    "/api/integrations/whatnot/finance/early-payout-balance-sync",
    {
      token,
      method: "POST",
      body: {},
    },
  )
}

export async function getWhatnotInventoryCreateFormOptions(token: string) {
  return request<WhatnotInventoryCreateFormOptionsResponse>("/api/integrations/whatnot/inventory/create-form-options", {
    token,
  })
}

export async function generateWhatnotMediaUploadUrls(
  token: string,
  media: Array<{ id: string; extension: string }>,
  file: { fileBase64: string; fileContentType?: string },
) {
  return request<WhatnotGenerateMediaUploadUrlsResponse>("/api/integrations/whatnot/media/upload-urls", {
    token,
    method: "POST",
    body: {
      media,
      fileBase64: file.fileBase64,
      ...(file.fileContentType ? { fileContentType: file.fileContentType } : {}),
    },
  })
}

export async function createWhatnotListing(token: string, payload: CreateWhatnotListingPayload) {
  return request<CreateWhatnotListingResponse>("/api/integrations/whatnot/inventory/publish", {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}

export async function createStaffPendingInventory(token: string, payload: CreateStaffPendingInventoryPayload) {
  return request<CreateStaffPendingInventoryResponse>("/api/staff/pending-inventory", {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}

export async function getSellerPendingInventory(token: string) {
  return request<SellerPendingInventoryListResponse>("/api/staff/pending-inventory", {
    token,
  })
}

export async function syncSellerPendingInventoryItem(token: string, pendingInventoryId: string) {
  return request<SellerPendingInventorySyncResponse>(`/api/staff/pending-inventory/${pendingInventoryId}/sync`, {
    token,
    method: "POST",
  })
}

export async function getStaffOrderManagementSnapshot(token: string, params?: { limit?: number }) {
  const path = buildPath("/api/staff/order-management", {
    limit: typeof params?.limit === "number" ? String(params.limit) : undefined,
  })
  return request<StaffOrderManagementSnapshotResponse>(path, { token })
}
