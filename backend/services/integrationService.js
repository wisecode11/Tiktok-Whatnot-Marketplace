const crypto = require("crypto");

const Stripe = require("stripe");
const ConnectedAccount = require("../models/ConnectedAccount");
const GetSessionApiData = require("../models/GetSessionApiData");
const SellerSession = require("../models/SellerSession");
const WhatnotOrder = require("../models/WhatnotOrder");
const WhatnotInventorySnapshot = require("../models/WhatnotInventorySnapshot");
const WhatnotLiveStatsSnapshot = require("../models/WhatnotLiveStatsSnapshot");
const WhatnotShowSnapshot = require("../models/WhatnotShowSnapshot");
const WhatnotShipmentDetail = require("../models/WhatnotShipmentDetail");
const WhatnotCategory = require("../models/WhatnotCategory");
const WhatnotSubCategory = require("../models/WhatnotSubCategory");
const WhatnotHazmatType = require("../models/WhatnotHazmatType");
const WhatnotProfileShipping = require("../models/WhatnotProfileShipping");
const WhatnotLivestreamMainCategory = require("../models/WhatnotLivestreamMainCategory");
const WhatnotLivestreamRefinementCategory = require("../models/WhatnotLivestreamRefinementCategory");
const StripeConnectAccount = require("../models/StripeConnectAccount");
const PlatformSetting = require("../models/PlatformSetting");
const User = require("../models/Users");
const { getWhatnotExtensionBridgeState, requestWhatnotAction } = require("../socket/whatnotExtensionBridge");
const {
  exchangeTikTokShopAuthCode,
  fetchTikTokShopAuthorizedShops,
  getTikTokShopOAuthConfig,
  persistTikTokShopTokens,
} = require("./tiktokShopService");
const { decryptText, encryptText } = require("../utils/crypto");

const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const TIKTOK_VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
const TIKTOK_VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/video/query/";
const WHATNOT_DEFAULT_API_BASE_URL = "https://api.whatnot.com";
const WHATNOT_DEFAULT_GRAPHQL_QUERY = `query GetProducts($first: Int!) {
  products(first: $first) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    edges {
      cursor
      node {
        id
        title
        description
      }
    }
  }
}`;
const TIKTOK_BASIC_USER_INFO_FIELDS = "open_id,union_id,avatar_url";
const TIKTOK_STATS_USER_INFO_FIELDS = "open_id,union_id,avatar_url,follower_count,following_count,likes_count,video_count";
const TIKTOK_VIDEO_LIST_DEFAULT_FIELDS = "id,title,create_time,cover_image_url,share_url";
const TIKTOK_VIDEO_QUERY_DEFAULT_FIELDS = "id,title,create_time,cover_image_url,share_url,view_count,comment_count,like_count,share_count";
const TIKTOK_ENHANCED_USER_INFO_FIELDS = [
  "open_id",
  "union_id",
  "avatar_url",
  "avatar_large_url",
  "display_name",
  "bio_description",
  "profile_deep_link",
  "is_verified",
  "username",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
].join(",");
const WHATNOT_INVENTORY_STATUSES = new Set(["ACTIVE", "DRAFT", "INACTIVE", "SOLD_OUT"]);

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function normalizeInventoryStatus(status) {
  const normalized = typeof status === "string" ? status.trim().toUpperCase() : "";
  if (!WHATNOT_INVENTORY_STATUSES.has(normalized)) {
    throw createHttpError(400, "Invalid status. Use ACTIVE, DRAFT, INACTIVE, or SOLD_OUT.");
  }
  return normalized;
}

function resolveInventoryListingId(node) {
  if (!node || typeof node !== "object") {
    return "";
  }
  if (node.id) {
    return String(node.id).trim();
  }
  if (node.uuid) {
    return String(node.uuid).trim();
  }
  return "";
}

function extractInventoryEdgesFromGraphqlBody(body) {
  if (!body || typeof body !== "object") {
    return [];
  }
  const edges = body.data && body.data.me && body.data.me.inventory && body.data.me.inventory.edges;
  return Array.isArray(edges) ? edges : [];
}

function extractInventoryStatusFilterFromRequestPayload(requestPayload) {
  const statuses = requestPayload && Array.isArray(requestPayload.statuses) ? requestPayload.statuses : [];
  if (statuses.length) {
    const first = String(statuses[0]).trim().toUpperCase();
    if (WHATNOT_INVENTORY_STATUSES.has(first)) {
      return first;
    }
  }
  return "ACTIVE";
}

function buildWhatnotInventoryResponsePayloadFromRecords(records) {
  const latestRecords = Array.isArray(records) ? records : [];
  return {
    data: {
      me: {
        inventory: {
          edges: latestRecords.map((record) => ({
            node: record.response_payload || {},
          })),
        },
      },
    },
  };
}

async function saveWhatnotInventorySnapshots({
  clerkUserId,
  statusFilter = "ACTIVE",
  edges = [],
  requestPayload = {},
  source = "whatnot-extension",
  extensionTabId = null,
}) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  await findLocalUser(normalizedClerkUserId);
  const ownerClerkUserId = await resolveWhatnotSnapshotOwnerClerkUserId(normalizedClerkUserId);
  const normalizedStatus = normalizeInventoryStatus(statusFilter);
  const now = new Date();
  const tabId = Number.isFinite(Number(extensionTabId)) ? Number(extensionTabId) : null;
  let savedCount = 0;

  for (const edge of edges) {
    const node = edge && typeof edge === "object" ? edge.node : null;
    const inventoryId = resolveInventoryListingId(node);

    if (!inventoryId) {
      continue;
    }

    await WhatnotInventorySnapshot.findOneAndUpdate(
      {
        platform: "whatnot",
        clerk_user_id: ownerClerkUserId,
        status_filter: normalizedStatus,
        inventory_id: inventoryId,
      },
      {
        $set: {
          source,
          request_payload: requestPayload,
          response_payload: node || {},
          extension_tab_id: tabId,
          synced_at: now,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
    savedCount += 1;
  }

  console.log(
    `[Whatnot Inventory] Snapshot saved for ${ownerClerkUserId} (${normalizedStatus}): ${savedCount} listing(s).`,
  );

  return {
    savedCount,
    status: normalizedStatus,
    syncedAt: now,
    ownerClerkUserId,
  };
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:3000";
}

function getBackendUrl() {
  return process.env.BACKEND_URL || "http://localhost:5000";
}

function getTikTokConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${getBackendUrl()}/api/integrations/tiktok/callback`;
  const scopes = process.env.TIKTOK_SCOPES || "user.info.basic,video.publish,video.upload";
  const stateSecret = process.env.TIKTOK_STATE_SECRET || process.env.APP_ENCRYPTION_KEY;

  if (!clientKey || !clientSecret) {
    throw createHttpError(500, "TikTok integration is not configured on the server.");
  }

  if (!stateSecret) {
    throw createHttpError(500, "TIKTOK_STATE_SECRET or APP_ENCRYPTION_KEY is required.");
  }

  return {
    clientKey,
    clientSecret,
    redirectUri,
    scopes,
    stateSecret,
  };
}

function getWhatnotConfig() {
  const apiBaseUrl = process.env.WHATNOT_API_BASE_URL || WHATNOT_DEFAULT_API_BASE_URL;
  const clientId = process.env.WHATNOT_CLIENT_ID;
  const clientSecret = process.env.WHATNOT_CLIENT_SECRET;
  const redirectUri = process.env.WHATNOT_REDIRECT_URI || `${getBackendUrl()}/api/integrations/whatnot/callback`;
  const scopes = process.env.WHATNOT_SCOPES || "read:inventory read:orders";
  const stateSecret = getWhatnotStateSecret();

  if (!clientId || !clientSecret) {
    const missing = [
      !clientId ? "WHATNOT_CLIENT_ID" : null,
      !clientSecret ? "WHATNOT_CLIENT_SECRET" : null,
    ].filter(Boolean);
    throw createHttpError(
      500,
      `Whatnot integration is not configured on the server. Missing: ${missing.join(", ")}.`,
      { missingEnv: missing },
    );
  }

  if (!stateSecret) {
    throw createHttpError(500, "WHATNOT_STATE_SECRET or APP_ENCRYPTION_KEY is required.");
  }

  return {
    apiBaseUrl,
    authorizeUrl: `${apiBaseUrl}/seller-api/rest/oauth/authorize`,
    tokenUrl: `${apiBaseUrl}/seller-api/rest/oauth/token`,
    graphqlUrl: process.env.WHATNOT_GRAPHQL_URL || `${apiBaseUrl}/seller-api/graphql`,
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    stateSecret,
  };
}

function getWhatnotStateSecret() {
  const stateSecret = process.env.WHATNOT_STATE_SECRET || process.env.APP_ENCRYPTION_KEY;

  if (!stateSecret) {
    throw createHttpError(500, "WHATNOT_STATE_SECRET or APP_ENCRYPTION_KEY is required.");
  }

  return stateSecret;
}

function isEnabledFlag(value, defaultValue) {
  if (value == null || String(value).trim() === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isWhatnotMockOAuthEnabled() {
  const defaultValue = process.env.NODE_ENV !== "production";
  return isEnabledFlag(process.env.WHATNOT_ENABLE_OAUTH_MOCK, defaultValue);
}

function isWhatnotMockTokenExchangeEnabled() {
  const defaultValue = process.env.NODE_ENV !== "production";
  return isEnabledFlag(process.env.WHATNOT_ENABLE_MOCK_TOKEN_EXCHANGE, defaultValue);
}

function getWhatnotMockTokenPayload() {
  const raw = process.env.WHATNOT_MOCK_TOKEN_RESPONSE;
  const fallback = {
    token_type: "Bearer",
    access_token: "wn_access_tk_test_mock_access_token",
    refresh_token: "wn_refresh_tk_test_mock_refresh_token",
    expires_in: 86400,
    scope: process.env.WHATNOT_SCOPES || "read:inventory read:orders",
  };

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    return {
      token_type: parsed.token_type || fallback.token_type,
      access_token: parsed.access_token || fallback.access_token,
      refresh_token: parsed.refresh_token || fallback.refresh_token,
      expires_in: Number.isFinite(Number(parsed.expires_in))
        ? Number(parsed.expires_in)
        : fallback.expires_in,
      scope: parsed.scope || fallback.scope,
    };
  } catch (_error) {
    return fallback;
  }
}

function normalizePlatform(platform) {
  const normalized = typeof platform === "string" ? platform.trim().toLowerCase() : "";

  if (normalized === "tiktok") {
    return "tiktok";
  }

  if (normalized === "whatnot") {
    return "whatnot";
  }

  if (normalized === "stripe") {
    return "stripe";
  }

  if (normalized === "quickbooks") {
    return "quickbooks";
  }

  return null;
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || secretKey.includes("REPLACE_WITH")) {
    throw createHttpError(500, "Stripe integration is not configured on the server. Add STRIPE_SECRET_KEY to .env");
  }

  return new Stripe(secretKey, { apiVersion: "2025-03-31.basil" });
}

function getStripeConnectUrlsForRole(role) {
  const frontendUrl = getFrontendUrl();
  const defaultReturn = process.env.STRIPE_CONNECT_RETURN_URL || `${frontendUrl}/launch-pad`;
  const defaultRefresh = process.env.STRIPE_CONNECT_REFRESH_URL || defaultReturn;

  if (role === "staff") {
    return {
      returnUrl:
        process.env.STRIPE_CONNECT_STAFF_RETURN_URL || `${frontendUrl}/staff/launch-pad`,
      refreshUrl:
        process.env.STRIPE_CONNECT_STAFF_REFRESH_URL || `${frontendUrl}/staff/launch-pad`,
    };
  }

  return {
    returnUrl: defaultReturn,
    refreshUrl: defaultRefresh,
  };
}

function resolveStripeAccountType(role) {
  if (role === "staff") {
    return "staff";
  }

  return "moderator";
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? `${normalized}${"=".repeat(4 - padding)}` : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function toBufferBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createPkcePair() {
  const verifier = toBufferBase64Url(crypto.randomBytes(32));
  const challenge = toBufferBase64Url(crypto.createHash("sha256").update(verifier).digest());

  return {
    verifier,
    challenge,
  };
}

function signOAuthState(payload, stateSecret) {
  const body = toBase64Url(encryptText(JSON.stringify(payload)));
  const signature = crypto.createHmac("sha256", stateSecret).update(body).digest("hex");
  return `${body}.${signature}`;
}

function parseOAuthState(state, { stateSecret, requireCodeVerifier = false }) {
  const [body, signature] = String(state || "").split(".");

  if (!body || !signature) {
    throw createHttpError(400, "Invalid OAuth state.");
  }

  const expectedSignature = crypto.createHmac("sha256", stateSecret).update(body).digest("hex");

  if (signature !== expectedSignature) {
    throw createHttpError(400, "OAuth state validation failed.");
  }

  const encryptedPayload = fromBase64Url(body);
  const payload = JSON.parse(decryptText(encryptedPayload));

  if (!payload || !payload.clerkUserId || !payload.platform || !payload.role || !payload.timestamp) {
    throw createHttpError(400, "OAuth state is incomplete.");
  }

  if (requireCodeVerifier && !payload.codeVerifier) {
    throw createHttpError(400, "OAuth state is incomplete.");
  }

  if (Date.now() - Number(payload.timestamp) > 10 * 60 * 1000) {
    throw createHttpError(400, "OAuth state has expired. Please try again.");
  }

  return payload;
}

async function findLocalUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  return user;
}

async function resolveWhatnotSnapshotOwnerClerkUserId(clerkUserId) {
  const user = await findLocalUser(clerkUserId);

  if (user.user_type !== "staff") {
    return typeof user.clerk_user_id === "string" ? user.clerk_user_id.trim() : "";
  }

  if (!user.parent_seller_user_id) {
    throw createHttpError(400, "This staff account is not attached to a seller.");
  }

  const parentSeller = await User.findById(user.parent_seller_user_id);

  if (!parentSeller) {
    throw createHttpError(404, "Parent seller account was not found.");
  }

  const parentClerkUserId =
    typeof parentSeller.clerk_user_id === "string" ? parentSeller.clerk_user_id.trim() : "";

  if (!parentClerkUserId) {
    throw createHttpError(400, "Parent seller does not have a Clerk user id.");
  }

  return parentClerkUserId;
}

function buildFrontendRedirect({ role, platform, status, message }) {
  const redirectUrl = new URL(`${getFrontendUrl()}/launch-pad`);
  redirectUrl.searchParams.set("role", role);
  redirectUrl.searchParams.set("platform", platform);
  redirectUrl.searchParams.set("status", status);

  if (message) {
    redirectUrl.searchParams.set("message", message);
  }

  return redirectUrl.toString();
}

async function fetchTikTokToken(body) {
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams(body).toString(),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    throw createHttpError(502, payload.error_description || payload.error || "TikTok token exchange failed.", payload);
  }

  return payload;
}

async function fetchWhatnotToken(body) {
  const { tokenUrl, clientSecret } = getWhatnotConfig();
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
      Authorization: `Bearer ${clientSecret}`,
    },
    body: new URLSearchParams(body).toString(),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createHttpError(
      response.status || 502,
      payload.error_description || payload.error || payload.message || "Whatnot token exchange failed.",
      payload,
    );
  }

  return payload;
}

function serializeConnectedAccount(account) {
  return {
    id: account._id,
    platform: account.platform,
    connected: account.status === "connected",
    status: account.status,
    username: account.account_name || null,
    externalId: account.account_external_id || null,
    expiresAt: account.token_expires_at || null,
  };
}

function getTikTokUserInfoFields() {
  return process.env.TIKTOK_USER_INFO_FIELDS || TIKTOK_ENHANCED_USER_INFO_FIELDS;
}

function getTikTokFallbackUserInfoFields() {
  return TIKTOK_BASIC_USER_INFO_FIELDS;
}

function getTikTokStatsUserInfoFields() {
  return process.env.TIKTOK_STATS_USER_INFO_FIELDS || TIKTOK_STATS_USER_INFO_FIELDS;
}

function getTikTokVideoListFields() {
  return process.env.TIKTOK_VIDEO_LIST_FIELDS || TIKTOK_VIDEO_LIST_DEFAULT_FIELDS;
}

function getTikTokVideoQueryFields() {
  return process.env.TIKTOK_VIDEO_QUERY_FIELDS || TIKTOK_VIDEO_QUERY_DEFAULT_FIELDS;
}

function getTikTokVideoMaxCount() {
  const value = Number(process.env.TIKTOK_VIDEO_MAX_COUNT || 10);

  if (!Number.isFinite(value) || value <= 0) {
    return 10;
  }

  return Math.min(20, Math.max(1, Math.floor(value)));
}

function toNullableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseTikTokApiError(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = payload.error;

  if (!error || typeof error !== "object") {
    return null;
  }

  if (error.code && error.code !== "ok") {
    return {
      code: error.code,
      message: error.message || error.code,
      details: error,
    };
  }

  return null;
}

function isWhatnotAccessDenied(responseStatus, payload) {
  if (responseStatus === 401 || responseStatus === 403) {
    return true;
  }

  if (!payload || typeof payload !== "object") {
    return false;
  }

  const errors = Array.isArray(payload.errors) ? payload.errors : [];

  return errors.some((entry) => {
    const code = entry && entry.extensions && entry.extensions.code
      ? String(entry.extensions.code).toLowerCase()
      : "";
    const message = entry && entry.message ? String(entry.message).toLowerCase() : "";

    return (
      code === "unauthenticated" ||
      code === "forbidden" ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("access")
    );
  });
}

function getWhatnotMockInventoryData() {
  return {
    products: {
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
      edges: [
        {
          cursor: "mock-cursor-1",
          node: {
            id: "mock-product-1",
            title: "Mock Vintage Hoodie",
            description: "Mock Whatnot product while API access approval is pending.",
          },
        },
      ],
    },
  };
}

async function refreshTikTokAccessToken(account) {
  if (!account || !account.refresh_token_encrypted) {
    throw createHttpError(401, "TikTok refresh token is missing. Please reconnect your TikTok account.");
  }

  const refreshToken = decryptText(account.refresh_token_encrypted);

  if (!refreshToken) {
    throw createHttpError(401, "TikTok refresh token is unavailable. Please reconnect your TikTok account.");
  }

  const { clientKey, clientSecret } = getTikTokConfig();
  const tokenPayload = await fetchTikTokToken({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const now = new Date();

  account.access_token_encrypted = encryptText(tokenPayload.access_token);
  account.refresh_token_encrypted = encryptText(tokenPayload.refresh_token || refreshToken);
  account.token_expires_at = tokenPayload.expires_in
    ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000)
    : null;
  account.status = "connected";
  account.updated_at = now;
  account.metadata_json = {
    ...(account.metadata_json || {}),
    open_id: tokenPayload.open_id || account.account_external_id || null,
    refresh_expires_in: tokenPayload.refresh_expires_in || null,
    refreshed_at: now.toISOString(),
  };

  if (tokenPayload.open_id) {
    account.account_external_id = tokenPayload.open_id;
    account.account_name = `@${tokenPayload.open_id}`;
  }

  await account.save();

  return decryptText(account.access_token_encrypted);
}

async function getValidTikTokAccessToken(account) {
  if (!account || !account.access_token_encrypted) {
    throw createHttpError(404, "TikTok account is not connected.");
  }

  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : null;
  const isExpired = expiresAt ? expiresAt <= Date.now() + 60 * 1000 : false;

  if (isExpired) {
    return refreshTikTokAccessToken(account);
  }

  return decryptText(account.access_token_encrypted);
}

async function fetchTikTokUserInfo(accessToken, fields) {
  const requestUrl = new URL(TIKTOK_USER_INFO_URL);
  requestUrl.searchParams.set("fields", fields);

  const response = await fetch(requestUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Cache-Control": "no-cache",
    },
  });

  const payload = await response.json().catch(() => ({}));
  const apiError = parseTikTokApiError(payload);

  if (!response.ok || apiError) {
    const message = apiError
      ? apiError.message
      : payload.error_description || payload.message || "TikTok user info request failed.";
    throw createHttpError(response.status || 502, message, apiError ? apiError.details : payload);
  }

  return payload;
}

async function fetchTikTokVideoList(accessToken, { fields, cursor = null, maxCount }) {
  const requestUrl = new URL(TIKTOK_VIDEO_LIST_URL);
  requestUrl.searchParams.set("fields", fields);

  const body = {
    max_count: maxCount,
  };

  if (cursor != null) {
    body.cursor = cursor;
  }

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  const apiError = parseTikTokApiError(payload);

  if (!response.ok || apiError) {
    const message = apiError
      ? apiError.message
      : payload.error_description || payload.message || "TikTok video list request failed.";
    throw createHttpError(response.status || 502, message, apiError ? apiError.details : payload);
  }

  return payload;
}

async function fetchTikTokVideoQuery(accessToken, { fields, videoIds }) {
  const requestUrl = new URL(TIKTOK_VIDEO_QUERY_URL);
  requestUrl.searchParams.set("fields", fields);

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({
      filters: {
        video_ids: videoIds,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  const apiError = parseTikTokApiError(payload);

  if (!response.ok || apiError) {
    const message = apiError
      ? apiError.message
      : payload.error_description || payload.message || "TikTok video query request failed.";
    throw createHttpError(response.status || 502, message, apiError ? apiError.details : payload);
  }

  return payload;
}

function hasScope(scopes, requiredScope) {
  if (!scopes || !requiredScope) {
    return false;
  }

  return String(scopes)
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
    .includes(requiredScope);
}

function sumNullableMetric(items, getter) {
  const numbers = items
    .map(getter)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (!numbers.length) {
    return null;
  }

  return numbers.reduce((total, value) => total + value, 0);
}

async function getTikTokProfile({ clerkUserId }) {
  const user = await findLocalUser(clerkUserId);
  const account = await ConnectedAccount.findOne({ user_id: user._id, platform: "tiktok" });

  if (!account || !account.access_token_encrypted) {
    return {
      connected: false,
      profile: null,
      account: null,
    };
  }

  const requestedFields = getTikTokUserInfoFields();
  const statsFields = getTikTokStatsUserInfoFields();
  const fallbackFields = getTikTokFallbackUserInfoFields();

  let accessToken = await getValidTikTokAccessToken(account);
  let userInfoPayload;
  let resolvedFields = requestedFields;

  try {
    userInfoPayload = await fetchTikTokUserInfo(accessToken, requestedFields);
  } catch (error) {
    const errorCode = error && error.details && error.details.code
      ? String(error.details.code).toLowerCase()
      : "";

    if (requestedFields !== statsFields && errorCode === "scope_not_authorized") {
      resolvedFields = statsFields;
      userInfoPayload = await fetchTikTokUserInfo(accessToken, statsFields);
    } else if (requestedFields !== fallbackFields && errorCode === "scope_not_authorized") {
      resolvedFields = fallbackFields;
      userInfoPayload = await fetchTikTokUserInfo(accessToken, fallbackFields);
    } else if (error.status === 401) {
      accessToken = await refreshTikTokAccessToken(account);

      try {
        userInfoPayload = await fetchTikTokUserInfo(accessToken, requestedFields);
      } catch (retryError) {
        const retryCode = retryError && retryError.details && retryError.details.code
          ? String(retryError.details.code).toLowerCase()
          : "";

        if (requestedFields !== statsFields && retryCode === "scope_not_authorized") {
          resolvedFields = statsFields;
          userInfoPayload = await fetchTikTokUserInfo(accessToken, statsFields);
        } else if (requestedFields !== fallbackFields && retryCode === "scope_not_authorized") {
          resolvedFields = fallbackFields;
          userInfoPayload = await fetchTikTokUserInfo(accessToken, fallbackFields);
        } else {
          throw retryError;
        }
      }
    } else if (requestedFields !== statsFields) {
      // If profile fields fail for any other reason, attempt stats-only fields first.
      resolvedFields = statsFields;
      userInfoPayload = await fetchTikTokUserInfo(accessToken, statsFields);
    } else if (requestedFields !== fallbackFields) {
      // If a non-auth error occurs with enhanced fields, try the documented basic field set.
      resolvedFields = fallbackFields;
      userInfoPayload = await fetchTikTokUserInfo(accessToken, fallbackFields);
    } else {
      throw error;
    }
  }

  const profile = userInfoPayload && userInfoPayload.data && userInfoPayload.data.user
    ? userInfoPayload.data.user
    : {};
  const now = new Date();

  account.status = "connected";
  account.updated_at = now;
  account.metadata_json = {
    ...(account.metadata_json || {}),
    last_profile_sync_at: now.toISOString(),
    union_id: profile.union_id || (account.metadata_json && account.metadata_json.union_id) || null,
    user_info_fields: resolvedFields,
  };

  if (profile.open_id) {
    account.account_external_id = profile.open_id;
  }

  if (profile.username) {
    account.account_name = `@${profile.username}`;
  } else if (!account.account_name && profile.open_id) {
    account.account_name = `@${profile.open_id}`;
  }

  await account.save();

  return {
    connected: true,
    profile: {
      openId: profile.open_id || account.account_external_id || null,
      unionId: profile.union_id || null,
      avatarUrl: profile.avatar_url || null,
      avatarLargeUrl: profile.avatar_large_url || null,
      displayName: profile.display_name || null,
      username: profile.username || null,
      bioDescription: profile.bio_description || null,
      profileDeepLink: profile.profile_deep_link || null,
      isVerified: typeof profile.is_verified === "boolean" ? profile.is_verified : null,
      followerCount: toNullableNumber(profile.follower_count),
      followingCount: toNullableNumber(profile.following_count),
      likesCount: toNullableNumber(profile.likes_count),
      videoCount: toNullableNumber(profile.video_count),
    },
    account: {
      platform: account.platform,
      status: account.status,
      username: account.account_name || null,
      externalId: account.account_external_id || null,
      expiresAt: account.token_expires_at || null,
      lastSyncedAt: account.metadata_json && account.metadata_json.last_profile_sync_at
        ? account.metadata_json.last_profile_sync_at
        : null,
      scopes: account.scopes_json && account.scopes_json.scope ? account.scopes_json.scope : null,
      fields: account.metadata_json && account.metadata_json.user_info_fields
        ? account.metadata_json.user_info_fields
        : resolvedFields,
    },
  };
}

async function refreshWhatnotAccessToken(account) {
  if (!account || !account.refresh_token_encrypted) {
    throw createHttpError(401, "Whatnot refresh token is missing. Please reconnect your Whatnot account.");
  }

  const refreshToken = decryptText(account.refresh_token_encrypted);

  if (!refreshToken) {
    throw createHttpError(401, "Whatnot refresh token is unavailable. Please reconnect your Whatnot account.");
  }

  const { clientId } = getWhatnotConfig();
  const tokenPayload = await fetchWhatnotToken({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const now = new Date();
  account.access_token_encrypted = encryptText(tokenPayload.access_token);
  account.refresh_token_encrypted = encryptText(tokenPayload.refresh_token || refreshToken);
  account.token_expires_at = tokenPayload.expires_in
    ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000)
    : null;
  account.status = "connected";
  account.updated_at = now;
  account.metadata_json = {
    ...(account.metadata_json || {}),
    refreshed_at: now.toISOString(),
    token_type: tokenPayload.token_type || "Bearer",
  };

  await account.save();

  return decryptText(account.access_token_encrypted);
}

async function getValidWhatnotAccessToken(account) {
  if (!account || !account.access_token_encrypted) {
    throw createHttpError(404, "Whatnot account is not connected.");
  }

  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : null;
  const isExpired = expiresAt ? expiresAt <= Date.now() + 60 * 1000 : false;

  if (isExpired) {
    return refreshWhatnotAccessToken(account);
  }

  return decryptText(account.access_token_encrypted);
}

async function fetchWhatnotGraphql(accessToken, query, variables = {}) {
  const { graphqlUrl } = getWhatnotConfig();
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));

  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

async function getWhatnotInventorySnapshot({ clerkUserId, first = 5 }) {
  const user = await findLocalUser(clerkUserId);
  const account = await ConnectedAccount.findOne({ user_id: user._id, platform: "whatnot" });

  if (!account || !account.access_token_encrypted) {
    return {
      connected: false,
      source: "none",
      fallbackReason: null,
      account: null,
      data: getWhatnotMockInventoryData(),
    };
  }

  const safeFirst = Number.isFinite(Number(first))
    ? Math.min(25, Math.max(1, Math.floor(Number(first))))
    : 5;

  let accessToken = await getValidWhatnotAccessToken(account);
  let response = await fetchWhatnotGraphql(accessToken, WHATNOT_DEFAULT_GRAPHQL_QUERY, { first: safeFirst });

  if (response.status === 401) {
    accessToken = await refreshWhatnotAccessToken(account);
    response = await fetchWhatnotGraphql(accessToken, WHATNOT_DEFAULT_GRAPHQL_QUERY, { first: safeFirst });
  }

  const hasEmptyData = !response.payload || typeof response.payload !== "object" || !response.payload.data;

  if (!response.ok || Array.isArray(response.payload && response.payload.errors)) {
    if (isWhatnotAccessDenied(response.status, response.payload)) {
      return {
        connected: true,
        source: "mock",
        fallbackReason: "access_denied",
        account: {
          platform: account.platform,
          status: account.status,
          username: account.account_name || null,
          externalId: account.account_external_id || null,
          expiresAt: account.token_expires_at || null,
          scopes: account.scopes_json && account.scopes_json.scope ? account.scopes_json.scope : null,
        },
        data: getWhatnotMockInventoryData(),
      };
    }

    throw createHttpError(
      response.status || 502,
      "Whatnot GraphQL request failed.",
      response.payload,
    );
  }

  if (hasEmptyData) {
    return {
      connected: true,
      source: "mock",
      fallbackReason: "empty_response",
      account: {
        platform: account.platform,
        status: account.status,
        username: account.account_name || null,
        externalId: account.account_external_id || null,
        expiresAt: account.token_expires_at || null,
        scopes: account.scopes_json && account.scopes_json.scope ? account.scopes_json.scope : null,
      },
      data: getWhatnotMockInventoryData(),
    };
  }

  return {
    connected: true,
    source: "live",
    fallbackReason: null,
    account: {
      platform: account.platform,
      status: account.status,
      username: account.account_name || null,
      externalId: account.account_external_id || null,
      expiresAt: account.token_expires_at || null,
      scopes: account.scopes_json && account.scopes_json.scope ? account.scopes_json.scope : null,
    },
    data: response.payload.data,
  };
}

async function getTikTokVideoAnalytics({ clerkUserId, cursor = null, maxCount }) {
  const user = await findLocalUser(clerkUserId);
  const account = await ConnectedAccount.findOne({ user_id: user._id, platform: "tiktok" });

  if (!account || !account.access_token_encrypted) {
    return {
      connected: false,
      hasVideoScope: false,
      account: null,
      followerBreakdown: null,
      summary: {
        totalVideos: 0,
        totalViews: null,
        totalComments: null,
        totalLikes: null,
        totalShares: null,
      },
      videos: [],
      pagination: {
        cursor: null,
        hasMore: false,
      },
    };
  }

  const safeMaxCount = Number.isFinite(Number(maxCount))
    ? Math.min(20, Math.max(1, Math.floor(Number(maxCount))))
    : getTikTokVideoMaxCount();
  const listFields = getTikTokVideoListFields();
  const queryFields = getTikTokVideoQueryFields();
  const accountScopes = account.scopes_json && account.scopes_json.scope ? account.scopes_json.scope : "";
  const hasVideoScope = hasScope(accountScopes, "video.list");

  let profileData = null;

  try {
    profileData = await getTikTokProfile({ clerkUserId });
  } catch (error) {
    profileData = null;
  }

  if (!hasVideoScope) {
    return {
      connected: true,
      hasVideoScope: false,
      account: {
        platform: account.platform,
        status: account.status,
        username: account.account_name || null,
        scopes: accountScopes || null,
      },
      followerBreakdown: profileData && profileData.profile
        ? {
          followers: toNullableNumber(profileData.profile.followerCount),
          following: toNullableNumber(profileData.profile.followingCount),
          likes: toNullableNumber(profileData.profile.likesCount),
          videos: toNullableNumber(profileData.profile.videoCount),
        }
        : null,
      summary: {
        totalVideos: 0,
        totalViews: null,
        totalComments: null,
        totalLikes: null,
        totalShares: null,
      },
      videos: [],
      pagination: {
        cursor: null,
        hasMore: false,
      },
    };
  }

  let accessToken = await getValidTikTokAccessToken(account);
  let listPayload;

  try {
    listPayload = await fetchTikTokVideoList(accessToken, {
      fields: listFields,
      cursor,
      maxCount: safeMaxCount,
    });
  } catch (error) {
    const errorCode = error && error.details && error.details.code
      ? String(error.details.code).toLowerCase()
      : "";

    if (errorCode === "scope_not_authorized") {
      return {
        connected: true,
        hasVideoScope: false,
        account: {
          platform: account.platform,
          status: account.status,
          username: account.account_name || null,
          scopes: accountScopes || null,
        },
        followerBreakdown: profileData && profileData.profile
          ? {
            followers: toNullableNumber(profileData.profile.followerCount),
            following: toNullableNumber(profileData.profile.followingCount),
            likes: toNullableNumber(profileData.profile.likesCount),
            videos: toNullableNumber(profileData.profile.videoCount),
          }
          : null,
        summary: {
          totalVideos: 0,
          totalViews: null,
          totalComments: null,
          totalLikes: null,
          totalShares: null,
        },
        videos: [],
        pagination: {
          cursor: null,
          hasMore: false,
        },
      };
    }

    if (error.status === 401) {
      accessToken = await refreshTikTokAccessToken(account);
      listPayload = await fetchTikTokVideoList(accessToken, {
        fields: listFields,
        cursor,
        maxCount: safeMaxCount,
      });
    } else {
      throw error;
    }
  }

  const listedVideos = listPayload && listPayload.data && Array.isArray(listPayload.data.videos)
    ? listPayload.data.videos
    : [];
  const videoIds = listedVideos
    .map((video) => video && video.id)
    .filter(Boolean)
    .slice(0, 20);

  let queriedVideos = [];

  if (videoIds.length) {
    try {
      const queryPayload = await fetchTikTokVideoQuery(accessToken, {
        fields: queryFields,
        videoIds,
      });
      queriedVideos = queryPayload && queryPayload.data && Array.isArray(queryPayload.data.videos)
        ? queryPayload.data.videos
        : [];
    } catch (error) {
      if (error.status === 401) {
        accessToken = await refreshTikTokAccessToken(account);
        const queryPayload = await fetchTikTokVideoQuery(accessToken, {
          fields: queryFields,
          videoIds,
        });
        queriedVideos = queryPayload && queryPayload.data && Array.isArray(queryPayload.data.videos)
          ? queryPayload.data.videos
          : [];
      }
    }
  }

  const queryById = new Map(queriedVideos.map((video) => [video.id, video]));
  const normalizedVideos = listedVideos.map((video) => {
    const merged = {
      ...(video || {}),
      ...(queryById.get(video.id) || {}),
    };
    const createTime = toNullableNumber(merged.create_time);

    return {
      id: merged.id || null,
      title: merged.title || merged.video_description || null,
      coverImageUrl: merged.cover_image_url || null,
      shareUrl: merged.share_url || null,
      createTime,
      viewCount: toNullableNumber(merged.view_count),
      commentCount: toNullableNumber(merged.comment_count),
      likeCount: toNullableNumber(merged.like_count),
      shareCount: toNullableNumber(merged.share_count),
    };
  });

  return {
    connected: true,
    hasVideoScope,
    account: {
      platform: account.platform,
      status: account.status,
      username: account.account_name || null,
      scopes: accountScopes || null,
    },
    followerBreakdown: profileData && profileData.profile
      ? {
        followers: toNullableNumber(profileData.profile.followerCount),
        following: toNullableNumber(profileData.profile.followingCount),
        likes: toNullableNumber(profileData.profile.likesCount),
        videos: toNullableNumber(profileData.profile.videoCount),
      }
      : null,
    summary: {
      totalVideos: normalizedVideos.length,
      totalViews: sumNullableMetric(normalizedVideos, (video) => video.viewCount),
      totalComments: sumNullableMetric(normalizedVideos, (video) => video.commentCount),
      totalLikes: sumNullableMetric(normalizedVideos, (video) => video.likeCount),
      totalShares: sumNullableMetric(normalizedVideos, (video) => video.shareCount),
    },
    videos: normalizedVideos,
    pagination: {
      cursor: listPayload && listPayload.data ? listPayload.data.cursor || null : null,
      hasMore: Boolean(listPayload && listPayload.data && listPayload.data.has_more),
    },
  };
}

function resolveStripeAccountTypeForRole(role) {
  const normalized = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (normalized === "admin" || normalized === "platform") {
    return "platform";
  }
  if (normalized === "staff") {
    return "staff";
  }
  return "moderator";
}

async function upsertStripeConnectSnapshot({
  localUserId,
  stripeAccountId,
  stripeAccount = null,
  onboardingStatus,
  accountType = "moderator",
}) {
  if (!localUserId || !stripeAccountId) {
    return null;
  }

  const now = new Date();
  const existing = await StripeConnectAccount.findOne({
    user_id: localUserId,
    account_type: accountType,
  });
  const record = existing || new StripeConnectAccount({
    user_id: localUserId,
    account_type: accountType,
    created_at: now,
  });

  record.stripe_account_id = stripeAccountId;

  if (stripeAccount) {
    record.charges_enabled = Boolean(stripeAccount.charges_enabled);
    record.payouts_enabled = Boolean(stripeAccount.payouts_enabled);
    record.details_submitted = Boolean(stripeAccount.details_submitted);
    record.country = stripeAccount.country || record.country || "US";
    record.currency = stripeAccount.default_currency || record.currency || "usd";
  }

  if (onboardingStatus) {
    record.onboarding_status = onboardingStatus;
  }

  record.updated_at = now;
  await record.save();

  if (accountType === "platform") {
    await upsertPlatformStripeSnapshot({
      localUserId,
      stripeAccountId,
      stripeAccount,
      onboardingStatus,
    });
  }

  return record;
}

async function upsertPlatformStripeSnapshot({
  localUserId,
  stripeAccountId,
  stripeAccount,
  onboardingStatus,
}) {
  const now = new Date();
  let setting = await PlatformSetting.findOne({ scope: "global" });

  if (!setting) {
    setting = new PlatformSetting({ scope: "global", created_at: now });
  }

  setting.admin_stripe_account_id = stripeAccountId;
  setting.admin_stripe_connected_user_id = localUserId || setting.admin_stripe_connected_user_id || null;

  if (stripeAccount) {
    setting.admin_stripe_charges_enabled = Boolean(stripeAccount.charges_enabled);
    setting.admin_stripe_payouts_enabled = Boolean(stripeAccount.payouts_enabled);
    setting.admin_stripe_details_submitted = Boolean(stripeAccount.details_submitted);
  }

  if (onboardingStatus) {
    setting.admin_stripe_onboarding_status = onboardingStatus;
  }

  setting.updated_at = now;
  await setting.save();
  return setting;
}

async function getConnectedAccounts({ clerkUserId }) {
  const user = await findLocalUser(clerkUserId);
  const accounts = await ConnectedAccount.find({ user_id: user._id }).sort({ created_at: 1 });

  return {
    accounts: accounts.map(serializeConnectedAccount),
  };
}

async function createConnectionSession({ clerkUserId, role, platform }) {
  const normalizedPlatform = normalizePlatform(platform);

  if (!normalizedPlatform) {
    throw createHttpError(400, "Unsupported platform.");
  }

  if (normalizedPlatform === "stripe") {
    return createStripeConnectSession({ clerkUserId, role });
  }

  if (normalizedPlatform === "whatnot") {
    return createWhatnotConnectionSession({ clerkUserId, role });
  }

  if (normalizedPlatform !== "tiktok") {
    throw createHttpError(400, "Only TikTok, Whatnot, and Stripe connections are implemented right now.");
  }

  return createTikTokShopConnectionSession({ clerkUserId, role });
}

async function createTikTokShopConnectionSession({ clerkUserId, role }) {
  await findLocalUser(clerkUserId);

  const { appKey, serviceId, redirectUri, stateSecret } = getTikTokShopOAuthConfig();
  const state = signOAuthState(
    {
      clerkUserId,
      role,
      platform: "tiktok",
      oauthProvider: "tiktok_shop",
      nonce: crypto.randomBytes(12).toString("hex"),
      timestamp: Date.now(),
    },
    stateSecret,
  );

  const authorizationUrl = new URL(
    process.env.TIKTOK_SHOP_AUTHORIZE_URL || "https://services.tiktokshop.com/open/authorize",
  );
  authorizationUrl.searchParams.set("app_key", appKey);
  authorizationUrl.searchParams.set("service_id", serviceId);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);

  return {
    authorizationUrl: authorizationUrl.toString(),
  };
}

async function createWhatnotConnectionSession({ clerkUserId, role }) {
  await findLocalUser(clerkUserId);

  const allowMockOAuth = isWhatnotMockOAuthEnabled();
  let resolvedConfig;

  try {
    resolvedConfig = getWhatnotConfig();
  } catch (configError) {
    if (!allowMockOAuth) {
      throw configError;
    }

    resolvedConfig = {
      authorizeUrl: `${getBackendUrl()}/api/integrations/whatnot/callback`,
      clientId: "mock_client_id",
      redirectUri: process.env.WHATNOT_REDIRECT_URI || `${getBackendUrl()}/api/integrations/whatnot/callback`,
      scopes: process.env.WHATNOT_SCOPES || "read:inventory read:orders",
      stateSecret: getWhatnotStateSecret(),
      isMockOAuthStart: true,
    };
  }

  const {
    authorizeUrl,
    clientId,
    redirectUri,
    scopes,
    stateSecret,
    isMockOAuthStart = false,
  } = resolvedConfig;

  const state = signOAuthState({
    clerkUserId,
    role,
    platform: "whatnot",
    nonce: crypto.randomBytes(12).toString("hex"),
    timestamp: Date.now(),
  }, stateSecret);

  const authorizationUrl = new URL(authorizeUrl);
  if (isMockOAuthStart) {
    // Simulate provider approval callback to complete end-to-end OAuth handling in development.
    authorizationUrl.searchParams.set("code", "mock_authorization_code");
    authorizationUrl.searchParams.set("state", state);
  } else {
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("scope", scopes);
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
  };
}

async function createStripeConnectSession({ clerkUserId, role }) {
  const stripe = getStripeClient();
  const { returnUrl, refreshUrl } = getStripeConnectUrlsForRole(role);
  const user = await findLocalUser(clerkUserId);
  const accountType = resolveStripeAccountTypeForRole(role);

  const returnUrlWithParams = new URL(returnUrl);
  returnUrlWithParams.searchParams.set("platform", "stripe");
  returnUrlWithParams.searchParams.set("status", "return");
  returnUrlWithParams.searchParams.set("role", role);

  const refreshUrlWithParams = new URL(refreshUrl);
  refreshUrlWithParams.searchParams.set("platform", "stripe");
  refreshUrlWithParams.searchParams.set("status", "refresh");
  refreshUrlWithParams.searchParams.set("role", role);

  const now = new Date();

  let account = await ConnectedAccount.findOne({ user_id: user._id, platform: "stripe" });
  let stripeAccountId = account && account.account_external_id ? account.account_external_id : null;

  if (!stripeAccountId) {
    const stripeAccount = await stripe.accounts.create({
      type: "express",
      metadata: {
        clerkUserId,
        localUserId: user._id.toString(),
        role: role || (accountType === "platform" ? "admin" : "moderator"),
        accountType,
      },
    });

    stripeAccountId = stripeAccount.id;

    if (!account) {
      account = new ConnectedAccount({
        user_id: user._id,
        platform: "stripe",
        created_at: now,
      });
    }

    account.account_external_id = stripeAccountId;
    account.status = "error";
    account.metadata_json = {
      ...(account.metadata_json || {}),
      accountType,
    };
    account.updated_at = now;
    await account.save();

    await upsertStripeConnectSnapshot({
      localUserId: user._id,
      stripeAccountId,
      onboardingStatus: "created",
      accountType,
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrlWithParams.toString(),
    return_url: returnUrlWithParams.toString(),
    type: "account_onboarding",
  });

  return {
    authorizationUrl: accountLink.url,
  };
}

async function checkStripeAccountStatus({ clerkUserId }) {
  const stripe = getStripeClient();
  const user = await findLocalUser(clerkUserId);
  const accountType = resolveStripeAccountTypeForRole(user.user_type);

  const account = await ConnectedAccount.findOne({ user_id: user._id, platform: "stripe" });

  if (!account || !account.account_external_id) {
    return { connected: false, chargesEnabled: false, payoutsEnabled: false, requirements: [] };
  }

  const stripeAccount = await stripe.accounts.retrieve(account.account_external_id);
  const chargesEnabled = stripeAccount.charges_enabled;
  const payoutsEnabled = stripeAccount.payouts_enabled;
  const requirements = stripeAccount.requirements && stripeAccount.requirements.currently_due
    ? stripeAccount.requirements.currently_due
    : [];
  const isOnboardingComplete = chargesEnabled && payoutsEnabled && requirements.length === 0;
  const onboardingStatus = isOnboardingComplete ? "connected" : "incomplete";

  const now = new Date();
  account.status = isOnboardingComplete ? "connected" : "error";
  account.account_name = stripeAccount.business_profile && stripeAccount.business_profile.name
    ? stripeAccount.business_profile.name
    : (stripeAccount.email || account.account_external_id);
  account.metadata_json = {
    ...(account.metadata_json || {}),
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    requirements,
    details_submitted: stripeAccount.details_submitted,
    accountType,
    checked_at: now.toISOString(),
  };
  account.updated_at = now;
  await account.save();

  await upsertStripeConnectSnapshot({
    localUserId: user._id,
    stripeAccountId: account.account_external_id,
    stripeAccount,
    onboardingStatus,
    accountType,
  });

  return {
    connected: isOnboardingComplete,
    chargesEnabled,
    payoutsEnabled,
    requirements,
    detailsSubmitted: stripeAccount.details_submitted,
    stripeAccountId: account.account_external_id,
    accountType,
  };
}

async function handleTikTokCallback({ code, state, error, errorDescription }) {
  let payload;

  try {
    payload = parseOAuthState(state, {
      stateSecret: getTikTokShopOAuthConfig().stateSecret,
      requireCodeVerifier: false,
    });
  } catch (stateError) {
    return {
      redirectUrl: buildFrontendRedirect({
        role: "streamer",
        platform: "tiktok",
        status: "error",
        message: stateError.message,
      }),
    };
  }

  if (error) {
    return {
      redirectUrl: buildFrontendRedirect({
        role: payload.role,
        platform: payload.platform,
        status: "error",
        message: errorDescription || error,
      }),
    };
  }

  if (!code) {
    return {
      redirectUrl: buildFrontendRedirect({
        role: payload.role,
        platform: payload.platform,
        status: "error",
        message: "Missing TikTok Shop authorization code.",
      }),
    };
  }

  try {
    const user = await findLocalUser(payload.clerkUserId);
    const tokenData = await exchangeTikTokShopAuthCode(code);
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw createHttpError(502, "TikTok Shop did not return an access token.");
    }

    const shops = await fetchTikTokShopAuthorizedShops(accessToken);
    const primaryShop = shops[0];

    if (!primaryShop || !primaryShop.cipher) {
      throw createHttpError(
        400,
        "No authorized TikTok Shop was returned for this seller. Complete seller authorization in Partner Center.",
      );
    }

    const shopMeta = {
      shop_cipher: primaryShop.cipher,
      shop_id: primaryShop.id || null,
      shop_code: primaryShop.code || null,
      shop_name: primaryShop.name || null,
      region: primaryShop.region || null,
      seller_type: primaryShop.seller_type || null,
      shops,
    };

    const now = new Date();
    const account =
      (await ConnectedAccount.findOne({ user_id: user._id, platform: payload.platform })) ||
      new ConnectedAccount({ user_id: user._id, platform: payload.platform, created_at: now });

    account.account_external_id = primaryShop.id || tokenData.open_id || null;
    account.account_name = primaryShop.name || tokenData.seller_name || "TikTok Shop";
    account.scopes_json = {
      granted_scopes: Array.isArray(tokenData.granted_scopes) ? tokenData.granted_scopes : [],
    };

    await persistTikTokShopTokens(account, tokenData, shopMeta);

    return {
      redirectUrl: buildFrontendRedirect({
        role: payload.role,
        platform: payload.platform,
        status: "connected",
      }),
    };
  } catch (callbackError) {
    return {
      redirectUrl: buildFrontendRedirect({
        role: payload.role,
        platform: payload.platform,
        status: "error",
        message: callbackError.message,
      }),
    };
  }
}

async function handleWhatnotCallback({ code, state, error, errorDescription }) {
  let payload;

  try {
    payload = parseOAuthState(state, {
      stateSecret: getWhatnotStateSecret(),
      requireCodeVerifier: false,
    });
  } catch (stateError) {
    return {
      redirectUrl: buildFrontendRedirect({
        role: "streamer",
        platform: "whatnot",
        status: "error",
        message: stateError.message,
      }),
    };
  }

  if (error) {
    return {
      redirectUrl: buildFrontendRedirect({
        role: payload.role,
        platform: payload.platform,
        status: "error",
        message: errorDescription || error,
      }),
    };
  }

  if (!code) {
    return {
      redirectUrl: buildFrontendRedirect({
        role: payload.role,
        platform: payload.platform,
        status: "error",
        message: "Missing Whatnot authorization code.",
      }),
    };
  }

  try {
    const user = await findLocalUser(payload.clerkUserId);
    const allowMockTokenExchange = isWhatnotMockTokenExchangeEnabled();

    let resolvedConfig;

    try {
      resolvedConfig = getWhatnotConfig();
    } catch (configError) {
      if (!allowMockTokenExchange) {
        throw configError;
      }

      resolvedConfig = {
        clientId: "mock_client_id",
        redirectUri: process.env.WHATNOT_REDIRECT_URI || `${getBackendUrl()}/api/integrations/whatnot/callback`,
        scopes: process.env.WHATNOT_SCOPES || "read:inventory read:orders",
      };
    }

    const { clientId, redirectUri, scopes } = resolvedConfig;

    let tokenPayload;
    let initialExchangeError = null;
    let usedMockTokenExchange = false;

    try {
      tokenPayload = await fetchWhatnotToken({
        client_id: clientId,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
    } catch (exchangeError) {
      initialExchangeError = exchangeError && exchangeError.message
        ? exchangeError.message
        : "Whatnot token exchange failed.";

      if (!allowMockTokenExchange) {
        throw exchangeError;
      }

      tokenPayload = getWhatnotMockTokenPayload();
      usedMockTokenExchange = true;
    }

    const now = new Date();
    const account =
      (await ConnectedAccount.findOne({ user_id: user._id, platform: payload.platform })) ||
      new ConnectedAccount({ user_id: user._id, platform: payload.platform, created_at: now });

    account.account_name = account.account_name || "@whatnot";
    account.access_token_encrypted = encryptText(tokenPayload.access_token);
    account.refresh_token_encrypted = encryptText(tokenPayload.refresh_token);
    account.token_expires_at = tokenPayload.expires_in
      ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000)
      : null;
    account.scopes_json = {
      scope: tokenPayload.scope || scopes,
      token_type: tokenPayload.token_type || "Bearer",
    };
    account.status = "connected";
    account.metadata_json = {
      ...(account.metadata_json || {}),
      connected_at: now.toISOString(),
      oauth_provider: "whatnot",
      oauth_mode: usedMockTokenExchange ? "mock_token_exchange" : "live_token_exchange",
      oauth_exchange_error: initialExchangeError,
    };
    account.updated_at = now;

    await account.save();

    return {
      redirectUrl: buildFrontendRedirect({
        role: payload.role,
        platform: payload.platform,
        status: "connected",
      }),
    };
  } catch (callbackError) {
    return {
      redirectUrl: buildFrontendRedirect({
        role: payload.role,
        platform: payload.platform,
        status: "error",
        message: callbackError.message,
      }),
    };
  }
}

async function disconnectPlatform({ clerkUserId, platform }) {
  const normalizedPlatform = normalizePlatform(platform);

  if (!normalizedPlatform) {
    throw createHttpError(400, "Unsupported platform.");
  }

  const user = await findLocalUser(clerkUserId);
  const account = await ConnectedAccount.findOne({ user_id: user._id, platform: normalizedPlatform });

  if (!account) {
    return { success: true };
  }

  const isTikTokShopAccount = account?.metadata_json?.oauth_provider === "tiktok_shop";

  if (
    normalizedPlatform === "tiktok"
    && account.access_token_encrypted
    && !isTikTokShopAccount
    && process.env.TIKTOK_CLIENT_KEY
    && process.env.TIKTOK_CLIENT_SECRET
  ) {
    const { clientKey, clientSecret } = getTikTokConfig();
    const token = decryptText(account.access_token_encrypted);

    if (token) {
      const response = await fetch(TIKTOK_REVOKE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache",
        },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          token,
        }).toString(),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw createHttpError(502, payload.error_description || "TikTok revoke failed.", payload);
      }
    }
  }

  account.status = "revoked";
  account.access_token_encrypted = null;
  account.refresh_token_encrypted = null;
  account.token_expires_at = null;
  account.updated_at = new Date();
  await account.save();

  if (normalizedPlatform === "stripe" && account.account_external_id) {
    const accountType = resolveStripeAccountTypeForRole(user.user_type);
    await upsertStripeConnectSnapshot({
      localUserId: user._id,
      stripeAccountId: account.account_external_id,
      onboardingStatus: "revoked",
      accountType,
    });

    if (accountType === "platform") {
      const setting = await PlatformSetting.findOne({ scope: "global" });
      if (setting && setting.admin_stripe_account_id === account.account_external_id) {
        setting.admin_stripe_account_id = null;
        setting.admin_stripe_charges_enabled = false;
        setting.admin_stripe_payouts_enabled = false;
        setting.admin_stripe_details_submitted = false;
        setting.admin_stripe_onboarding_status = "revoked";
        setting.admin_stripe_connected_user_id = null;
        setting.updated_at = new Date();
        await setting.save();
      }
    }
  }

  if (normalizedPlatform === "whatnot") {
    await SellerSession.deleteMany({
      platform: "whatnot",
      clerk_user_id: clerkUserId,
    });
  }

  return { success: true };
}

function resolveWhatnotUserId(sessionPayload) {
  if (!sessionPayload || typeof sessionPayload !== "object") {
    return null;
  }

  return (
    sessionPayload.user_id ||
    sessionPayload.userId ||
    sessionPayload.id ||
    (sessionPayload.user && (sessionPayload.user.id || sessionPayload.user.user_id)) ||
    null
  );
}

function resolveWhatnotUsername(sessionPayload) {
  if (!sessionPayload || typeof sessionPayload !== "object") {
    return null;
  }

  return (
    sessionPayload.username ||
    sessionPayload.handle ||
    (sessionPayload.user && (sessionPayload.user.username || sessionPayload.user.handle)) ||
    null
  );
}

async function saveWhatnotSellerSession({
  clerkUserId = null,
  auth = {},
  sessionData = {},
  tabId = null,
  source = "whatnot-extension",
}) {
  const now = new Date();
  const whatnotUserId = resolveWhatnotUserId(sessionData);
  const whatnotUsername = resolveWhatnotUsername(sessionData);
  const sessionExtensionToken = auth && auth.session_extension_token ? auth.session_extension_token : null;
  const csrfToken = auth && auth.csrf_token ? auth.csrf_token : null;
  const accessToken = auth && auth.access_token ? auth.access_token : null;
  const extensionTabId = Number.isFinite(Number(tabId)) ? Number(tabId) : null;

  const identityFilters = [{ clerk_user_id: clerkUserId || null }, { whatnot_user_id: whatnotUserId }];
  if (sessionExtensionToken) {
    identityFilters.push({ session_extension_token: sessionExtensionToken });
  }
  if (csrfToken) {
    identityFilters.push({ csrf_token: csrfToken });
  }

  const usableFilters = identityFilters.filter((entry) => Object.values(entry)[0]);

  let record = null;
  if (usableFilters.length) {
    record = await SellerSession.findOne({
      platform: "whatnot",
      $or: usableFilters,
    }).sort({ updated_at: -1 });
  }

  const isNewRecord = !record;

  if (!record) {
    record = new SellerSession({
      platform: "whatnot",
      created_at: now,
    });
  }

  record.clerk_user_id = clerkUserId || record.clerk_user_id || null;
  record.whatnot_user_id = whatnotUserId || record.whatnot_user_id || null;
  record.whatnot_username = whatnotUsername || record.whatnot_username || null;
  record.csrf_token = csrfToken || record.csrf_token || null;
  record.session_extension_token = sessionExtensionToken || record.session_extension_token || null;
  record.access_token = accessToken || record.access_token || null;
  record.cookies_present = (auth && auth.cookie_state) || {};
  record.session_payload = sessionData && typeof sessionData === "object" ? sessionData : {};
  record.source = source || "whatnot-extension";
  record.extension_tab_id = extensionTabId;
  record.connected_at = now;
  record.updated_at = now;

  await record.save();

  return {
    id: record._id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    created: isNewRecord,
  };
}

async function saveGetSessionApiData({
  responsePayload = {},
  tabId = null,
  source = "whatnot-extension",
}) {
  const now = new Date();
  const payload = responsePayload && typeof responsePayload === "object" ? responsePayload : {};

  const record = new GetSessionApiData({
    platform: "whatnot",
    source: source || "whatnot-extension",
    csrf_token: payload.csrf_token || null,
    session_extension_token: payload.session_extension_token || null,
    response_payload: payload,
    extension_tab_id: Number.isFinite(Number(tabId)) ? Number(tabId) : null,
    created_at: now,
    updated_at: now,
  });

  await record.save();

  return {
    id: record._id,
    createdAt: record.created_at,
  };
}

function toNullableDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeWhatnotOrder(order) {
  const payload = order && typeof order === "object" ? order : {};
  const isOrderNode = payload.__typename === "OrderNode"
    || (typeof payload.id === "string" && payload.id.startsWith("T3JkZXJOb2Rl"))
    || (typeof payload.uuid === "string" && payload.buyer && payload.items);
  if (!isOrderNode) {
    return null;
  }

  const buyer = payload.buyer && typeof payload.buyer === "object" ? payload.buyer : {};
  const firstItemNode = Array.isArray(payload?.items?.edges) ? payload.items.edges[0]?.node : null;
  const listingFromItem = firstItemNode && typeof firstItemNode === "object" ? firstItemNode.listing : null;
  const listing = (payload.listing && typeof payload.listing === "object" ? payload.listing : null)
    || (listingFromItem && typeof listingFromItem === "object" ? listingFromItem : {});
  const amountCandidates = [
    payload.total,
    payload.totalPrice,
    payload.total_amount,
    payload.price,
    payload.amount,
    payload.subtotal,
    payload.orderTotal,
  ];
  const currencyCandidates = [
    payload.currency,
    payload.currencyCode,
    payload.totalCurrency,
    payload.priceCurrency,
  ];

  let priceAmount = null;
  for (const candidate of amountCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      priceAmount = candidate;
      break;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        priceAmount = parsed;
        break;
      }
    }
  }

  const normalized = {
    whatnot_order_id: payload.id || payload.uuid || payload.orderId || null,
    order_number: payload.orderNumber || payload.number || payload.id || null,
    status: payload.status || payload.fulfillmentStatus || payload.orderStatus || null,
    buyer_username: buyer.username || buyer.handle || payload.buyerUsername || null,
    buyer_name: buyer.displayName || buyer.name || payload.buyerName || null,
    listing_title: listing.title || payload.title || payload.listingTitle || null,
    price_amount: priceAmount,
    price_currency: currencyCandidates.find((value) => typeof value === "string" && value.trim()) || null,
    ordered_at: toNullableDate(
      payload.createdAt ||
        payload.created_at ||
        payload.placedAt ||
        payload.purchasedAt ||
        payload.orderDate,
    ),
    raw_payload: payload,
  };

  return normalized;
}

async function saveWhatnotOrders({
  clerkUserId = null,
  orders = [],
  tabId = null,
  source = "whatnot-extension",
}) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  await findLocalUser(normalizedClerkUserId);

  const incomingOrders = Array.isArray(orders) ? orders : [];
  const extensionTabId = Number.isFinite(Number(tabId)) ? Number(tabId) : null;
  const now = new Date();
  let savedCount = 0;
  let skippedByNormalize = 0;
  let skippedMissingOrderId = 0;

  // Clean previously saved non-order documents for this user.
  await WhatnotOrder.deleteMany({
    clerk_user_id: normalizedClerkUserId,
    "raw_payload.__typename": { $ne: "OrderNode" },
  });

  for (const order of incomingOrders) {
    const normalized = normalizeWhatnotOrder(order);
    if (!normalized) {
      skippedByNormalize += 1;
      continue;
    }
    if (!normalized.whatnot_order_id) {
      skippedMissingOrderId += 1;
      continue;
    }
    await WhatnotOrder.findOneAndUpdate(
      {
        clerk_user_id: normalizedClerkUserId,
        whatnot_order_id: normalized.whatnot_order_id,
      },
      {
        $set: {
          platform: "whatnot",
          clerk_user_id: normalizedClerkUserId,
          whatnot_order_id: normalized.whatnot_order_id,
          order_number: normalized.order_number,
          status: normalized.status,
          buyer_username: normalized.buyer_username,
          buyer_name: normalized.buyer_name,
          listing_title: normalized.listing_title,
          price_amount: normalized.price_amount,
          price_currency: normalized.price_currency,
          ordered_at: normalized.ordered_at,
          extension_tab_id: extensionTabId,
          source: source || "whatnot-extension",
          raw_payload: normalized.raw_payload,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      {
        upsert: true,
      },
    );
    savedCount += 1;
  }

  return {
    savedCount,
    receivedCount: incomingOrders.length,
  };
}

function flattenSubcategories(subcategories, parentSubcategoryId = null, output = []) {
  if (!Array.isArray(subcategories) || !subcategories.length) {
    return output;
  }

  for (const subcategory of subcategories) {
    if (!subcategory || typeof subcategory !== "object") {
      continue;
    }
    const normalizedSubcategoryId = typeof subcategory.id === "string" ? subcategory.id.trim() : "";
    if (!normalizedSubcategoryId) {
      continue;
    }
    output.push({
      node: subcategory,
      parentSubcategoryId,
    });

    flattenSubcategories(subcategory.subcategories, normalizedSubcategoryId, output);
  }

  return output;
}

async function saveWhatnotInventoryEditCategories({
  responsePayload = {},
  tabId = null,
  source = "whatnot-extension",
}) {
  const payload = responsePayload && typeof responsePayload === "object" ? responsePayload : {};
  const categories = Array.isArray(payload?.data?.categories) ? payload.data.categories : [];
  const extensionTabId = Number.isFinite(Number(tabId)) ? Number(tabId) : null;
  const now = new Date();
  let savedCategoryCount = 0;
  let savedSubCategoryCount = 0;
  let savedHazmatTypeCount = 0;

  for (const category of categories) {
    if (!category || typeof category !== "object") {
      continue;
    }
    const normalizedCategoryId = typeof category.id === "string" ? category.id.trim() : "";
    if (!normalizedCategoryId) {
      continue;
    }
    const normalizedHazmatType = typeof category.hazmatType === "string" ? category.hazmatType.trim() : "";

    const categoryRecord = await WhatnotCategory.findOneAndUpdate(
      {
        platform: "whatnot",
        whatnot_category_id: normalizedCategoryId,
      },
      {
        $set: {
          label: category.label || null,
          type: category.type || null,
          position: Number.isFinite(Number(category.position)) ? Number(category.position) : null,
          hazmat_type: normalizedHazmatType || null,
          source: source || "whatnot-extension",
          extension_tab_id: extensionTabId,
          raw_payload: category,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
    savedCategoryCount += 1;

    if (normalizedHazmatType) {
      await WhatnotHazmatType.findOneAndUpdate(
        {
          platform: "whatnot",
          hazmat_type: normalizedHazmatType,
        },
        {
          $set: {
            source: source || "whatnot-extension",
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
      savedHazmatTypeCount += 1;
    }

    const flattenedSubcategories = flattenSubcategories(category.subcategories);
    for (const entry of flattenedSubcategories) {
      const subcategory = entry.node;
      const normalizedSubcategoryId = typeof subcategory.id === "string" ? subcategory.id.trim() : "";
      if (!normalizedSubcategoryId) {
        continue;
      }
      const subcategoryHazmatType = typeof subcategory.hazmatType === "string" ? subcategory.hazmatType.trim() : "";

      await WhatnotSubCategory.findOneAndUpdate(
        {
          platform: "whatnot",
          whatnot_category_id: categoryRecord._id,
          subcategory_id: normalizedSubcategoryId,
        },
        {
          $set: {
            parent_subcategory_id: entry.parentSubcategoryId || null,
            label: subcategory.label || null,
            type: subcategory.type || null,
            position: Number.isFinite(Number(subcategory.position)) ? Number(subcategory.position) : null,
            hazmat_type: subcategoryHazmatType || null,
            source: source || "whatnot-extension",
            extension_tab_id: extensionTabId,
            raw_payload: subcategory,
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
      savedSubCategoryCount += 1;
    }
  }

  return {
    receivedCategoryCount: categories.length,
    savedCategoryCount,
    savedSubCategoryCount,
    savedHazmatTypeCount,
  };
}

/**
 * Whatnot returns either:
 * - `data.shippingProfiles` (flat list) — e.g. GetShippingProfiles
 * - `data.suggestedShippingProfiles` — array of sections `{ header, profiles: [...] }` — GetSuggestedShippingProfiles
 */
function collectWhatnotShippingProfileNodes(responsePayload) {
  const payload = responsePayload && typeof responsePayload === "object" ? responsePayload : {};
  const data = payload.data && typeof payload.data === "object" ? payload.data : null;
  if (!data) {
    return [];
  }

  const byId = new Map();

  const flat = Array.isArray(data.shippingProfiles) ? data.shippingProfiles : [];
  for (const profile of flat) {
    if (!profile || typeof profile !== "object") {
      continue;
    }
    const id = typeof profile.id === "string" ? profile.id.trim() : "";
    if (id) {
      byId.set(id, profile);
    }
  }

  const sections = Array.isArray(data.suggestedShippingProfiles) ? data.suggestedShippingProfiles : [];
  for (const section of sections) {
    if (!section || typeof section !== "object") {
      continue;
    }
    const inner = Array.isArray(section.profiles) ? section.profiles : [];
    for (const profile of inner) {
      if (!profile || typeof profile !== "object") {
        continue;
      }
      const id = typeof profile.id === "string" ? profile.id.trim() : "";
      if (id && !byId.has(id)) {
        byId.set(id, profile);
      }
    }
  }

  return Array.from(byId.values());
}

async function saveWhatnotShippingProfiles({
  responsePayload = {},
  tabId = null,
  source = "whatnot-extension",
  categoryId = null,
}) {
  const payload = responsePayload && typeof responsePayload === "object" ? responsePayload : {};
  const shippingProfiles = collectWhatnotShippingProfileNodes(payload);
  const extensionTabId = Number.isFinite(Number(tabId)) ? Number(tabId) : null;
  const normalizedCategoryId = typeof categoryId === "string" && categoryId.trim() ? categoryId.trim() : null;
  const now = new Date();
  let savedProfileCount = 0;

  for (const profile of shippingProfiles) {
    if (!profile || typeof profile !== "object") {
      continue;
    }
    const normalizedProfileId = typeof profile.id === "string" ? profile.id.trim() : "";
    if (!normalizedProfileId) {
      continue;
    }

    await WhatnotProfileShipping.findOneAndUpdate(
      {
        platform: "whatnot",
        WhatnotProfileShipping_id: normalizedProfileId,
      },
      {
        $set: {
          name: profile.name || null,
          weight_amount: Number.isFinite(Number(profile.weightAmount)) ? Number(profile.weightAmount) : null,
          weight_scale: profile.weightScale || null,
          weight_name: profile.weightName || null,
          length: Number.isFinite(Number(profile.length)) ? Number(profile.length) : null,
          width: Number.isFinite(Number(profile.width)) ? Number(profile.width) : null,
          height: Number.isFinite(Number(profile.height)) ? Number(profile.height) : null,
          dimension_scale: profile.dimensionScale || null,
          category_id: normalizedCategoryId,
          source: source || "whatnot-extension",
          extension_tab_id: extensionTabId,
          raw_payload: profile,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
    savedProfileCount += 1;
  }

  return {
    receivedProfileCount: shippingProfiles.length,
    savedProfileCount,
    sources: {
      flatShippingProfiles: Array.isArray(payload?.data?.shippingProfiles) ? payload.data.shippingProfiles.length : 0,
      suggestedSections: Array.isArray(payload?.data?.suggestedShippingProfiles)
        ? payload.data.suggestedShippingProfiles.length
        : 0,
    },
  };
}

async function saveWhatnotLivestreamTagDirectDescendants({
  responsePayload = {},
}) {
  const payload = responsePayload && typeof responsePayload === "object" ? responsePayload : {};
  const mainCategories = Array.isArray(payload?.data?.livestreamTaxonomyDirectDescendants)
    ? payload.data.livestreamTaxonomyDirectDescendants
    : [];
  const now = new Date();

  let savedMainCategoryCount = 0;
  let savedRefinementCount = 0;

  for (const category of mainCategories) {
    if (!category || typeof category !== "object") {
      continue;
    }
    const mainCategoryId = typeof category.id === "string" ? category.id.trim() : "";
    if (!mainCategoryId) {
      continue;
    }

    await WhatnotLivestreamMainCategory.findOneAndUpdate(
      {
        _id: mainCategoryId,
      },
      {
        $set: {
          name: typeof category.name === "string" ? category.name : null,
          label: typeof category.label === "string" ? category.label : null,
          can_schedule_live:
            typeof category.canScheduleLive === "boolean" ? category.canScheduleLive : false,
          application_link:
            typeof category.applicationLink === "string" ? category.applicationLink : null,
          quiz_link: typeof category.quizLink === "string" ? category.quizLink : null,
          image_id:
            category.image && typeof category.image === "object" && typeof category.image.id === "string"
              ? category.image.id
              : null,
          image_url:
            category.image && typeof category.image === "object" && typeof category.image.smallImage === "string"
              ? category.image.smallImage
              : null,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      {
        upsert: true,
        new: false,
        setDefaultsOnInsert: true,
      },
    );
    savedMainCategoryCount += 1;

    const refinements = Array.isArray(category.refinements) ? category.refinements : [];
    for (const refinement of refinements) {
      if (!refinement || typeof refinement !== "object") {
        continue;
      }
      const refinementId = typeof refinement.id === "string" ? refinement.id.trim() : "";
      if (!refinementId) {
        continue;
      }

      await WhatnotLivestreamRefinementCategory.findOneAndUpdate(
        {
          _id: refinementId,
        },
        {
          $set: {
            main_category_id: mainCategoryId,
            name: typeof refinement.name === "string" ? refinement.name : null,
            label: typeof refinement.label === "string" ? refinement.label : null,
            can_schedule_live:
              typeof refinement.canScheduleLive === "boolean" ? refinement.canScheduleLive : false,
            application_link:
              typeof refinement.applicationLink === "string" ? refinement.applicationLink : null,
            quiz_link: typeof refinement.quizLink === "string" ? refinement.quizLink : null,
            image_id:
              refinement.image &&
              typeof refinement.image === "object" &&
              typeof refinement.image.id === "string"
                ? refinement.image.id
                : null,
            image_url:
              refinement.image &&
              typeof refinement.image === "object" &&
              typeof refinement.image.smallImage === "string"
                ? refinement.image.smallImage
                : null,
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        {
          upsert: true,
          new: false,
          setDefaultsOnInsert: true,
        },
      );
      savedRefinementCount += 1;
    }
  }

  return {
    receivedMainCategoryCount: mainCategories.length,
    savedMainCategoryCount,
    savedRefinementCount,
  };
}

async function getWhatnotReferenceCacheStatus() {
  const [categoryCount, subcategoryCount, shippingProfileCount, mainCategoryCount, refinementCount] = await Promise.all([
    WhatnotCategory.countDocuments({
      platform: "whatnot",
      whatnot_category_id: { $exists: true, $type: "string" },
    }),
    WhatnotSubCategory.countDocuments({
      platform: "whatnot",
      subcategory_id: { $exists: true, $type: "string" },
    }),
    WhatnotProfileShipping.countDocuments({
      platform: "whatnot",
      WhatnotProfileShipping_id: { $exists: true, $type: "string" },
    }),
    WhatnotLivestreamMainCategory.countDocuments({
      _id: { $exists: true, $type: "string" },
    }),
    WhatnotLivestreamRefinementCategory.countDocuments({
      _id: { $exists: true, $type: "string" },
    }),
  ]);

  return {
    needsSync: subcategoryCount === 0 || shippingProfileCount === 0 || mainCategoryCount === 0,
    counts: {
      categories: categoryCount,
      subcategories: subcategoryCount,
      shippingProfiles: shippingProfileCount,
      mainCategories: mainCategoryCount,
      refinements: refinementCount,
    },
  };
}

async function getWhatnotInventoryCreateFormOptions() {
  const [subcategories, shippingProfiles] = await Promise.all([
    WhatnotSubCategory.find({
      subcategory_id: { $exists: true, $type: "string" },
      label: { $exists: true, $type: "string" },
    }).sort({ label: 1 }),
    WhatnotProfileShipping.find({
      WhatnotProfileShipping_id: { $exists: true, $type: "string" },
      name: { $exists: true, $type: "string" },
    }).sort({ name: 1 }),
  ]);

  return {
    subcategories: subcategories.map((item) => ({
      id: item.subcategory_id,
      label: item.label,
      categoryId: item.whatnot_category_id || null,
    })),
    shippingProfiles: shippingProfiles.map((item) => ({
      id: item.WhatnotProfileShipping_id,
      name: item.name,
    })),
  };
}

async function getWhatnotLivestreamCategoryTree() {
  const [mainCategories, refinements] = await Promise.all([
    WhatnotLivestreamMainCategory.find({ _id: { $exists: true, $type: "string" } }).sort({ label: 1, name: 1 }),
    WhatnotLivestreamRefinementCategory.find({
      _id: { $exists: true, $type: "string" },
      main_category_id: { $exists: true, $type: "string" },
    }).sort({ label: 1, name: 1 }),
  ]);

  const refinementsByMainCategoryId = new Map();
  for (const refinement of refinements) {
    const mainCategoryId = typeof refinement.main_category_id === "string" ? refinement.main_category_id : "";
    if (!mainCategoryId) continue;
    if (!refinementsByMainCategoryId.has(mainCategoryId)) {
      refinementsByMainCategoryId.set(mainCategoryId, []);
    }
    refinementsByMainCategoryId.get(mainCategoryId).push({
      id: refinement._id,
      mainCategoryId,
      name: refinement.name || null,
      label: refinement.label || null,
    });
  }

  return {
    categories: mainCategories.map((item) => ({
      id: item._id,
      name: item.name || null,
      label: item.label || null,
      refinements: refinementsByMainCategoryId.get(item._id) || [],
    })),
  };
}

async function getWhatnotOrders({ clerkUserId, limit = 100 }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  const ownerClerkUserId = await resolveWhatnotSnapshotOwnerClerkUserId(normalizedClerkUserId);

  const safeLimit = Number.isFinite(Number(limit))
    ? Math.min(200, Math.max(1, Math.floor(Number(limit))))
    : 100;
  const orders = await WhatnotOrder.find({ clerk_user_id: ownerClerkUserId })
    .sort({ ordered_at: -1, updated_at: -1 })
    .limit(safeLimit);

  return {
    orders: orders.map((order) => ({
      id: order._id,
      whatnotOrderId: order.whatnot_order_id,
      orderNumber: order.order_number,
      status: order.status,
      buyerUsername: order.buyer_username,
      buyerName: order.buyer_name,
      listingTitle: order.listing_title,
      priceAmount: order.price_amount,
      priceCurrency: order.price_currency,
      orderedAt: order.ordered_at,
      updatedAt: order.updated_at,
      rawPayload: order.raw_payload,
    })),
  };
}

async function syncWhatnotOrdersFromExtension({ clerkUserId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  await findLocalUser(normalizedClerkUserId);

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    return {
      triggered: false,
      reason: "extension_offline",
      fetchedCount: null,
    };
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    return {
      triggered: false,
      reason: "extension_not_connected_for_user",
      fetchedCount: null,
    };
  }

  let actionResult = null;
  try {
    actionResult = await requestWhatnotAction({
      action: "fetch_whatnot_orders",
      clerkUserId: normalizedClerkUserId,
    });
  } catch (error) {
    const message = error && error.message ? String(error.message) : "Failed to sync Whatnot orders.";
    return {
      triggered: false,
      reason: /relogin|invalid token|auth/i.test(message) ? "auth_failed" : "sync_failed",
      fetchedCount: null,
      error: message,
    };
  }

  if (!actionResult || !actionResult.success) {
    const message =
      (actionResult && actionResult.error) || "Failed to sync Whatnot orders through extension.";
    return {
      triggered: false,
      reason: /relogin|invalid token|auth/i.test(String(message)) ? "auth_failed" : "sync_failed",
      fetchedCount: null,
      error: message,
    };
  }

  try {
    const liveInfo = await fetchWhatnotCurrentLiveIdFromExtension({
      clerkUserId: normalizedClerkUserId,
    });
    await tryResolveShipmentIdsFromExtensionProactive({
      clerkUserId: normalizedClerkUserId,
      liveId: liveInfo && liveInfo.liveId ? liveInfo.liveId : null,
    });
  } catch (_e) {
    /* Shipment prefetch is best-effort and must not fail order sync. */
  }

  return {
    triggered: true,
    reason: "sync_started",
    fetchedCount: Number.isFinite(Number(actionResult.count)) ? Number(actionResult.count) : null,
  };
}

async function updateWhatnotBioFromPlatform({ bio }) {
  const nextBio = typeof bio === "string" ? bio.trim() : "";

  if (!nextBio) {
    throw createHttpError(400, "Bio is required.");
  }

  const actionResult = await requestWhatnotAction({
    action: "update_bio_from_platform",
    bio: nextBio,
  });

  const body = actionResult && actionResult.data ? actionResult.data : {};
  const hasGraphqlErrors = Array.isArray(body && body.errors) && body.errors.length > 0;
  const isSuccess = actionResult && actionResult.success && !hasGraphqlErrors && body && body.data && body.data.updateProfile;

  if (!isSuccess) {
    const errorMessage = actionResult && actionResult.error
      ? actionResult.error
      : "Whatnot bio update failed through extension.";
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      errorMessage,
      body && Object.keys(body).length ? body : actionResult,
    );
  }

  return {
    success: true,
    message: "Whatnot bio updated successfully.",
    bio: nextBio,
    response: body,
  };
}

async function generateWhatnotMediaUploadUrlsFromPlatform({
  media = [],
  fileBase64 = "",
  fileContentType = "",
  preferredAddListingPhotoLabel = "",
}) {
  const normalizedMedia = Array.isArray(media)
    ? media
      .map((entry) => ({
        extension: typeof entry?.extension === "string" ? entry.extension.trim().toLowerCase() : "",
        id: typeof entry?.id === "string" ? entry.id.trim() : "",
      }))
      .filter((entry) => entry.id && entry.extension)
    : [];

  if (!normalizedMedia.length) {
    throw createHttpError(400, "At least one media item with id and extension is required.");
  }

  const normalizedFileBase64 = typeof fileBase64 === "string" ? fileBase64.trim() : "";
  if (!normalizedFileBase64) {
    throw createHttpError(400, "fileBase64 is required: image bytes must be uploaded to the signed URL before AddListingPhoto.");
  }

  const normalizedPreferredLabel =
    typeof preferredAddListingPhotoLabel === "string" ? preferredAddListingPhotoLabel.trim() : "";

  const actionResult = await requestWhatnotAction({
    action: "generate_media_upload_urls",
    media: normalizedMedia,
    fileBase64: normalizedFileBase64,
    fileContentType: typeof fileContentType === "string" ? fileContentType.trim() : "",
    ...(normalizedPreferredLabel ? { preferredAddListingPhotoLabel: normalizedPreferredLabel } : {}),
  });
  const body = actionResult && actionResult.data ? actionResult.data : {};
  const generateBody =
    body &&
    body.generateMediaUploadUrls &&
    typeof body.generateMediaUploadUrls === "object"
      ? body.generateMediaUploadUrls
      : body;
  const addListingPhotoBody =
    body &&
    body.addListingPhoto &&
    typeof body.addListingPhoto === "object"
      ? body.addListingPhoto
      : null;

  const addListingPhotoNode =
    addListingPhotoBody && addListingPhotoBody.data && addListingPhotoBody.data.addListingPhoto
      ? addListingPhotoBody.data.addListingPhoto
      : null;

  const hasGenerateErrors = Array.isArray(generateBody && generateBody.errors) && generateBody.errors.length > 0;
  const hasAddListingPhotoErrors =
    Array.isArray(addListingPhotoBody && addListingPhotoBody.errors) && addListingPhotoBody.errors.length > 0;
  const hasGraphqlErrors = hasGenerateErrors || hasAddListingPhotoErrors;
  const firstGraphqlErrorMessage = hasGenerateErrors && generateBody.errors[0] && generateBody.errors[0].message
    ? String(generateBody.errors[0].message)
    : hasAddListingPhotoErrors && addListingPhotoBody.errors[0] && addListingPhotoBody.errors[0].message
      ? String(addListingPhotoBody.errors[0].message)
    : "";
  const firstResultErrorMessage =
    actionResult &&
    actionResult.data &&
    Array.isArray(actionResult.data.errors) &&
    actionResult.data.errors[0] &&
    actionResult.data.errors[0].message
      ? String(actionResult.data.errors[0].message)
      : "";

  const addListingRejected =
    addListingPhotoNode &&
    typeof addListingPhotoNode.success === "boolean" &&
    addListingPhotoNode.success === false;

  if (!actionResult || !actionResult.success || hasGraphqlErrors || addListingRejected) {
    const errorMessage = actionResult && actionResult.error
      ? actionResult.error
      : addListingRejected &&
          addListingPhotoNode &&
          typeof addListingPhotoNode.message === "string" &&
          addListingPhotoNode.message.trim()
        ? addListingPhotoNode.message.trim()
        : firstGraphqlErrorMessage
          ? `Whatnot media upload URL request failed: ${firstGraphqlErrorMessage}`
          : firstResultErrorMessage
            ? `Whatnot media upload URL request failed: ${firstResultErrorMessage}`
            : actionResult && Number.isFinite(Number(actionResult.status))
              ? `Whatnot media upload URL request failed (status ${actionResult.status}).`
              : "Whatnot media upload URL request failed through extension.";
    console.error("[Whatnot GenerateMediaUploadUrls Error]", {
      status: actionResult && actionResult.status ? actionResult.status : null,
      success: actionResult && typeof actionResult.success === "boolean" ? actionResult.success : null,
      error: actionResult && actionResult.error ? actionResult.error : null,
      body,
    });

    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      errorMessage,
      body && Object.keys(body).length ? body : actionResult,
    );
  }

  if (!body || typeof body !== "object") {
    const fallbackMessage = "Whatnot media upload URL request returned an empty response.";
    console.error("[Whatnot GenerateMediaUploadUrls Empty Response]", {
      status: actionResult && actionResult.status ? actionResult.status : null,
      success: actionResult && typeof actionResult.success === "boolean" ? actionResult.success : null,
      body,
    });
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      fallbackMessage,
      actionResult || null,
    );
  }

  // User requested the response to be logged on backend console.
  console.log("[Whatnot GenerateMediaUploadUrls Response]", generateBody);
  if (addListingPhotoBody) {
    console.log("[Whatnot AddListingPhoto Response]", addListingPhotoBody);
  }

  if (addListingPhotoBody && typeof addListingPhotoBody === "object") {
    return addListingPhotoBody;
  }

  return body;
}

/**
 * Builds default productAttributeValues for CreateListing from cached SellerHubInventoryEdit /
 * category browse payloads stored on WhatnotSubCategory.raw_payload. Whatnot rejects CreateListing for
 * many categories unless each required listing attribute has a `{ id, value }` entry shaped like GraphQL expects.
 *
 * Matches Whatnot Seller Hub behavior: picks the first allowed value label for each listing attribute bucket.
 *
 * @param {unknown} rawPayload Cached subcategory object from Mongo.
 * @returns {Array<{ id: string; value: string }>}
 */
function inferProductListingAttributeDefaultsFromCachedPayload(rawPayload) {
  const byAttributeId = new Map();

  function pickDisplayValue(candidate) {
    if (candidate == null) {
      return "";
    }

    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate).trim();
    }

    if (typeof candidate === "object") {
      const next =
        candidate.title ??
        candidate.label ??
        candidate.value ??
        candidate.name ??
        (candidate.displayValue !== undefined ? candidate.displayValue : null);
      if (next != null && String(next).trim()) {
        return String(next).trim();
      }
    }

    return "";
  }

  /**
   * @param {unknown} node
   */
  function visit(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    // Relay pagination shape
    if (Array.isArray(node.edges)) {
      node.edges.forEach((edge) => {
        if (edge && typeof edge === "object" && "node" in edge) {
          visit(edge.node);
        } else {
          visit(edge);
        }
      });
    }

    const candidates = [];

    const allowedKeys = [
      "listingAttributeAllowedValuesForCreation",
      "listingAttributeAllowedValues",
      "allowedValues",
    ];

    allowedKeys.forEach((keyName) => {
      if (Array.isArray(node[keyName]) && node[keyName].length) {
        candidates.push(node[keyName]);
      }
    });

    if (typeof node.id === "string") {
      const attrIdTrimmed = node.id.trim();
      for (const vals of candidates) {
        const first = vals && vals.length ? vals[0] : null;
        const display = pickDisplayValue(first);
        if (attrIdTrimmed && display && !byAttributeId.has(attrIdTrimmed)) {
          byAttributeId.set(attrIdTrimmed, display);
        }
      }
    }

    Object.keys(node).forEach((key) => {
      const child = node[key];
      if (child && typeof child === "object") {
        visit(child);
      }
    });
  }

  visit(rawPayload);

  const result = [];

  byAttributeId.forEach((value, id) => {
    result.push({ id, value });
  });

  return result;
}

async function createWhatnotListingFromPlatform({
  title = "",
  description = "",
  quantity = null,
  priceUsd = null,
  subcategoryId = "",
  shippingProfileId = "",
  hazmatType = "",
  imageId = "",
  productAttributeValues = null,
}) {
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : "";
  const normalizedSubcategoryId = typeof subcategoryId === "string" ? subcategoryId.trim() : "";
  const normalizedShippingProfileId = typeof shippingProfileId === "string" ? shippingProfileId.trim() : "";
  const normalizedHazmatType = typeof hazmatType === "string" ? hazmatType.trim() : "";
  const normalizedImageId = typeof imageId === "string" ? imageId.trim() : "";
  const normalizedQuantity = Number(quantity);
  const normalizedPriceUsd = Number(priceUsd);

  if (!normalizedTitle) {
    throw createHttpError(400, "title is required.");
  }
  if (!normalizedDescription) {
    throw createHttpError(400, "description is required.");
  }
  if (!normalizedSubcategoryId) {
    throw createHttpError(400, "subcategoryId is required.");
  }
  if (!normalizedShippingProfileId) {
    throw createHttpError(400, "shippingProfileId is required.");
  }
  if (!normalizedHazmatType) {
    throw createHttpError(400, "hazmatType is required.");
  }
  if (!normalizedImageId) {
    throw createHttpError(400, "imageId is required. Upload image via AddListingPhoto first.");
  }
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0 || !Number.isInteger(normalizedQuantity)) {
    throw createHttpError(400, "quantity must be a whole number greater than 0.");
  }
  if (!Number.isFinite(normalizedPriceUsd) || normalizedPriceUsd <= 0) {
    throw createHttpError(400, "priceUsd must be greater than 0.");
  }

  const selectedSubcategory = await WhatnotSubCategory.findOne({
    platform: "whatnot",
    subcategory_id: normalizedSubcategoryId,
  }).sort({ updated_at: -1 });
  if (!selectedSubcategory) {
    throw createHttpError(400, "Selected subcategory was not found in Whatnot category cache.");
  }

  const selectedShippingProfile = await WhatnotProfileShipping.findOne({
    platform: "whatnot",
    WhatnotProfileShipping_id: normalizedShippingProfileId,
  }).sort({ updated_at: -1 });
  if (!selectedShippingProfile) {
    throw createHttpError(400, "Selected shipping profile was not found in Whatnot shipping profile cache.");
  }

  let resolvedProductAttributes = [];

  if (Array.isArray(productAttributeValues) && productAttributeValues.length) {
    resolvedProductAttributes = productAttributeValues
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const attrId =
          typeof entry.id === "string" ? entry.id.trim() : typeof entry.attributeId === "string"
            ? entry.attributeId.trim()
            : "";

        let valueRaw = entry.value ?? entry.label ?? entry.displayValue ?? null;
        let valueNext = "";

        if (typeof valueRaw === "string") {
          valueNext = valueRaw.trim();
        } else if (
          typeof valueRaw === "object"
          && valueRaw !== null
          && typeof valueRaw.value === "string"
        ) {
          valueNext = valueRaw.value.trim();
        }

        if (!attrId || !valueNext) {
          return null;
        }

        return {
          id: attrId,
          value: valueNext,
        };
      })
      .filter((entry) => Boolean(entry));
  } else {
    resolvedProductAttributes = inferProductListingAttributeDefaultsFromCachedPayload(
      selectedSubcategory.raw_payload,
    );
  }

  const listingPayload = {
    barcode: null,
    catalogProductId: null,
    categoryId: normalizedSubcategoryId,
    costPerItem: null,
    description: normalizedDescription,
    hazmatType: normalizedHazmatType,
    images: [{ id: normalizedImageId }],
    videoIds: [],
    isPartialSave: false,
    listIndividually: false,
    price: {
      amount: Math.round(normalizedPriceUsd * 100),
      currency: "USD",
    },
    productAttributeValues: resolvedProductAttributes,
    productId: null,
    quantity: normalizedQuantity,
    reservedForSalesChannel: "NONE",
    salesChannels: [{ id: null, type: "MARKETPLACE" }],
    shippingProfileId: normalizedShippingProfileId,
    sku: null,
    timedListingEvent: null,
    title: normalizedTitle,
    transactionProps: {
      auction: null,
      isOfferable: false,
      purchaseLimits: null,
    },
    transactionType: "BUY_IT_NOW",
    uuid: null,
    variants: null,
    weight: null,
    metadata: {
      productLookupId: null,
    },
    isQuickAdd: false,
  };

  const actionResult = await requestWhatnotAction({
    action: "create_listing",
    createListingPayload: listingPayload,
  });
  const body = actionResult && actionResult.data ? actionResult.data : {};
  const hasGraphqlErrors = Array.isArray(body && body.errors) && body.errors.length > 0;
  const listingErrorMessage =
    body &&
    body.data &&
    body.data.createListing &&
    typeof body.data.createListing.error === "string" &&
    body.data.createListing.error.trim()
      ? body.data.createListing.error.trim()
      : "";

  if (!actionResult || !actionResult.success || hasGraphqlErrors || listingErrorMessage) {
    const firstGraphqlErrorMessage =
      hasGraphqlErrors && body.errors[0] && body.errors[0].message
        ? String(body.errors[0].message)
        : "";
    const errorMessage = actionResult && actionResult.error
      ? actionResult.error
      : listingErrorMessage
        ? listingErrorMessage
        : firstGraphqlErrorMessage
          ? `Whatnot CreateListing failed: ${firstGraphqlErrorMessage}`
          : "Whatnot CreateListing request failed through extension.";

    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      errorMessage,
      body && Object.keys(body).length ? body : actionResult,
    );
  }

  return body;
}

async function deleteWhatnotInventoryFromPlatform({
  clerkUserId = "",
  inventoryIds = [],
  statusFilter = "ACTIVE",
}) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(401, "Authentication required.");
  }

  const normalizedIds = Array.isArray(inventoryIds)
    ? [...new Set(inventoryIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
    : [];

  if (!normalizedIds.length) {
    throw createHttpError(400, "inventoryIds is required.");
  }

  const actionResult = await requestWhatnotAction({
    action: "delete_listing",
    ids: normalizedIds,
  });
  const body = actionResult && actionResult.data ? actionResult.data : {};
  const hasGraphqlErrors = Array.isArray(body && body.errors) && body.errors.length > 0;
  const resultArray = Array.isArray(body?.data?.sellerBulkListingAction)
    ? body.data.sellerBulkListingAction
    : [];
  const failedResults = resultArray.filter(
    (entry) => entry && typeof entry.error === "string" && entry.error.trim(),
  );

  if (!actionResult || !actionResult.success || hasGraphqlErrors || failedResults.length) {
    const firstGraphqlErrorMessage =
      hasGraphqlErrors && body.errors[0] && body.errors[0].message
        ? String(body.errors[0].message)
        : "";
    const firstListingErrorMessage =
      failedResults[0] && failedResults[0].error
        ? String(failedResults[0].error).trim()
        : "";
    const errorMessage = actionResult && actionResult.error
      ? actionResult.error
      : firstListingErrorMessage
        ? firstListingErrorMessage
        : firstGraphqlErrorMessage
          ? `Whatnot SellerBulkListingAction failed: ${firstGraphqlErrorMessage}`
          : "Whatnot inventory delete failed through extension.";

    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      errorMessage,
      body && Object.keys(body).length ? body : actionResult,
    );
  }

  await findLocalUser(normalizedClerkUserId);
  const ownerClerkUserId = await resolveWhatnotSnapshotOwnerClerkUserId(normalizedClerkUserId);
  const normalizedStatus = normalizeInventoryStatus(statusFilter);

  await WhatnotInventorySnapshot.deleteMany({
    platform: "whatnot",
    clerk_user_id: ownerClerkUserId,
    status_filter: normalizedStatus,
    inventory_id: { $in: normalizedIds },
  });

  return {
    success: true,
    message: "Whatnot inventory deleted successfully.",
    deletedIds: normalizedIds,
    response: body,
  };
}

async function saveWhatnotInventorySnapshotsFromExtension({
  clerkUserId = null,
  status = "ACTIVE",
  responsePayload = {},
  requestPayload = {},
  tabId = null,
  source = "whatnot-extension",
}) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  const payload = responsePayload && typeof responsePayload === "object" ? responsePayload : {};
  const normalizedStatus = normalizeInventoryStatus(
    status || extractInventoryStatusFilterFromRequestPayload(requestPayload),
  );
  const edges = extractInventoryEdgesFromGraphqlBody(payload);

  const saveResult = await saveWhatnotInventorySnapshots({
    clerkUserId: normalizedClerkUserId,
    statusFilter: normalizedStatus,
    edges,
    requestPayload,
    source,
    extensionTabId: tabId,
  });

  const ownerClerkUserId = saveResult.ownerClerkUserId;
  const latestRecords = await WhatnotInventorySnapshot.find({
    platform: "whatnot",
    clerk_user_id: ownerClerkUserId,
    status_filter: normalizedStatus,
  }).sort({ synced_at: -1, updated_at: -1 });

  const latestSyncedAt = saveResult.syncedAt ? new Date(saveResult.syncedAt).getTime() : null;
  const latestSnapshots = latestSyncedAt == null
    ? latestRecords
    : latestRecords.filter((record) => {
      const recordSyncedAt = record.synced_at ? new Date(record.synced_at).getTime() : null;
      return recordSyncedAt === latestSyncedAt;
    });

  return {
    savedCount: saveResult.savedCount,
    receivedCount: edges.length,
    status: normalizedStatus,
    syncedAt: saveResult.syncedAt,
    responsePayload: buildWhatnotInventoryResponsePayloadFromRecords(latestSnapshots),
  };
}

function whatnotInventorySnapshotHasStoredItems(snapshotPayload) {
  return extractInventoryEdgesFromGraphqlBody(snapshotPayload).length > 0;
}

async function fetchWhatnotInventoryTabDataFromExtension({ clerkUserId, status = "ACTIVE", forceRefresh = false }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }
  const normalizedStatus = normalizeInventoryStatus(status);

  if (!forceRefresh) {
    const cached = await getLatestWhatnotInventorySnapshot({
      clerkUserId: normalizedClerkUserId,
      status: normalizedStatus,
    });
    if (whatnotInventorySnapshotHasStoredItems(cached.responsePayload)) {
      const cachedEdges = extractInventoryEdgesFromGraphqlBody(cached.responsePayload);
      console.log(
        `[Whatnot Inventory Tab] Loaded ${cachedEdges.length} listing(s) from whatnot_inventory_snapshots (${normalizedStatus}).`,
      );
      return {
        status: normalizedStatus,
        syncedAt: cached.syncedAt,
        snapshotId: cached.snapshotId,
        syncedProducts: cachedEdges.length,
        savedToDatabase: true,
        responsePayload: cached.responsePayload,
        fromCache: true,
      };
    }
  }

  console.log(`[Whatnot Inventory Tab] Fetching live inventory (${normalizedStatus}) via extension.`);

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    throw createHttpError(503, "Whatnot extension is offline. Open the extension and connect Whatnot.");
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    throw createHttpError(
      403,
      "Extension is not connected for this seller. Sign in on the extension with the same account.",
    );
  }

  const requestPayload = {
    after: null,
    filters: [],
    first: null,
    groupBy: null,
    query: null,
    sellerId: null,
    sort: null,
    statuses: [normalizedStatus],
    transactionTypes: null,
  };

  const actionResult = await requestWhatnotAction({
    action: "fetch_seller_hub_inventory",
    status: normalizedStatus,
    requestPayload,
    clerkUserId: normalizedClerkUserId,
  });

  if (!actionResult || !actionResult.success) {
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      (actionResult && actionResult.error) || "Change filter to get the Updated inventory list.",
      actionResult || null,
    );
  }

  const body = actionResult && actionResult.data ? actionResult.data : {};
  if (Array.isArray(body && body.errors) && body.errors.length) {
    const firstError = body.errors[0] && body.errors[0].message
      ? String(body.errors[0].message)
      : "Whatnot inventory GraphQL returned errors.";
    throw createHttpError(502, firstError, body);
  }

  const edges = extractInventoryEdgesFromGraphqlBody(body);
  const saveResult = await saveWhatnotInventorySnapshots({
    clerkUserId: normalizedClerkUserId,
    statusFilter: normalizedStatus,
    edges,
    requestPayload,
    source: "whatnot-extension-live",
    extensionTabId: actionResult.tabId ?? null,
  });

  const ownerClerkUserId = saveResult.ownerClerkUserId;
  const latestRecords = await WhatnotInventorySnapshot.find({
    platform: "whatnot",
    clerk_user_id: ownerClerkUserId,
    status_filter: normalizedStatus,
  }).sort({ synced_at: -1, updated_at: -1 });

  const latestSyncedAt = saveResult.syncedAt ? new Date(saveResult.syncedAt).getTime() : null;
  const latestSnapshots = latestSyncedAt == null
    ? latestRecords
    : latestRecords.filter((record) => {
      const recordSyncedAt = record.synced_at ? new Date(record.synced_at).getTime() : null;
      return recordSyncedAt === latestSyncedAt;
    });

  console.log(
    `[Whatnot Inventory Tab] Saved ${saveResult.savedCount} listing(s) to whatnot_inventory_snapshots (${normalizedStatus}).`,
  );

  return {
    status: normalizedStatus,
    syncedAt: saveResult.syncedAt,
    snapshotId: latestSnapshots.length ? latestSnapshots[0]._id : null,
    syncedProducts: saveResult.savedCount,
    savedToDatabase: saveResult.savedCount > 0,
    responsePayload: buildWhatnotInventoryResponsePayloadFromRecords(latestSnapshots),
    fromCache: false,
  };
}

async function syncWhatnotInventoryFromPlatform({ clerkUserId, status = "ACTIVE", forceRefresh = true }) {
  return fetchWhatnotInventoryTabDataFromExtension({
    clerkUserId,
    status,
    forceRefresh,
  });
}

async function fetchWhatnotCurrentLiveIdFromExtension({ clerkUserId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  await findLocalUser(normalizedClerkUserId);

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    return {
      liveId: null,
      title: null,
      startTime: null,
      livestreams: [],
      reason: "extension_offline",
    };
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    return {
      liveId: null,
      title: null,
      startTime: null,
      livestreams: [],
      reason: "extension_not_connected_for_user",
    };
  }

  let actionResult = null;
  try {
    actionResult = await requestWhatnotAction({
      action: "fetch_shipments_livestreams",
      clerkUserId: normalizedClerkUserId,
    });
  } catch (error) {
    return {
      liveId: null,
      title: null,
      startTime: null,
      livestreams: [],
      reason: "extension_request_failed",
      error: error && error.message ? String(error.message) : "unknown",
    };
  }

  if (!actionResult || !actionResult.success) {
    return {
      liveId: null,
      title: null,
      startTime: null,
      livestreams: [],
      reason: "fetch_failed",
      error:
        (actionResult && actionResult.error) ||
        "Failed to fetch Whatnot livestreams through extension.",
    };
  }

  const body = actionResult.data && typeof actionResult.data === "object" ? actionResult.data : {};
  if (Array.isArray(body.errors) && body.errors.length) {
    const firstError = body.errors[0] && body.errors[0].message
      ? String(body.errors[0].message)
      : "GetShipmentsLivestreams GraphQL returned errors.";
    return {
      liveId: null,
      title: null,
      startTime: null,
      livestreams: [],
      reason: "graphql_errors",
      error: firstError,
    };
  }

  const edges =
    body.data &&
    body.data.livestreamsByUserId &&
    Array.isArray(body.data.livestreamsByUserId.edges)
      ? body.data.livestreamsByUserId.edges
      : [];

  const nodes = edges
    .map((edge) => (edge && typeof edge === "object" ? edge.node : null))
    .filter((node) => node && typeof node === "object" && typeof node.id === "string" && node.id.trim());

  const top = pickBestWhatnotLivestreamNode(nodes);

  return {
    liveId: top && typeof top.id === "string" ? top.id.trim() : null,
    title: top && typeof top.title === "string" ? top.title : null,
    startTime: top && top.startTime != null ? Number(top.startTime) : null,
    livestreams: nodes.map((n) => ({
      id: String(n.id || "").trim(),
      title: typeof n.title === "string" ? n.title : null,
      startTime: n.startTime != null ? Number(n.startTime) : null,
      pendingShippingShipmentsCount:
        n.pendingShippingShipmentsCount != null ? Number(n.pendingShippingShipmentsCount) : 0,
    })),
    reason: null,
  };
}

function pickBestWhatnotLivestreamNode(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) {
    return null;
  }

  const withPending = nodes.filter((node) => {
    const count = node && node.pendingShippingShipmentsCount != null
      ? Number(node.pendingShippingShipmentsCount)
      : 0;
    return Number.isFinite(count) && count > 0;
  });

  const pool = withPending.length ? withPending : nodes;
  const sorted = [...pool].sort((a, b) => {
    const ta = typeof a.startTime === "number" ? a.startTime : Number(a.startTime) || 0;
    const tb = typeof b.startTime === "number" ? b.startTime : Number(b.startTime) || 0;
    return tb - ta;
  });

  return sorted[0] || null;
}

async function tryResolveShipmentIdsFromExtensionProactive({ clerkUserId, liveId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  const normalizedLiveId = typeof liveId === "string" ? liveId.trim() : "";
  if (!normalizedClerkUserId) {
    return [];
  }

  try {
    const actionResult = await requestWhatnotAction({
      action: "fetch_whatnot_shipment_ids_for_live",
      clerkUserId: normalizedClerkUserId,
      liveId: normalizedLiveId || null,
    });
    const rawIds =
      actionResult &&
      actionResult.success &&
      actionResult.data &&
      Array.isArray(actionResult.data.shipmentIds)
        ? actionResult.data.shipmentIds
        : [];
    return dedupeShipmentIdsPreserveOrder(
      rawIds.map((id) => normalizeShipmentGraphqlId(String(id || "").trim())).filter(Boolean),
    );
  } catch (_e) {
    return [];
  }
}

async function tryResolveShipmentIdsAcrossPendingLivestreams({ clerkUserId, primaryLiveId = null }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    return [];
  }

  try {
    const livestreamsResult = await fetchWhatnotCurrentLiveIdFromExtension({
      clerkUserId: normalizedClerkUserId,
    });
    const candidates = Array.isArray(livestreamsResult?.livestreams)
      ? livestreamsResult.livestreams
      : [];
    const pendingFirst = candidates.filter((row) => Number(row?.pendingShippingShipmentsCount) > 0);
    const pool = pendingFirst.length ? pendingFirst : candidates;
    const orderedLiveIds = [];
    const seen = new Set();
    const pushId = (value) => {
      const id = typeof value === "string" ? value.trim() : "";
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      orderedLiveIds.push(id);
    };

    pushId(primaryLiveId);
    for (const row of pool) {
      pushId(row?.id);
    }

    const merged = [];
    for (const liveId of orderedLiveIds.slice(0, 5)) {
      const chunk = await tryResolveShipmentIdsFromExtensionProactive({
        clerkUserId: normalizedClerkUserId,
        liveId,
      });
      if (chunk.length) {
        merged.push(...chunk);
      }
      if (merged.length >= 30) {
        break;
      }
    }

    return dedupeShipmentIdsPreserveOrder(merged).slice(0, 30);
  } catch (_e) {
    return [];
  }
}

async function upsertWhatnotLiveStatsSnapshot({
  clerkUserId,
  liveId,
  statistic,
  rawPayload,
  extensionTabId = null,
  source = "whatnot-extension",
}) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  const normalizedLiveId = typeof liveId === "string" ? liveId.trim() : "";
  if (!normalizedClerkUserId || !normalizedLiveId) {
    return;
  }

  const now = new Date();
  await WhatnotLiveStatsSnapshot.findOneAndUpdate(
    {
      platform: "whatnot",
      clerk_user_id: normalizedClerkUserId,
      live_id: normalizedLiveId,
    },
    {
      $set: {
        source,
        statistic_payload: statistic && typeof statistic === "object" ? statistic : {},
        raw_payload: rawPayload && typeof rawPayload === "object" ? rawPayload : {},
        extension_tab_id: Number.isFinite(Number(extensionTabId)) ? Number(extensionTabId) : null,
        synced_at: now,
        updated_at: now,
      },
      $setOnInsert: {
        created_at: now,
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
}

async function getCachedMyLiveStatsSnapshot({ clerkUserId, liveId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  const normalizedLiveId = typeof liveId === "string" ? liveId.trim() : "";
  if (!normalizedClerkUserId || !normalizedLiveId) {
    return null;
  }

  const ownerClerkUserId = await resolveWhatnotSnapshotOwnerClerkUserId(normalizedClerkUserId);
  const doc = await WhatnotLiveStatsSnapshot.findOne({
    platform: "whatnot",
    clerk_user_id: ownerClerkUserId,
    live_id: normalizedLiveId,
  }).sort({ synced_at: -1, updated_at: -1 });

  if (!doc || !doc.statistic_payload || typeof doc.statistic_payload !== "object") {
    return null;
  }

  return {
    liveId: normalizedLiveId,
    statistic: doc.statistic_payload,
    raw: doc.raw_payload && typeof doc.raw_payload === "object" ? doc.raw_payload : {},
    fromCache: true,
    syncedAt: doc.synced_at || doc.updated_at || null,
  };
}

async function fetchMyLiveStatsFromExtension({ clerkUserId, liveId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  const normalizedLiveId = typeof liveId === "string" ? liveId.trim() : "";
  if (!normalizedLiveId) {
    throw createHttpError(400, "liveId is required.");
  }

  await findLocalUser(normalizedClerkUserId);

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    const cachedOffline = await getCachedMyLiveStatsSnapshot({
      clerkUserId: normalizedClerkUserId,
      liveId: normalizedLiveId,
    });
    if (cachedOffline) {
      return cachedOffline;
    }
    throw createHttpError(503, "Whatnot extension is offline. Open the extension and connect Whatnot.");
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    const cachedMismatch = await getCachedMyLiveStatsSnapshot({
      clerkUserId: normalizedClerkUserId,
      liveId: normalizedLiveId,
    });
    if (cachedMismatch) {
      return cachedMismatch;
    }
    throw createHttpError(
      403,
      "Extension is not connected for this seller. Sign in on the extension with the same account.",
    );
  }

  let actionResult = null;
  try {
    actionResult = await requestWhatnotAction({
      action: "fetch_my_live_stats",
      clerkUserId: normalizedClerkUserId,
      liveId: normalizedLiveId,
    });
  } catch (error) {
    const cached = await getCachedMyLiveStatsSnapshot({
      clerkUserId: normalizedClerkUserId,
      liveId: normalizedLiveId,
    });
    if (cached) {
      return cached;
    }
    throw error;
  }

  if (!actionResult || !actionResult.success) {
    const cached = await getCachedMyLiveStatsSnapshot({
      clerkUserId: normalizedClerkUserId,
      liveId: normalizedLiveId,
    });
    if (cached) {
      return cached;
    }
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      (actionResult && actionResult.error) || "Failed to fetch MyLiveStats through extension.",
      actionResult || null,
    );
  }

  const body = actionResult.data && typeof actionResult.data === "object" ? actionResult.data : {};
  if (Array.isArray(body.errors) && body.errors.length) {
    const firstError = body.errors[0] && body.errors[0].message
      ? String(body.errors[0].message)
      : "Whatnot MyLiveStats GraphQL returned errors.";
    throw createHttpError(502, firstError, body);
  }

  const statistic = body.data && body.data.myLiveStatistic ? body.data.myLiveStatistic : null;

  await upsertWhatnotLiveStatsSnapshot({
    clerkUserId: normalizedClerkUserId,
    liveId: normalizedLiveId,
    statistic,
    rawPayload: body,
    extensionTabId: authPayload && authPayload.tabId != null ? authPayload.tabId : null,
  });

  return {
    liveId: normalizedLiveId,
    statistic,
    raw: body,
  };
}

function mapLiveShow(live, showType) {
  return {
    id: live && live.id ? String(live.id) : null,
    title: live && live.title ? String(live.title).trim() : null,
    startTime: live && live.startTime != null ? Number(live.startTime) : null,
    endTime: live && live.endTime != null ? Number(live.endTime) : null,
    status: live && live.status ? String(live.status) : null,
    userId: live && live.userId ? String(live.userId) : null,
    showType,
    link: live && live.id ? `https://www.whatnot.com/live/${live.id}` : null,
  };
}

function buildShowsFromMyLivesPayload(myLivesPayload) {
  const myLivesData = myLivesPayload && myLivesPayload.data && typeof myLivesPayload.data === "object"
    ? myLivesPayload.data
    : null;

  const currentLivesRaw = myLivesData && Array.isArray(myLivesData.currentLives) ? myLivesData.currentLives : [];
  const upcomingLivesRaw = myLivesData && Array.isArray(myLivesData.upcomingLives) ? myLivesData.upcomingLives : [];
  const pastLivesRaw = myLivesData && Array.isArray(myLivesData.pastLives) ? myLivesData.pastLives : [];

  const shows = [
    ...currentLivesRaw.map((l) => mapLiveShow(l, "Live")),
    ...upcomingLivesRaw.map((l) => mapLiveShow(l, "Upcoming")),
    ...pastLivesRaw.map((l) => mapLiveShow(l, "Past")),
  ];

  return {
    shows,
    currentCount: currentLivesRaw.length,
    upcomingCount: upcomingLivesRaw.length,
    pastCount: pastLivesRaw.length,
  };
}

function mapDashboardUpcomingNodeToShow(node) {
  if (!node || typeof node !== "object") {
    return null;
  }
  const scheduledAt = node.scheduledAt || node.startTime || null;
  const startTimeMs = scheduledAt != null ? Number(new Date(scheduledAt).getTime()) : null;
  const id = node.id ? String(node.id) : node.uuid ? String(node.uuid) : null;
  return {
    id,
    title: node.title ? String(node.title).trim() : null,
    startTime: Number.isFinite(startTimeMs) ? startTimeMs : null,
    endTime: null,
    status: node.status ? String(node.status) : "CREATED",
    userId: node.user && node.user.id ? String(node.user.id) : null,
    showType: "Upcoming",
    link: id ? `https://www.whatnot.com/live/${id}` : null,
  };
}

function mergeShowsFromDashboardUpcoming(shows, dashboardPayload) {
  const edges = dashboardPayload &&
    dashboardPayload.data &&
    dashboardPayload.data.upcomingShows &&
    Array.isArray(dashboardPayload.data.upcomingShows.edges)
    ? dashboardPayload.data.upcomingShows.edges
    : [];

  if (!edges.length) {
    return shows;
  }

  const seen = new Set(
    (Array.isArray(shows) ? shows : [])
      .map((show) => (show && show.id ? String(show.id) : ""))
      .filter(Boolean),
  );

  const merged = Array.isArray(shows) ? [...shows] : [];
  for (const edge of edges) {
    const mapped = mapDashboardUpcomingNodeToShow(edge && typeof edge === "object" ? edge.node : null);
    if (!mapped || !mapped.id || seen.has(mapped.id)) {
      continue;
    }
    seen.add(mapped.id);
    merged.push(mapped);
  }

  return merged;
}

async function fetchMyLivesThroughExtension({ clerkUserId, sellerId }) {
  const normalizedSellerId = typeof sellerId === "string" ? sellerId.trim() : "";
  if (!normalizedSellerId) {
    return { payload: {}, shows: [], currentCount: 0, upcomingCount: 0, pastCount: 0 };
  }

  const myLivesAction = await requestWhatnotAction({
    action: "fetch_whatnot_my_lives",
    clerkUserId,
    sellerId: normalizedSellerId,
  }, 300000);

  if (!myLivesAction || !myLivesAction.success) {
    throw createHttpError(
      (myLivesAction && myLivesAction.status) || 502,
      (myLivesAction && myLivesAction.error) || "Failed to fetch MyLives through extension.",
      myLivesAction || null,
    );
  }

  const myLivesPayload = myLivesAction.data && typeof myLivesAction.data === "object" ? myLivesAction.data : {};
  const myLivesErrors = Array.isArray(myLivesPayload.errors) ? myLivesPayload.errors : [];
  if (myLivesErrors.length) {
    const firstError = myLivesErrors[0] && myLivesErrors[0].message
      ? String(myLivesErrors[0].message)
      : "MyLives GraphQL returned errors.";
    throw createHttpError(502, firstError, myLivesPayload);
  }

  return {
    payload: myLivesPayload,
    ...buildShowsFromMyLivesPayload(myLivesPayload),
  };
}

function whatnotShowSnapshotHasStoredShows(snapshot) {
  return Boolean(
    snapshot &&
    Array.isArray(snapshot.shows_payload) &&
    snapshot.shows_payload.length > 0,
  );
}

function getGraphqlErrorMessage(payload) {
  const errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
  if (!errors.length) {
    return null;
  }
  return errors[0] && errors[0].message
    ? String(errors[0].message)
    : "GraphQL returned errors.";
}

function isNonFatalWhatnotShowTabGraphqlError(message) {
  if (!message) {
    return false;
  }
  const lower = message.toLowerCase();
  return (
    lower.includes("viewer unauthorized") ||
    lower.includes("unauthorized") ||
    lower.includes("unauthenticated") ||
    lower.includes("forbidden")
  );
}

async function saveWhatnotShowSnapshot({
  clerkUserId,
  whatnotSellerId,
  myLivesPayload,
  shows,
  source = "whatnot-extension",
}) {
  const now = new Date();
  const showsPayload = Array.isArray(shows) ? shows : [];
  try {
    await WhatnotShowSnapshot.findOneAndUpdate(
      {
        platform: "whatnot",
        clerk_user_id: clerkUserId,
      },
      {
        $set: {
          whatnot_seller_id: whatnotSellerId || null,
          source,
          my_lives_payload: myLivesPayload && typeof myLivesPayload === "object" ? myLivesPayload : {},
          shows_payload: showsPayload,
          synced_at: now,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      {
        upsert: true,
        new: false,
        setDefaultsOnInsert: true,
      },
    );
    console.log(
      `[Whatnot Show Tab] Snapshot saved for ${clerkUserId}: ${showsPayload.length} show(s).`,
    );
  } catch (saveErr) {
    console.error("[Whatnot Show Tab] Failed to save snapshot:", saveErr.message);
    throw createHttpError(500, "Failed to save Whatnot show snapshot.", { cause: saveErr.message });
  }
}

async function fetchWhatnotShowTabDataFromExtension({ clerkUserId, upcomingShowsCount = 0, forceRefresh = false }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  const user = await findLocalUser(normalizedClerkUserId);

  const cachedSnapshot = await WhatnotShowSnapshot.findOne({
    platform: "whatnot",
    clerk_user_id: normalizedClerkUserId,
  }).sort({ updated_at: -1 });

  const hasStoredSnapshot = whatnotShowSnapshotHasStoredShows(cachedSnapshot);

  if (!forceRefresh && hasStoredSnapshot) {
    return {
      sellerId: cachedSnapshot.whatnot_seller_id || user.whatnot_seller_id || null,
      upcomingShowUserId: null,
      upcomingShows: [],
      shows: cachedSnapshot.shows_payload,
      liveReadiness: null,
      sellerHomeDashboard: null,
    };
  }

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    throw createHttpError(503, "Whatnot extension is offline. Open the extension and connect Whatnot.");
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    throw createHttpError(
      403,
      "Extension is not connected for this seller. Sign in on the extension with the same account.",
    );
  }

  const existingSellerId = user && typeof user.whatnot_seller_id === "string" ? user.whatnot_seller_id.trim() : "";

  // MyLives-only path when seller id is known (avoids GetSellerHomeDashboard "Viewer unauthorized").
  if (existingSellerId) {
    const myLivesLabel = hasStoredSnapshot ? "refresh" : "seed";
    console.log(`[Whatnot Show Tab] Loading shows via MyLives (${myLivesLabel}).`);
    const myLivesResult = await fetchMyLivesThroughExtension({
      clerkUserId: normalizedClerkUserId,
      sellerId: existingSellerId,
    });
    console.log(
      `[Whatnot Show Tab] MyLives (${myLivesLabel}): ${myLivesResult.currentCount} live, ${myLivesResult.upcomingCount} upcoming, ${myLivesResult.pastCount} past.`,
    );

    await saveWhatnotShowSnapshot({
      clerkUserId: normalizedClerkUserId,
      whatnotSellerId: existingSellerId,
      myLivesPayload: myLivesResult.payload,
      shows: myLivesResult.shows,
    });

    return {
      sellerId: existingSellerId,
      upcomingShowUserId: null,
      upcomingShows: [],
      shows: myLivesResult.shows,
      liveReadiness: null,
      sellerHomeDashboard: null,
    };
  }

  console.log("[Whatnot Show Tab] No seller id yet — running full show-tab bootstrap.");

  console.log("[Whatnot Show Tab] Waiting for extension response...");

  const actionResult = await requestWhatnotAction({
    action: "fetch_whatnot_show_tab",
    clerkUserId: normalizedClerkUserId,
    upcomingShowsCount: Number.isFinite(Number(upcomingShowsCount)) ? Number(upcomingShowsCount) : 0,
  }, 300000);

  console.log("[Whatnot Show Tab] Extension response received.");

  if (!actionResult || !actionResult.success) {
    const extensionError = actionResult && actionResult.error
      ? String(actionResult.error)
      : "Failed to fetch Whatnot show tab data through extension.";
    console.error(`[Whatnot Show Tab] Extension action failed: ${extensionError}`);
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      extensionError,
      actionResult || null,
    );
  }

  const body = actionResult.data && typeof actionResult.data === "object" ? actionResult.data : {};
  const readinessPayload = body.liveReadiness && typeof body.liveReadiness === "object"
    ? body.liveReadiness
    : null;
  const dashboardPayload = body.sellerHomeDashboard && typeof body.sellerHomeDashboard === "object"
    ? body.sellerHomeDashboard
    : null;

  const readinessErrorMessage = getGraphqlErrorMessage(readinessPayload);
  if (readinessErrorMessage && !isNonFatalWhatnotShowTabGraphqlError(readinessErrorMessage)) {
    throw createHttpError(502, readinessErrorMessage, readinessPayload);
  }
  if (readinessErrorMessage) {
    console.warn(`[Whatnot Show Tab] Readiness warning (non-fatal): ${readinessErrorMessage}`);
  }

  const dashboardErrorMessage = getGraphqlErrorMessage(dashboardPayload);
  if (dashboardErrorMessage && !isNonFatalWhatnotShowTabGraphqlError(dashboardErrorMessage)) {
    throw createHttpError(502, dashboardErrorMessage, dashboardPayload);
  }
  if (dashboardErrorMessage) {
    console.warn(`[Whatnot Show Tab] Dashboard warning (non-fatal): ${dashboardErrorMessage}`);
  }

  const sellerIdFromDashboardPath =
    dashboardPayload &&
    dashboardPayload.data &&
    dashboardPayload.data.upcomingShows &&
    Array.isArray(dashboardPayload.data.upcomingShows.edges) &&
    dashboardPayload.data.upcomingShows.edges[0] &&
    dashboardPayload.data.upcomingShows.edges[0].node &&
    dashboardPayload.data.upcomingShows.edges[0].node.user &&
    dashboardPayload.data.upcomingShows.edges[0].node.user.id
      ? String(dashboardPayload.data.upcomingShows.edges[0].node.user.id).trim()
      : "";

  const sellerId =
    sellerIdFromDashboardPath ||
    (typeof body.sellerId === "string" && body.sellerId.trim()
      ? body.sellerId.trim()
      : readinessPayload &&
          readinessPayload.data &&
          readinessPayload.data.me &&
          readinessPayload.data.me.id
        ? String(readinessPayload.data.me.id).trim()
        : "");

  if (sellerId) {
    console.log(`Seller ID fetched successfully: ${sellerId}`);
    try {
      await User.findOneAndUpdate(
        { clerk_user_id: normalizedClerkUserId },
        { whatnot_seller_id: sellerId, updated_at: new Date() },
        { new: false },
      );
      console.log(`[Whatnot Show Tab] whatnot_seller_id saved to user: ${sellerId}`);
    } catch (saveErr) {
      console.error("[Whatnot Show Tab] Failed to save whatnot_seller_id:", saveErr.message);
    }
  } else {
    console.log("Seller ID fetched successfully: <missing>");
  }

  const upcomingShowUserId =
    typeof body.upcomingShowUserId === "string" && body.upcomingShowUserId.trim()
      ? body.upcomingShowUserId.trim()
      : dashboardPayload &&
          dashboardPayload.data &&
          dashboardPayload.data.upcomingShows &&
          Array.isArray(dashboardPayload.data.upcomingShows.edges) &&
          dashboardPayload.data.upcomingShows.edges[0] &&
          dashboardPayload.data.upcomingShows.edges[0].node &&
          dashboardPayload.data.upcomingShows.edges[0].node.user &&
          dashboardPayload.data.upcomingShows.edges[0].node.user.id
        ? String(dashboardPayload.data.upcomingShows.edges[0].node.user.id).trim()
        : "";

  if (upcomingShowUserId) {
    console.log(`Upcoming show user ID: ${upcomingShowUserId}`);
  } else {
    console.log("Upcoming show user ID: <missing>");
  }

  const resolvedSellerId = sellerId || existingSellerId || null;
  let myLivesPayload = body.myLives && typeof body.myLives === "object" ? body.myLives : {};
  let { shows, currentCount, upcomingCount, pastCount } = buildShowsFromMyLivesPayload(myLivesPayload);

  if (!shows.length && resolvedSellerId) {
    console.log("[Whatnot Show Tab] Bootstrap missing MyLives data — retrying MyLives fetch.");
    const myLivesResult = await fetchMyLivesThroughExtension({
      clerkUserId: normalizedClerkUserId,
      sellerId: resolvedSellerId,
    });
    myLivesPayload = myLivesResult.payload;
    shows = myLivesResult.shows;
    currentCount = myLivesResult.currentCount;
    upcomingCount = myLivesResult.upcomingCount;
    pastCount = myLivesResult.pastCount;
  }

  shows = mergeShowsFromDashboardUpcoming(shows, dashboardPayload);
  console.log(`[Whatnot Show Tab] MyLives: ${currentCount} live, ${upcomingCount} upcoming, ${pastCount} past.`);

  const edges = dashboardPayload &&
    dashboardPayload.data &&
    dashboardPayload.data.upcomingShows &&
    Array.isArray(dashboardPayload.data.upcomingShows.edges)
    ? dashboardPayload.data.upcomingShows.edges
    : [];

  const upcomingShows = edges
    .map((edge) => (edge && typeof edge === "object" ? edge.node : null))
    .filter((node) => node && typeof node === "object")
    .map((node) => ({
      id: node.id ? String(node.id) : null,
      uuid: node.uuid ? String(node.uuid) : null,
      title: node.title ? String(node.title) : null,
      scheduledAt: node.scheduledAt || node.startTime || null,
      userId: node.user && node.user.id ? String(node.user.id) : null,
      raw: node,
    }));

  await saveWhatnotShowSnapshot({
    clerkUserId: normalizedClerkUserId,
    whatnotSellerId: resolvedSellerId,
    myLivesPayload,
    shows,
  });

  return {
    sellerId: resolvedSellerId,
    upcomingShowUserId: upcomingShowUserId || null,
    upcomingShows,
    shows,
    liveReadiness: readinessPayload,
    sellerHomeDashboard: dashboardPayload,
  };
}

async function fetchWhatnotPrimaryShowFormatTagsFromExtension({ clerkUserId, categoryId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }
  await findLocalUser(normalizedClerkUserId);

  const normalizedCategoryId = typeof categoryId === "string" ? categoryId.trim() : "";
  if (!normalizedCategoryId) {
    throw createHttpError(400, "categoryId is required.");
  }

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    throw createHttpError(503, "Whatnot extension is offline. Open the extension and connect Whatnot.");
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    throw createHttpError(
      403,
      "Extension is not connected for this seller. Sign in on the extension with the same account.",
    );
  }

  const actionResult = await requestWhatnotAction({
    action: "fetch_primary_show_format_tags",
    clerkUserId: normalizedClerkUserId,
    categoryId: normalizedCategoryId,
  }, 120000);

  if (!actionResult || !actionResult.success) {
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      (actionResult && actionResult.error) || "Failed to fetch primary show format tags through extension.",
      actionResult || null,
    );
  }

  const body = actionResult.data && typeof actionResult.data === "object" ? actionResult.data : {};
  const gqlErrors = Array.isArray(body.errors) ? body.errors : [];
  if (gqlErrors.length) {
    const firstError = gqlErrors[0] && gqlErrors[0].message
      ? String(gqlErrors[0].message)
      : "GetPrimaryShowFormatTags GraphQL returned errors.";
    throw createHttpError(502, firstError, body);
  }

  const tags = body &&
    body.data &&
    Array.isArray(body.data.primaryShowFormatTags)
    ? body.data.primaryShowFormatTags
    : [];

  return {
    categoryId: normalizedCategoryId,
    primaryShowFormatTags: tags.map((tag) => ({
      id: tag && tag.id ? String(tag.id) : null,
      name: tag && tag.name ? String(tag.name) : null,
      label: tag && tag.label ? String(tag.label) : null,
      description: tag && tag.description ? String(tag.description) : null,
      canScheduleLive: Boolean(tag && tag.canScheduleLive),
      applicationLink: tag && tag.applicationLink ? String(tag.applicationLink) : null,
      raw: tag && typeof tag === "object" ? tag : {},
    })),
    response: body,
  };
}

async function scheduleWhatnotShowFromPlatform({ clerkUserId, schedulePayload = {} }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }
  await findLocalUser(normalizedClerkUserId);

  const payload = schedulePayload && typeof schedulePayload === "object" ? schedulePayload : {};
  const categoryId = typeof payload.categoryId === "string" ? payload.categoryId.trim() : "";
  const showName = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!showName || !categoryId) {
    throw createHttpError(400, "name and categoryId are required.");
  }

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    throw createHttpError(503, "Whatnot extension is offline. Open the extension and connect Whatnot.");
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    throw createHttpError(
      403,
      "Extension is not connected for this seller. Sign in on the extension with the same account.",
    );
  }

  const showDate = typeof payload.showDate === "string" ? payload.showDate.trim() : "";
  const showTime = typeof payload.showTime === "string" ? payload.showTime.trim() : "";
  const parsedDate = showDate && showTime ? new Date(`${showDate}T${showTime}`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    throw createHttpError(400, "showDate and showTime are required in valid format.");
  }

  const startTime = parsedDate.getTime();
  const formatTagName = typeof payload.primarySellingFormatName === "string"
    ? payload.primarySellingFormatName.trim()
    : "";
  const selectedCategoryId = typeof payload.categoryId === "string" ? payload.categoryId.trim() : "";
  const languageMap = {
    english: "en",
    netherlands: "nl",
    francais: "fr",
    deutsch: "de",
    chienese: "zh",
  };
  const selectedLanguage = typeof payload.primaryLanguage === "string"
    ? payload.primaryLanguage.trim().toLowerCase()
    : "";
  const language = languageMap[selectedLanguage] || "en";
  const isHiddenBySeller = String(payload.discovery || "public").trim().toLowerCase() === "private";

  const variables = {
    categories: [selectedCategoryId],
    description: typeof payload.description === "string" ? payload.description : "",
    explicitContent: false,
    language,
    livestreamAdsSettings: {
      enabled: false,
      budget: null,
    },
    livestreamShippingSettingUpdates: {
      optionBooleanUpdates: [
        {
          isEnabled: false,
          shippingSettingId: "first_class_mail_letters_enabled",
        },
      ],
      optionRadioInputUpdates: [
        {
          optionId: "usps_priority_mail",
          shippingSettingId: "us_domestic_shipments_1_to_5_lbs",
        },
        {
          optionId: "usps_ground_advantage",
          shippingSettingId: "us_domestic_shipments_over_5_lbs",
        },
        {
          optionId: "buyer_pays_all",
          shippingSettingId: "us_domestic_shipping_costs",
        },
      ],
      optionRadioPriceInputUpdates: [],
    },
    minEligibleLoyaltyTier: null,
    mutedWords: [],
    nominatedModerators: [],
    startTime,
    tags: formatTagName ? [formatTagName] : [],
    title: showName,
    isUnifiedShopEnabled: true,
    isHiddenBySeller,
    seonSession: "",
  };

  const actionResult = await requestWhatnotAction({
    action: "schedule_whatnot_show",
    clerkUserId: normalizedClerkUserId,
    variables,
  }, 180000);

  if (!actionResult || !actionResult.success) {
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      (actionResult && actionResult.error) || "Failed to schedule Whatnot show through extension.",
      actionResult || null,
    );
  }

  const body = actionResult.data && typeof actionResult.data === "object" ? actionResult.data : {};
  const gqlErrors = Array.isArray(body.errors) ? body.errors : [];
  if (gqlErrors.length) {
    const firstError = gqlErrors[0] && gqlErrors[0].message
      ? String(gqlErrors[0].message)
      : "ScheduleLiveStream GraphQL returned errors.";
    throw createHttpError(502, firstError, body);
  }

  const scheduledLiveId =
    body &&
    body.data &&
    body.data.addLiveStream &&
    body.data.addLiveStream.id
      ? String(body.data.addLiveStream.id)
      : null;

  return {
    success: true,
    accepted: true,
    scheduledLiveId,
    startTime,
    isHiddenBySeller,
    schedulePayload: payload,
    response: body,
    message: "Whatnot show scheduled via extension.",
  };
}

async function cancelWhatnotShowFromPlatform({ clerkUserId, liveId = "" }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  const normalizedLiveId = typeof liveId === "string" ? liveId.trim() : "";
  if (!normalizedLiveId) {
    throw createHttpError(400, "liveId is required.");
  }

  await findLocalUser(normalizedClerkUserId);

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    throw createHttpError(503, "Whatnot extension is offline. Open the extension and connect Whatnot.");
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    throw createHttpError(
      403,
      "Extension is not connected for this seller. Sign in on the extension with the same account.",
    );
  }

  const actionResult = await requestWhatnotAction({
    action: "cancel_whatnot_show",
    clerkUserId: normalizedClerkUserId,
    liveId: normalizedLiveId,
  });

  if (!actionResult || !actionResult.success) {
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      (actionResult && actionResult.error) || "Failed to cancel Whatnot show through extension.",
      actionResult || null,
    );
  }

  const body = actionResult.data && typeof actionResult.data === "object" ? actionResult.data : {};
  const gqlErrors = Array.isArray(body.errors) ? body.errors : [];
  if (gqlErrors.length) {
    const firstError = gqlErrors[0] && gqlErrors[0].message
      ? String(gqlErrors[0].message)
      : "CancelLive GraphQL returned errors.";
    throw createHttpError(502, firstError, body);
  }

  const cancelledLive = body?.data?.updateLiveStream;
  const cancelledLiveId = cancelledLive && cancelledLive.id ? String(cancelledLive.id).trim() : "";
  if (!cancelledLiveId) {
    throw createHttpError(502, "CancelLive did not return a cancelled show id.", body);
  }

  const snapshot = await WhatnotShowSnapshot.findOne({
    platform: "whatnot",
    clerk_user_id: normalizedClerkUserId,
  }).sort({ updated_at: -1 });

  if (snapshot && Array.isArray(snapshot.shows_payload)) {
    const filteredShows = snapshot.shows_payload.filter(
      (show) => String(show?.id || "").trim() !== normalizedLiveId,
    );
    await WhatnotShowSnapshot.findOneAndUpdate(
      {
        platform: "whatnot",
        clerk_user_id: normalizedClerkUserId,
      },
      {
        $set: {
          shows_payload: filteredShows,
          updated_at: new Date(),
        },
      },
    );
  }

  return {
    success: true,
    liveId: normalizedLiveId,
    cancelledLiveId,
    status: cancelledLive?.status || "CANCELLED",
    response: body,
    message: "Whatnot show cancelled via extension.",
  };
}

async function syncWhatnotReferenceCacheFromExtension({ clerkUserId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  await findLocalUser(normalizedClerkUserId);

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    throw createHttpError(503, "Whatnot extension is offline. Open the extension and connect Whatnot.");
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    throw createHttpError(
      403,
      "Extension is not connected for this seller. Sign in on the extension with the same account.",
    );
  }

  const actionResult = await requestWhatnotAction({
    action: "sync_whatnot_reference_cache",
    clerkUserId: normalizedClerkUserId,
  }, 300000);

  if (!actionResult || !actionResult.success) {
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      (actionResult && actionResult.error) || "Failed to sync Whatnot reference cache through extension.",
      actionResult || null,
    );
  }

  const cacheStatus = await getWhatnotReferenceCacheStatus();

  return {
    success: true,
    synced: true,
    steps: actionResult.steps || null,
    errors: Array.isArray(actionResult.errors) ? actionResult.errors : [],
    cacheStatus,
  };
}

/** Whatnot Relay ids sometimes confuse `l` vs `1` when copied (ShipmentNode segment). */
function normalizeShipmentGraphqlId(id) {
  const s = typeof id === "string" ? id.trim() : "";
  if (!s) {
    return s;
  }
  return s.replace(/Ob2R1/g, "Ob2Rl");
}

/** Same shipment often appears as digits and as Relay global id — one key per shipment for dedupe. */
function shipmentIdDedupeKey(id) {
  const s = normalizeShipmentGraphqlId(typeof id === "string" ? id.trim() : String(id || "").trim());
  if (!s) {
    return "";
  }
  if (/^\d+$/.test(s)) {
    return s;
  }
  try {
    const decoded = Buffer.from(s, "base64").toString("utf8");
    const m = decoded.match(/ShipmentNode:(\d+)/i);
    if (m && m[1]) {
      return m[1];
    }
  } catch (_e) {
    /* not valid base64 */
  }
  return s;
}

function dedupeShipmentIdsPreserveOrder(ids) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = normalizeShipmentGraphqlId(String(raw || "").trim());
    if (!id) {
      continue;
    }
    const key = shipmentIdDedupeKey(id);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(id);
  }
  return out;
}

async function upsertWhatnotShipmentDetails({
  clerkUserId,
  rows,
  source = "whatnot-extension",
}) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId || !Array.isArray(rows) || !rows.length) {
    return;
  }

  const now = new Date();
  for (const row of rows) {
    const shipment = row && typeof row === "object" ? row.shipment : null;
    if (!shipment || typeof shipment !== "object") {
      continue;
    }
    const inputId = row && typeof row.shipmentId === "string" ? row.shipmentId.trim() : "";
    const globalId = typeof shipment.id === "string" ? shipment.id.trim() : "";
    const key = shipmentIdDedupeKey(globalId || inputId);
    if (!key) {
      continue;
    }
    await WhatnotShipmentDetail.findOneAndUpdate(
      {
        platform: "whatnot",
        clerk_user_id: normalizedClerkUserId,
        shipment_key: key,
      },
      {
        $set: {
          source,
          shipment_id_input: inputId || null,
          shipment_global_id: globalId || null,
          shipment_payload: shipment,
          synced_at: now,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
  }
}

function extractShipmentIdsFromManifestUrls(urls) {
  const out = new Set();
  if (!Array.isArray(urls)) {
    return [];
  }
  for (let raw of urls) {
    if (raw == null) {
      continue;
    }
    let str = "";
    if (typeof raw === "string") {
      str = raw.trim();
    } else if (typeof raw === "object") {
      try {
        str = JSON.stringify(raw);
      } catch (_e) {
        str = "";
      }
    }
    if (!str) {
      continue;
    }
    let decoded = str;
    try {
      decoded = decodeURIComponent(str);
    } catch (_e) {
      /* keep original */
    }
    const haystack = `${decoded} ${str}`;
    const rePath = /\/shipments\/(\d+)/gi;
    let m = rePath.exec(haystack);
    while (m) {
      out.add(m[1]);
      m = rePath.exec(haystack);
    }
    const reS3 = /shipments\/(\d+)(?:-|\.|"|'|,|\s|&|$)/gi;
    m = reS3.exec(haystack);
    while (m) {
      out.add(m[1]);
      m = reS3.exec(haystack);
    }
    const reGlobal = /(U2hpcG1lbnROb2R[A-Za-z0-9+/=]+)/g;
    m = reGlobal.exec(haystack);
    while (m) {
      out.add(normalizeShipmentGraphqlId(m[1]));
      m = reGlobal.exec(haystack);
    }
  }
  return [...out];
}

async function tryResolveShipmentIdsFromMyLiveStatsForLive({ clerkUserId, liveId }) {
  const normalizedLive = typeof liveId === "string" ? liveId.trim() : "";
  if (!normalizedLive) {
    return [];
  }
  try {
    const stats = await fetchMyLiveStatsFromExtension({ clerkUserId, liveId: normalizedLive });
    const urls =
      stats &&
      stats.statistic &&
      Array.isArray(stats.statistic.manifestUrls)
        ? stats.statistic.manifestUrls
        : [];
    const blobs = [
      ...urls,
      stats && stats.raw && typeof stats.raw === "object" ? stats.raw : null,
      stats && stats.statistic && typeof stats.statistic === "object" ? stats.statistic : null,
    ].filter(Boolean);
    const fromStrings = extractShipmentIdsFromManifestUrls(blobs);
    const deepSeen = new Set(fromStrings.map((id) => normalizeShipmentGraphqlId(String(id || "").trim())).filter(Boolean));
    for (const blob of blobs) {
      if (blob && typeof blob === "object") {
        collectShipmentIdsDeep(blob, deepSeen);
      }
    }
    return [...deepSeen];
  } catch (_e) {
    return [];
  }
}

function liveIdsEqual(a, b) {
  const x = typeof a === "string" ? a.trim() : a != null ? String(a).trim() : "";
  const y = typeof b === "string" ? b.trim() : b != null ? String(b).trim() : "";
  return Boolean(x && y && x === y);
}

function rawTreeContainsLiveId(obj, liveId) {
  if (!liveId || obj == null || typeof obj !== "object") {
    return false;
  }
  const needle = typeof liveId === "string" ? liveId.trim() : String(liveId).trim();
  if (!needle) {
    return false;
  }
  const stack = [obj];
  const visited = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") {
      continue;
    }
    if (visited.has(cur)) {
      continue;
    }
    visited.add(cur);
    if (cur.livestream && typeof cur.livestream === "object") {
      if (liveIdsEqual(cur.livestream.id, needle)) {
        return true;
      }
      if (liveIdsEqual(cur.livestream.uuid, needle)) {
        return true;
      }
    }
    if (typeof cur.livestreamId === "string" && liveIdsEqual(cur.livestreamId, needle)) {
      return true;
    }
    if (typeof cur.liveId === "string" && liveIdsEqual(cur.liveId, needle)) {
      return true;
    }
    for (const v of Object.values(cur)) {
      if (v && typeof v === "object") {
        stack.push(v);
      } else if (typeof v === "string" && v === needle) {
        return true;
      }
    }
  }
  return false;
}

function collectShipmentIdsDeep(obj, seen) {
  if (!obj || typeof obj !== "object") {
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectShipmentIdsDeep(item, seen);
    }
    return;
  }
  if (typeof obj.shipmentId === "string" && obj.shipmentId.trim()) {
    seen.add(normalizeShipmentGraphqlId(obj.shipmentId.trim()));
  }
  if (obj.shipment && typeof obj.shipment === "object" && typeof obj.shipment.id === "string" && obj.shipment.id.trim()) {
    seen.add(normalizeShipmentGraphqlId(obj.shipment.id.trim()));
  }
  if (obj.__typename === "ShipmentNode" && typeof obj.id === "string" && obj.id.trim()) {
    seen.add(normalizeShipmentGraphqlId(obj.id.trim()));
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      collectShipmentIdsDeep(v, seen);
    }
  }
}

function collectShipmentIdsFromWhatnotOrders(orders, liveIdFilter) {
  const normalizedLive = typeof liveIdFilter === "string" ? liveIdFilter.trim() : "";
  const seen = new Set();

  for (const order of orders || []) {
    const raw = order.raw_payload || order.rawPayload;
    if (!raw || typeof raw !== "object") {
      continue;
    }
    if (normalizedLive && !rawTreeContainsLiveId(raw, normalizedLive)) {
      continue;
    }
    collectShipmentIdsDeep(raw, seen);
  }

  return [...seen];
}

async function fetchWhatnotShipmentsBatchFromExtension({ clerkUserId, shipmentIds = [] }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  const unique = [...new Set(
    (Array.isArray(shipmentIds) ? shipmentIds : []).map((id) => String(id || "").trim()).filter(Boolean),
  )].slice(0, 30);
  if (!unique.length) {
    throw createHttpError(400, "At least one shipmentId is required.");
  }

  await findLocalUser(normalizedClerkUserId);

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";

  if (!bridgeState || !bridgeState.isOnline) {
    throw createHttpError(503, "Whatnot extension is offline. Open the extension and connect Whatnot.");
  }

  if (!authClerkUserId || authClerkUserId !== normalizedClerkUserId) {
    throw createHttpError(
      403,
      "Extension is not connected for this seller. Sign in on the extension with the same account.",
    );
  }

  const actionResult = await requestWhatnotAction({
    action: "fetch_whatnot_shipments_batch",
    clerkUserId: normalizedClerkUserId,
    shipmentIds: unique,
  });

  if (!actionResult || !actionResult.success) {
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      (actionResult && actionResult.error) || "Failed to fetch shipments through extension.",
      actionResult || null,
    );
  }

  const body = actionResult.data && typeof actionResult.data === "object" ? actionResult.data : {};
  const batch = body.batchShipments && typeof body.batchShipments === "object" ? body.batchShipments : null;
  const rows = batch && Array.isArray(batch.rows) ? batch.rows : [];

  await upsertWhatnotShipmentDetails({
    clerkUserId: normalizedClerkUserId,
    rows,
  });

  return {
    rows,
    requestedIds: unique,
  };
}

async function mapCachedShipmentRows({ clerkUserId, shipmentIds = null, limit = 30 }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    return [];
  }

  if (Array.isArray(shipmentIds) && shipmentIds.length) {
    const dedupedIds = dedupeShipmentIdsPreserveOrder(shipmentIds).slice(0, 30);
    const keys = dedupedIds.map((id) => shipmentIdDedupeKey(id)).filter(Boolean);
    if (!keys.length) {
      return [];
    }

    const docs = await WhatnotShipmentDetail.find({
      platform: "whatnot",
      clerk_user_id: normalizedClerkUserId,
      shipment_key: { $in: keys },
    }).sort({ synced_at: -1, updated_at: -1 });

    if (!docs.length) {
      return [];
    }

    const byKey = new Map();
    for (const doc of docs) {
      const key = typeof doc.shipment_key === "string" ? doc.shipment_key.trim() : "";
      if (key && !byKey.has(key)) {
        byKey.set(key, doc);
      }
    }

    const rows = [];
    for (const id of dedupedIds) {
      const key = shipmentIdDedupeKey(id);
      const doc = key ? byKey.get(key) : null;
      if (!doc || !doc.shipment_payload || typeof doc.shipment_payload !== "object") {
        continue;
      }
      rows.push({
        shipmentId: doc.shipment_id_input || doc.shipment_global_id || key,
        shipment: doc.shipment_payload,
        error: null,
      });
    }

    return rows;
  }

  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(100, Math.max(1, Number(limit))) : 30;
  const docs = await WhatnotShipmentDetail.find({
    platform: "whatnot",
    clerk_user_id: normalizedClerkUserId,
  })
    .sort({ synced_at: -1, updated_at: -1 })
    .limit(safeLimit);

  return docs
    .filter((doc) => doc && doc.shipment_payload && typeof doc.shipment_payload === "object")
    .map((doc) => ({
      shipmentId: doc.shipment_id_input || doc.shipment_global_id || doc.shipment_key,
      shipment: doc.shipment_payload,
      error: null,
    }));
}

async function fetchWhatnotShipmentsTable({
  clerkUserId,
  liveId = null,
  shipmentIds = null,
  manifestUrls = null,
  forceRefresh = false,
}) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  await findLocalUser(normalizedClerkUserId);
  const ownerClerkUserId = await resolveWhatnotSnapshotOwnerClerkUserId(normalizedClerkUserId);

  if (!forceRefresh) {
    const cachedRows = await mapCachedShipmentRows({
      clerkUserId: normalizedClerkUserId,
      shipmentIds: Array.isArray(shipmentIds) ? shipmentIds : null,
      limit: 30,
    });
    if (cachedRows.length) {
      return {
        rows: cachedRows,
        requestedIds: Array.isArray(shipmentIds) ? dedupeShipmentIdsPreserveOrder(shipmentIds).slice(0, 30) : [],
        fromCache: true,
      };
    }
  }

  let ids = Array.isArray(shipmentIds)
    ? dedupeShipmentIdsPreserveOrder(
        shipmentIds.map((id) => normalizeShipmentGraphqlId(String(id || "").trim())).filter(Boolean),
      )
    : [];

  if (!ids.length) {
    ids = await tryResolveShipmentIdsFromExtensionProactive({
      clerkUserId: normalizedClerkUserId,
      liveId,
    });
  }

  if (!ids.length) {
    try {
      const peekAction = await requestWhatnotAction({
        action: "peek_observed_shipment_ids",
        clerkUserId: normalizedClerkUserId,
      });
      const rawPeek =
        peekAction && peekAction.success && peekAction.data && Array.isArray(peekAction.data.shipmentIds)
          ? peekAction.data.shipmentIds
          : [];
      ids = dedupeShipmentIdsPreserveOrder(
        rawPeek.map((id) => normalizeShipmentGraphqlId(String(id || "").trim())).filter(Boolean),
      );
    } catch (_e) {
      /* Extension offline / timeout — fall through to orders + other sources. */
    }
  }

  if (!ids.length) {
    const orderResult = await getWhatnotOrders({ clerkUserId: ownerClerkUserId, limit: 100 });
    ids = collectShipmentIdsFromWhatnotOrders(orderResult.orders, liveId);
    if (!ids.length) {
      ids = collectShipmentIdsFromWhatnotOrders(orderResult.orders, null);
    }
  }

  if (!ids.length && Array.isArray(manifestUrls) && manifestUrls.length) {
    ids = extractShipmentIdsFromManifestUrls(manifestUrls);
  }

  if (!ids.length && liveId) {
    ids = await tryResolveShipmentIdsFromMyLiveStatsForLive({
      clerkUserId: normalizedClerkUserId,
      liveId,
    });
  }

  if (!ids.length) {
    ids = await tryResolveShipmentIdsAcrossPendingLivestreams({
      clerkUserId: normalizedClerkUserId,
      primaryLiveId: liveId,
    });
  }

  ids = dedupeShipmentIdsPreserveOrder(ids).slice(0, 30);

  if (!ids.length) {
    const cachedRows = await mapCachedShipmentRows({ clerkUserId: normalizedClerkUserId, shipmentIds: null, limit: 30 });
    if (cachedRows.length) {
      return {
        rows: cachedRows,
        requestedIds: [],
        fromCache: true,
        hint: "Showing last cached shipments. Click Refresh shipments to fetch latest data from Whatnot.",
      };
    }
    return {
      rows: [],
      requestedIds: [],
      hint:
        "No shipment IDs found yet. Keep the Whatnot extension connected, sync orders on the Orders tab, then refresh shipments. The hub will pull shipment IDs from synced orders and Whatnot shipment pages automatically.",
    };
  }

  if (!forceRefresh) {
    const cachedRows = await mapCachedShipmentRows({
      clerkUserId: normalizedClerkUserId,
      shipmentIds: ids,
      limit: 30,
    });
    if (cachedRows.length) {
      return {
        rows: cachedRows,
        requestedIds: ids,
        fromCache: true,
      };
    }
  }

  const batch = await fetchWhatnotShipmentsBatchFromExtension({
    clerkUserId: normalizedClerkUserId,
    shipmentIds: ids,
  });

  return {
    rows: batch.rows,
    requestedIds: batch.requestedIds,
    fromCache: false,
  };
}

async function getLatestWhatnotInventorySnapshot({ clerkUserId, status = "ACTIVE" }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }
  const ownerClerkUserId = await resolveWhatnotSnapshotOwnerClerkUserId(normalizedClerkUserId);
  const normalizedStatus = normalizeInventoryStatus(status);

  const snapshots = await WhatnotInventorySnapshot.find({
    platform: "whatnot",
    clerk_user_id: ownerClerkUserId,
    status_filter: normalizedStatus,
  }).sort({ synced_at: -1, updated_at: -1 });

  if (!snapshots.length) {
    return {
      status: normalizedStatus,
      syncedAt: null,
      responsePayload: {},
    };
  }

  const latestSyncedAt = snapshots[0].synced_at ? new Date(snapshots[0].synced_at).getTime() : null;
  const latestSnapshots = latestSyncedAt == null
    ? snapshots
    : snapshots.filter((record) => {
      const recordSyncedAt = record.synced_at ? new Date(record.synced_at).getTime() : null;
      return recordSyncedAt === latestSyncedAt;
    });

  return {
    status: normalizedStatus,
    syncedAt: snapshots[0].synced_at || null,
    snapshotId: snapshots[0]._id || null,
    responsePayload: buildWhatnotInventoryResponsePayloadFromRecords(latestSnapshots),
  };
}

async function syncWhatnotEarlyPayoutBalanceFromPlatform({ clerkUserId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  let actionResult = null;
  try {
    actionResult = await requestWhatnotAction({
      action: "fetch_early_payout_balance_data",
      clerkUserId: normalizedClerkUserId,
    });
  } catch (error) {
    const message = String((error && error.message) || "").toLowerCase();
    if (message.includes("relogin") || message.includes("invalid token") || message.includes("auth")) {
      throw createHttpError(
        503,
        "Whatnot session is refreshing. Wait a moment and click Refresh again.",
        error.details || null,
      );
    }
    throw error;
  }

  if (!actionResult || !actionResult.success) {
    const errorText = String((actionResult && actionResult.error) || "").toLowerCase();
    if (
      errorText.includes("relogin") ||
      errorText.includes("invalid token") ||
      errorText.includes("auth refresh")
    ) {
      throw createHttpError(
        503,
        "Whatnot session is refreshing. Wait a moment and click Refresh again.",
        actionResult || null,
      );
    }
    throw createHttpError(
      (actionResult && actionResult.status) || 502,
      (actionResult && actionResult.error) || "Failed to load Whatnot payout balance. Connect the extension and Whatnot.",
      actionResult || null,
    );
  }

  const body = actionResult && actionResult.data ? actionResult.data : {};
  if (Array.isArray(body && body.errors) && body.errors.length) {
    const firstError = body.errors[0] && body.errors[0].message
      ? String(body.errors[0].message)
      : "Whatnot finance GraphQL returned errors.";
    throw createHttpError(502, firstError, body);
  }

  return {
    syncedAt: new Date(),
    responsePayload: body,
  };
}

async function getWhatnotExtensionConnectionStatus({ clerkUserId }) {
  const normalizedClerkUserId = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  const latestSession = await SellerSession.findOne({
    platform: "whatnot",
    clerk_user_id: normalizedClerkUserId,
  }).sort({ updated_at: -1 });

  const bridgeState = getWhatnotExtensionBridgeState();
  const authPayload = bridgeState && bridgeState.extensionAuthState
    ? bridgeState.extensionAuthState.payload
    : null;
  const authClerkUserId = authPayload && typeof authPayload.clerkUserId === "string"
    ? authPayload.clerkUserId.trim()
    : "";
  const hasLiveAuthTokens = Boolean(
    authPayload &&
      authPayload.auth &&
      (authPayload.auth.csrf_token || authPayload.auth.session_extension_token),
  );

  const bridgeConnectedForUser = Boolean(
    bridgeState &&
      bridgeState.isOnline &&
      authClerkUserId &&
      authClerkUserId === normalizedClerkUserId,
  );
  const extensionInstalled = Boolean(bridgeConnectedForUser || latestSession);
  const connected = Boolean(bridgeConnectedForUser && hasLiveAuthTokens && latestSession);

  return {
    connected,
    extensionInstalled,
    bridgeOnline: Boolean(bridgeState && bridgeState.isOnline),
    hasSavedSession: Boolean(latestSession),
    status: connected ? "connected" : extensionInstalled ? "disconnected" : "not_installed",
    savedSession: latestSession
      ? {
          connectedAt: latestSession.connected_at || null,
          updatedAt: latestSession.updated_at || null,
          whatnotUsername: latestSession.whatnot_username || null,
          extensionTabId: latestSession.extension_tab_id ?? null,
        }
      : null,
  };
}

module.exports = {
  checkStripeAccountStatus,
  createConnectionSession,
  disconnectPlatform,
  getConnectedAccounts,
  getWhatnotExtensionConnectionStatus,
  getLatestWhatnotInventorySnapshot,
  getWhatnotInventorySnapshot,
  fetchWhatnotInventoryTabDataFromExtension,
  syncWhatnotInventoryFromPlatform,
  syncWhatnotEarlyPayoutBalanceFromPlatform,
  getTikTokProfile,
  getTikTokVideoAnalytics,
  handleWhatnotCallback,
  handleTikTokCallback,
  updateWhatnotBioFromPlatform,
  generateWhatnotMediaUploadUrlsFromPlatform,
  createWhatnotListingFromPlatform,
  deleteWhatnotInventoryFromPlatform,
  saveGetSessionApiData,
  saveWhatnotOrders,
  saveWhatnotSellerSession,
  saveWhatnotInventorySnapshots,
  saveWhatnotInventorySnapshotsFromExtension,
  saveWhatnotInventoryEditCategories,
  saveWhatnotShippingProfiles,
  saveWhatnotLivestreamTagDirectDescendants,
  getWhatnotInventoryCreateFormOptions,
  getWhatnotLivestreamCategoryTree,
  getWhatnotReferenceCacheStatus,
  getWhatnotOrders,
  syncWhatnotOrdersFromExtension,
  fetchMyLiveStatsFromExtension,
  fetchWhatnotShowTabDataFromExtension,
  fetchWhatnotPrimaryShowFormatTagsFromExtension,
  scheduleWhatnotShowFromPlatform,
  cancelWhatnotShowFromPlatform,
  syncWhatnotReferenceCacheFromExtension,
  fetchWhatnotCurrentLiveIdFromExtension,
  fetchWhatnotShipmentsTable,
};