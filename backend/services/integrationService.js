const crypto = require("crypto");

const Stripe = require("stripe");
const ConnectedAccount = require("../models/ConnectedAccount");
const GetSessionApiData = require("../models/GetSessionApiData");
const SellerSession = require("../models/SellerSession");
const StripeConnectAccount = require("../models/StripeConnectAccount");
const User = require("../models/Users");
const { requestWhatnotAction } = require("../socket/whatnotExtensionBridge");
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

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
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

  return null;
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || secretKey.includes("REPLACE_WITH")) {
    throw createHttpError(500, "Stripe integration is not configured on the server. Add STRIPE_SECRET_KEY to .env");
  }

  return new Stripe(secretKey, { apiVersion: "2025-03-31.basil" });
}

function getStripeConfig() {
  const frontendUrl = getFrontendUrl();

  return {
    returnUrl: process.env.STRIPE_CONNECT_RETURN_URL || `${frontendUrl}/launch-pad`,
    refreshUrl: process.env.STRIPE_CONNECT_REFRESH_URL || `${frontendUrl}/launch-pad`,
  };
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

async function upsertStripeConnectSnapshot({
  localUserId,
  stripeAccountId,
  stripeAccount = null,
  onboardingStatus,
}) {
  if (!localUserId || !stripeAccountId) {
    return null;
  }

  const now = new Date();
  const existing = await StripeConnectAccount.findOne({
    user_id: localUserId,
    account_type: "moderator",
  });
  const record = existing || new StripeConnectAccount({
    user_id: localUserId,
    account_type: "moderator",
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

  return record;
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

  await findLocalUser(clerkUserId);

  const { clientKey, redirectUri, scopes } = getTikTokConfig();
  const pkce = createPkcePair();
  const state = signOAuthState({
    clerkUserId,
    role,
    platform: normalizedPlatform,
    codeVerifier: pkce.verifier,
    nonce: crypto.randomBytes(12).toString("hex"),
    timestamp: Date.now(),
  }, getTikTokConfig().stateSecret);

  const authorizationUrl = new URL(TIKTOK_AUTHORIZE_URL);
  authorizationUrl.searchParams.set("client_key", clientKey);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", scopes);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", pkce.challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("disable_auto_auth", "0");

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
  const { returnUrl, refreshUrl } = getStripeConfig();
  const user = await findLocalUser(clerkUserId);

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
      metadata: { clerkUserId, localUserId: user._id.toString() },
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
    account.updated_at = now;
    await account.save();

    await upsertStripeConnectSnapshot({
      localUserId: user._id,
      stripeAccountId,
      onboardingStatus: "created",
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
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    requirements,
    details_submitted: stripeAccount.details_submitted,
    checked_at: now.toISOString(),
  };
  account.updated_at = now;
  await account.save();

  await upsertStripeConnectSnapshot({
    localUserId: user._id,
    stripeAccountId: account.account_external_id,
    stripeAccount,
    onboardingStatus,
  });

  return {
    connected: isOnboardingComplete,
    chargesEnabled,
    payoutsEnabled,
    requirements,
    detailsSubmitted: stripeAccount.details_submitted,
    stripeAccountId: account.account_external_id,
  };
}

async function handleTikTokCallback({ code, state, error, errorDescription }) {
  let payload;

  try {
    payload = parseOAuthState(state, {
      stateSecret: getTikTokConfig().stateSecret,
      requireCodeVerifier: true,
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
        message: "Missing TikTok authorization code.",
      }),
    };
  }

  try {
    const user = await findLocalUser(payload.clerkUserId);
    const { clientKey, clientSecret, redirectUri } = getTikTokConfig();
    const tokenPayload = await fetchTikTokToken({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: payload.codeVerifier,
    });

    const now = new Date();
    const account =
      (await ConnectedAccount.findOne({ user_id: user._id, platform: payload.platform })) ||
      new ConnectedAccount({ user_id: user._id, platform: payload.platform, created_at: now });

    account.account_external_id = tokenPayload.open_id;
    account.account_name = tokenPayload.open_id ? `@${tokenPayload.open_id}` : `@${payload.platform}`;
    account.access_token_encrypted = encryptText(tokenPayload.access_token);
    account.refresh_token_encrypted = encryptText(tokenPayload.refresh_token);
    account.token_expires_at = new Date(Date.now() + Number(tokenPayload.expires_in || 0) * 1000);
    account.scopes_json = {
      scope: tokenPayload.scope,
      token_type: tokenPayload.token_type,
    };
    account.status = "connected";
    account.metadata_json = {
      open_id: tokenPayload.open_id,
      refresh_expires_in: tokenPayload.refresh_expires_in,
      connected_at: now.toISOString(),
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

  if (normalizedPlatform === "tiktok" && account.access_token_encrypted) {
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
    await upsertStripeConnectSnapshot({
      localUserId: user._id,
      stripeAccountId: account.account_external_id,
      onboardingStatus: "revoked",
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

module.exports = {
  checkStripeAccountStatus,
  createConnectionSession,
  disconnectPlatform,
  getConnectedAccounts,
  getWhatnotInventorySnapshot,
  getTikTokProfile,
  getTikTokVideoAnalytics,
  handleWhatnotCallback,
  handleTikTokCallback,
  updateWhatnotBioFromPlatform,
  saveGetSessionApiData,
  saveWhatnotSellerSession,
};