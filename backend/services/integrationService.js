const crypto = require("crypto");

const Stripe = require("stripe");
const ConnectedAccount = require("../models/ConnectedAccount");
const StripeConnectAccount = require("../models/StripeConnectAccount");
const User = require("../models/Users");
const { decryptText, encryptText } = require("../utils/crypto");

const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const TIKTOK_BASIC_USER_INFO_FIELDS = "open_id,union_id,avatar_url";
const TIKTOK_STATS_USER_INFO_FIELDS = "open_id,union_id,avatar_url,follower_count,following_count,likes_count,video_count";
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
  const scopes = process.env.TIKTOK_SCOPES || "user.info.basic";
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

function signState(payload) {
  const { stateSecret } = getTikTokConfig();
  const body = toBase64Url(encryptText(JSON.stringify(payload)));
  const signature = crypto.createHmac("sha256", stateSecret).update(body).digest("hex");
  return `${body}.${signature}`;
}

function parseState(state) {
  const { stateSecret } = getTikTokConfig();
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

  if (!payload || !payload.clerkUserId || !payload.platform || !payload.role || !payload.timestamp || !payload.codeVerifier) {
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

  if (normalizedPlatform !== "tiktok") {
    throw createHttpError(400, "Only TikTok and Stripe connections are implemented right now.");
  }

  await findLocalUser(clerkUserId);

  const { clientKey, redirectUri, scopes } = getTikTokConfig();
  const pkce = createPkcePair();
  const state = signState({
    clerkUserId,
    role,
    platform: normalizedPlatform,
    codeVerifier: pkce.verifier,
    nonce: crypto.randomBytes(12).toString("hex"),
    timestamp: Date.now(),
  });

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
    payload = parseState(state);
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

module.exports = {
  checkStripeAccountStatus,
  createConnectionSession,
  disconnectPlatform,
  getConnectedAccounts,
  getTikTokProfile,
  handleTikTokCallback,
};