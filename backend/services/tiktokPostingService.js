const ConnectedAccount = require("../models/ConnectedAccount");
const TikTokPost = require("../models/TikTokPost");
const User = require("../models/Users");
const { decryptText, encryptText } = require("../utils/crypto");

const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const TIKTOK_VIDEO_DIRECT_POST_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const TIKTOK_PHOTO_POST_URL = "https://open.tiktokapis.com/v2/post/publish/content/init/";
const TIKTOK_POST_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function getTikTokConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw createHttpError(500, "TikTok integration is not configured on the server.");
  }

  return {
    clientKey,
    clientSecret,
  };
}

async function findLocalUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  return user;
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

function getScopeString(account) {
  return account && account.scopes_json && account.scopes_json.scope
    ? String(account.scopes_json.scope)
    : "";
}

function ensureTikTokScope(account, requiredScope) {
  const scopeString = getScopeString(account);

  if (!hasScope(scopeString, requiredScope)) {
    throw createHttpError(
      403,
      `TikTok account is missing the ${requiredScope} scope. Reconnect your TikTok account to continue.`,
      {
        reconnectRequired: true,
        requiredScope,
        grantedScopes: scopeString || null,
      },
    );
  }
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
  account.scopes_json = {
    ...(account.scopes_json || {}),
    scope: tokenPayload.scope || getScopeString(account) || null,
    token_type: tokenPayload.token_type || (account.scopes_json && account.scopes_json.token_type) || null,
  };
  account.metadata_json = {
    ...(account.metadata_json || {}),
    open_id: tokenPayload.open_id || account.account_external_id || null,
    refresh_expires_in: tokenPayload.refresh_expires_in || null,
    refreshed_at: now.toISOString(),
  };

  if (tokenPayload.open_id) {
    account.account_external_id = tokenPayload.open_id;
    account.account_name = account.account_name || `@${tokenPayload.open_id}`;
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

async function fetchTikTokJson(accessToken, url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body || {}),
  });

  const payload = await response.json().catch(() => ({}));
  const apiError = parseTikTokApiError(payload);

  if (!response.ok || apiError) {
    const message = apiError
      ? apiError.message
      : payload.error_description || payload.message || "TikTok request failed.";
    throw createHttpError(response.status || 502, message, apiError ? apiError.details : payload);
  }

  return payload;
}

async function callTikTokJson(account, url, body) {
  let accessToken = await getValidTikTokAccessToken(account);

  try {
    return await fetchTikTokJson(accessToken, url, body);
  } catch (error) {
    if (error.status === 401) {
      accessToken = await refreshTikTokAccessToken(account);
      return fetchTikTokJson(accessToken, url, body);
    }

    throw error;
  }
}

async function getTikTokPostingContext(clerkUserId) {
  const user = await findLocalUser(clerkUserId);
  const account = await ConnectedAccount.findOne({ user_id: user._id, platform: "tiktok" });

  if (!account || !account.access_token_encrypted) {
    throw createHttpError(404, "TikTok account is not connected.");
  }

  return {
    user,
    account,
  };
}

function normalizeOptionalString(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (typeof maxLength === "number" && normalized.length > maxLength) {
    throw createHttpError(400, `Field exceeds the maximum supported length of ${maxLength} characters.`);
  }

  return normalized;
}

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  return defaultValue;
}

function normalizeOptionalInteger(value, fieldName) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createHttpError(400, `${fieldName} must be a non-negative number.`);
  }

  return Math.floor(parsed);
}

function parseHttpsUrl(rawValue, fieldName) {
  const value = normalizeOptionalString(rawValue);

  if (!value) {
    throw createHttpError(400, `${fieldName} is required.`);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch (error) {
    throw createHttpError(400, `${fieldName} must be a valid URL.`);
  }

  if (parsedUrl.protocol !== "https:") {
    throw createHttpError(400, `${fieldName} must use HTTPS.`);
  }

  return parsedUrl;
}

function getConfiguredMediaPrefixes() {
  return String(process.env.TIKTOK_MEDIA_URL_PREFIXES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/\/+$/, ""));
}

function getConfiguredMediaDomains() {
  return String(process.env.TIKTOK_MEDIA_DOMAINS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function validateTikTokOwnedMediaUrl(rawValue, fieldName) {
  const parsedUrl = parseHttpsUrl(rawValue, fieldName);
  const normalizedUrl = parsedUrl.toString();
  const configuredPrefixes = getConfiguredMediaPrefixes();
  const configuredDomains = getConfiguredMediaDomains();

  if (!configuredPrefixes.length && !configuredDomains.length) {
    return normalizedUrl;
  }

  const matchesPrefix = configuredPrefixes.some((prefix) => normalizedUrl.startsWith(`${prefix}/`) || normalizedUrl === prefix);
  const host = parsedUrl.hostname.toLowerCase();
  const matchesDomain = configuredDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));

  if (!matchesPrefix && !matchesDomain) {
    throw createHttpError(
      400,
      `${fieldName} must belong to a TikTok-verified domain or URL prefix configured on this server.`,
      {
        field: fieldName,
        configuredPrefixes,
        configuredDomains,
      },
    );
  }

  return normalizedUrl;
}

function normalizeCreatorInfo(payload) {
  const data = payload && payload.data ? payload.data : {};

  return {
    avatarUrl: data.creator_avatar_url || null,
    username: data.creator_username || null,
    nickname: data.creator_nickname || null,
    privacyLevelOptions: Array.isArray(data.privacy_level_options)
      ? data.privacy_level_options.filter(Boolean)
      : [],
    commentDisabled: Boolean(data.comment_disabled),
    duetDisabled: Boolean(data.duet_disabled),
    stitchDisabled: Boolean(data.stitch_disabled),
    maxVideoPostDurationSec: Number.isFinite(Number(data.max_video_post_duration_sec))
      ? Number(data.max_video_post_duration_sec)
      : null,
  };
}

async function queryTikTokCreatorInfo(account) {
  return callTikTokJson(account, TIKTOK_CREATOR_INFO_URL, {});
}

function resolvePrivacyLevel(privacyLevel, creatorInfo) {
  const normalized = normalizeOptionalString(privacyLevel);

  if (!normalized) {
    throw createHttpError(400, "privacyLevel is required.");
  }

  const normalizedValue = normalized.toUpperCase();

  if (!creatorInfo.privacyLevelOptions.includes(normalizedValue)) {
    throw createHttpError(400, "privacyLevel must match one of TikTok's current privacy options for this creator.", {
      provided: normalizedValue,
      allowed: creatorInfo.privacyLevelOptions,
    });
  }

  return normalizedValue;
}

function buildVideoInitRequest(input, creatorInfo) {
  const title = normalizeOptionalString(input.title, 2200);
  const videoUrl = validateTikTokOwnedMediaUrl(input.videoUrl, "videoUrl");
  const privacyLevel = resolvePrivacyLevel(input.privacyLevel, creatorInfo);
  const coverTimestampMs = normalizeOptionalInteger(input.videoCoverTimestampMs, "videoCoverTimestampMs");
  const videoDurationSec = normalizeOptionalInteger(input.videoDurationSec, "videoDurationSec");

  if (
    videoDurationSec != null &&
    creatorInfo.maxVideoPostDurationSec != null &&
    videoDurationSec > creatorInfo.maxVideoPostDurationSec
  ) {
    throw createHttpError(400, "Video duration exceeds TikTok's current posting limit for this creator.", {
      providedSeconds: videoDurationSec,
      maxSeconds: creatorInfo.maxVideoPostDurationSec,
    });
  }

  const postInfo = {
    privacy_level: privacyLevel,
    disable_duet: creatorInfo.duetDisabled ? true : normalizeBoolean(input.disableDuet, false),
    disable_comment: creatorInfo.commentDisabled ? true : normalizeBoolean(input.disableComment, false),
    disable_stitch: creatorInfo.stitchDisabled ? true : normalizeBoolean(input.disableStitch, false),
    brand_content_toggle: normalizeBoolean(input.brandContentToggle, false),
    brand_organic_toggle: normalizeBoolean(input.brandOrganicToggle, false),
    is_aigc: normalizeBoolean(input.isAigc, false),
  };

  if (title) {
    postInfo.title = title;
  }

  if (coverTimestampMs != null) {
    postInfo.video_cover_timestamp_ms = coverTimestampMs;
  }

  return {
    requestBody: {
      post_info: postInfo,
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      },
    },
    metadata: {
      title,
      description: null,
      privacyLevel,
      mediaUrls: [videoUrl],
    },
  };
}

function buildPhotoInitRequest(input, creatorInfo) {
  const title = normalizeOptionalString(input.title, 90);
  const description = normalizeOptionalString(input.description, 4000);
  const privacyLevel = resolvePrivacyLevel(input.privacyLevel, creatorInfo);
  const photoUrls = Array.isArray(input.photoImages)
    ? input.photoImages.map((url, index) => validateTikTokOwnedMediaUrl(url, `photoImages[${index}]`))
    : [];

  if (!photoUrls.length) {
    throw createHttpError(400, "At least one photo URL is required.");
  }

  if (photoUrls.length > 35) {
    throw createHttpError(400, "TikTok supports a maximum of 35 photos per post.");
  }

  const photoCoverIndex = normalizeOptionalInteger(input.photoCoverIndex, "photoCoverIndex");
  const resolvedCoverIndex = photoCoverIndex == null ? 0 : photoCoverIndex;

  if (resolvedCoverIndex < 0 || resolvedCoverIndex >= photoUrls.length) {
    throw createHttpError(400, "photoCoverIndex must point to an item inside photoImages.");
  }

  const postInfo = {
    privacy_level: privacyLevel,
    disable_comment: creatorInfo.commentDisabled ? true : normalizeBoolean(input.disableComment, false),
    auto_add_music: normalizeBoolean(input.autoAddMusic, false),
    brand_content_toggle: normalizeBoolean(input.brandContentToggle, false),
    brand_organic_toggle: normalizeBoolean(input.brandOrganicToggle, false),
  };

  if (title) {
    postInfo.title = title;
  }

  if (description) {
    postInfo.description = description;
  }

  return {
    requestBody: {
      media_type: "PHOTO",
      post_mode: "DIRECT_POST",
      post_info: postInfo,
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: resolvedCoverIndex,
        photo_images: photoUrls,
      },
    },
    metadata: {
      title,
      description,
      privacyLevel,
      mediaUrls: photoUrls,
    },
  };
}

function serializeTikTokPost(record) {
  return {
    id: record._id,
    publishId: record.publish_id,
    mediaType: record.media_type,
    postMode: record.post_mode,
    sourceType: record.source_type,
    status: record.status,
    failReason: record.fail_reason || null,
    publiclyAvailablePostIds: Array.isArray(record.publicly_available_post_ids)
      ? record.publicly_available_post_ids
      : [],
    mediaUrls: Array.isArray(record.media_urls) ? record.media_urls : [],
    title: record.title || null,
    description: record.description || null,
    privacyLevel: record.privacy_level || null,
    creatorUsername: record.creator_username || null,
    creatorNickname: record.creator_nickname || null,
    requestedAt: record.requested_at || null,
    completedAt: record.completed_at || null,
    lastStatusCheckedAt: record.last_status_checked_at || null,
  };
}

async function createTikTokPostRecord({
  user,
  account,
  publishId,
  mediaType,
  metadata,
  creatorInfo,
  requestBody,
  responsePayload,
}) {
  const now = new Date();
  const record = new TikTokPost({
    user_id: user._id,
    workspace_id: account.workspace_id || null,
    connected_account_id: account._id,
    publish_id: publishId,
    media_type: mediaType,
    post_mode: "DIRECT_POST",
    source_type: "PULL_FROM_URL",
    status: mediaType === "PHOTO" ? "PROCESSING_DOWNLOAD" : "PROCESSING_DOWNLOAD",
    fail_reason: null,
    publicly_available_post_ids: [],
    media_urls: metadata.mediaUrls,
    title: metadata.title || null,
    description: metadata.description || null,
    privacy_level: metadata.privacyLevel || null,
    creator_username: creatorInfo.username || null,
    creator_nickname: creatorInfo.nickname || null,
    requested_at: now,
    request_json: requestBody,
    response_json: responsePayload,
    metadata_json: {
      tiktokLogId:
        responsePayload &&
        responsePayload.error &&
        responsePayload.error.log_id
          ? responsePayload.error.log_id
          : null,
    },
    created_at: now,
    updated_at: now,
  });

  await record.save();
  return record;
}

function applyTikTokStatusToRecord(record, payload) {
  const data = payload && payload.data ? payload.data : {};
  const now = new Date();
  const finalStatuses = new Set(["FAILED", "PUBLISH_COMPLETE"]);

  if (data.status) {
    record.status = data.status;
  }

  record.fail_reason = data.fail_reason || null;
  record.publicly_available_post_ids = Array.isArray(data.publicaly_available_post_id)
    ? data.publicaly_available_post_id.map((value) => String(value))
    : [];
  record.last_status_checked_at = now;
  record.response_json = payload;
  record.updated_at = now;

  if (finalStatuses.has(record.status)) {
    record.completed_at = record.completed_at || now;
  }

  return record;
}

async function getTikTokCreatorInfo({ clerkUserId }) {
  const { account } = await getTikTokPostingContext(clerkUserId);
  ensureTikTokScope(account, "video.publish");

  const creatorInfoPayload = await queryTikTokCreatorInfo(account);
  const creatorInfo = normalizeCreatorInfo(creatorInfoPayload);

  return {
    connected: true,
    creator: creatorInfo,
    account: {
      platform: account.platform,
      username: account.account_name || null,
      externalId: account.account_external_id || null,
      scopes: getScopeString(account) || null,
      expiresAt: account.token_expires_at || null,
    },
  };
}

async function publishTikTokVideo({ clerkUserId, ...input }) {
  const { user, account } = await getTikTokPostingContext(clerkUserId);
  ensureTikTokScope(account, "video.publish");

  const creatorInfoPayload = await queryTikTokCreatorInfo(account);
  const creatorInfo = normalizeCreatorInfo(creatorInfoPayload);
  const { requestBody, metadata } = buildVideoInitRequest(input, creatorInfo);
  const responsePayload = await callTikTokJson(account, TIKTOK_VIDEO_DIRECT_POST_URL, requestBody);
  const publishId = responsePayload && responsePayload.data ? responsePayload.data.publish_id : null;

  if (!publishId) {
    throw createHttpError(502, "TikTok did not return a publish ID for the video post.", responsePayload);
  }

  const record = await createTikTokPostRecord({
    user,
    account,
    publishId,
    mediaType: "VIDEO",
    metadata,
    creatorInfo,
    requestBody,
    responsePayload,
  });

  return {
    publishId,
    creator: creatorInfo,
    post: serializeTikTokPost(record),
  };
}

async function publishTikTokPhoto({ clerkUserId, ...input }) {
  const { user, account } = await getTikTokPostingContext(clerkUserId);
  ensureTikTokScope(account, "video.publish");

  const creatorInfoPayload = await queryTikTokCreatorInfo(account);
  const creatorInfo = normalizeCreatorInfo(creatorInfoPayload);
  const { requestBody, metadata } = buildPhotoInitRequest(input, creatorInfo);
  const responsePayload = await callTikTokJson(account, TIKTOK_PHOTO_POST_URL, requestBody);
  const publishId = responsePayload && responsePayload.data ? responsePayload.data.publish_id : null;

  if (!publishId) {
    throw createHttpError(502, "TikTok did not return a publish ID for the photo post.", responsePayload);
  }

  const record = await createTikTokPostRecord({
    user,
    account,
    publishId,
    mediaType: "PHOTO",
    metadata,
    creatorInfo,
    requestBody,
    responsePayload,
  });

  return {
    publishId,
    creator: creatorInfo,
    post: serializeTikTokPost(record),
  };
}

async function getTikTokPostStatus({ clerkUserId, publishId }) {
  const normalizedPublishId = normalizeOptionalString(publishId);

  if (!normalizedPublishId) {
    throw createHttpError(400, "publishId is required.");
  }

  const { user, account } = await getTikTokPostingContext(clerkUserId);

  if (!hasScope(getScopeString(account), "video.publish") && !hasScope(getScopeString(account), "video.upload")) {
    throw createHttpError(403, "TikTok account is missing the required posting scopes.", {
      reconnectRequired: true,
      requiredScopes: ["video.publish", "video.upload"],
      grantedScopes: getScopeString(account) || null,
    });
  }

  const record = await TikTokPost.findOne({ user_id: user._id, publish_id: normalizedPublishId });

  if (!record) {
    throw createHttpError(404, "TikTok post was not found for this user.");
  }

  const responsePayload = await callTikTokJson(account, TIKTOK_POST_STATUS_URL, {
    publish_id: normalizedPublishId,
  });

  applyTikTokStatusToRecord(record, responsePayload);
  await record.save();

  const data = responsePayload && responsePayload.data ? responsePayload.data : {};

  return {
    post: serializeTikTokPost(record),
    status: {
      status: data.status || record.status,
      failReason: data.fail_reason || null,
      uploadedBytes: Number.isFinite(Number(data.uploaded_bytes)) ? Number(data.uploaded_bytes) : null,
      downloadedBytes: Number.isFinite(Number(data.downloaded_bytes)) ? Number(data.downloaded_bytes) : null,
      publiclyAvailablePostIds: Array.isArray(data.publicaly_available_post_id)
        ? data.publicaly_available_post_id.map((value) => String(value))
        : [],
    },
  };
}

module.exports = {
  getTikTokCreatorInfo,
  getTikTokPostStatus,
  publishTikTokPhoto,
  publishTikTokVideo,
};