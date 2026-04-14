const { ConnectedAccount, TikTokPost, User } = require("../models");
const { decryptText, encryptText } = require("../utils/crypto");

const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const TIKTOK_VIDEO_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const TIKTOK_PHOTO_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/content/init/";
const TIKTOK_POST_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
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

async function findLocalUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  return user;
}

function getTikTokConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw createHttpError(500, "TikTok integration is not configured on the server.");
  }

  return { clientKey, clientSecret };
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
  account.metadata_json = {
    ...(account.metadata_json || {}),
    refreshed_at: now.toISOString(),
  };

  if (tokenPayload.open_id) {
    account.account_external_id = tokenPayload.open_id;
    if (!account.account_name) {
      account.account_name = `@${tokenPayload.open_id}`;
    }
  }

  await account.save();

  return decryptText(account.access_token_encrypted);
}

async function getConnectedTikTokAccount(clerkUserId) {
  const user = await findLocalUser(clerkUserId);
  const account = await ConnectedAccount.findOne({ user_id: user._id, platform: "tiktok" });

  return { user, account };
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

async function postTikTokJson(url, accessToken, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
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

function serializePost(post) {
  return {
    id: post._id,
    publishId: post.publish_id,
    mediaType: post.media_type,
    postMode: post.post_mode,
    sourceType: post.source_type,
    status: post.status,
    failReason: post.fail_reason || null,
    publiclyAvailablePostIds: Array.isArray(post.publicly_available_post_ids) ? post.publicly_available_post_ids : [],
    mediaUrls: Array.isArray(post.media_urls) ? post.media_urls : [],
    title: post.title || null,
    description: post.description || null,
    privacyLevel: post.privacy_level || null,
    creatorUsername: post.creator_username || null,
    creatorNickname: post.creator_nickname || null,
    requestedAt: post.requested_at ? post.requested_at.toISOString() : null,
    completedAt: post.completed_at ? post.completed_at.toISOString() : null,
    lastStatusCheckedAt: post.last_status_checked_at ? post.last_status_checked_at.toISOString() : null,
  };
}

function mapCreatorInfo(creatorPayload, account) {
  const creator = creatorPayload && creatorPayload.data ? creatorPayload.data : {};

  return {
    connected: true,
    creator: {
      avatarUrl: creator.creator_avatar_url || null,
      username: creator.creator_username || null,
      nickname: creator.creator_nickname || null,
      privacyLevelOptions: Array.isArray(creator.privacy_level_options) ? creator.privacy_level_options : [],
      commentDisabled: Boolean(creator.comment_disabled),
      duetDisabled: Boolean(creator.duet_disabled),
      stitchDisabled: Boolean(creator.stitch_disabled),
      maxVideoPostDurationSec: toNullableNumber(creator.max_video_post_duration_sec),
    },
    account: {
      platform: account.platform,
      username: account.account_name || null,
      externalId: account.account_external_id || null,
      scopes: account.scopes_json && account.scopes_json.scope ? account.scopes_json.scope : null,
      expiresAt: account.token_expires_at || null,
    },
  };
}

function ensureCreatorInfoPermissions(creatorInfo, privacyLevel) {
  const options = creatorInfo && creatorInfo.creator && Array.isArray(creatorInfo.creator.privacyLevelOptions)
    ? creatorInfo.creator.privacyLevelOptions
    : [];

  if (!privacyLevel) {
    throw createHttpError(400, "privacyLevel is required.");
  }

  if (options.length && !options.includes(privacyLevel)) {
    throw createHttpError(422, `privacyLevel '${privacyLevel}' is not allowed for this TikTok account.`);
  }
}

function ensurePostingScope(accountScopes, scope) {
  if (!hasScope(accountScopes, scope)) {
    throw createHttpError(403, `TikTok scope '${scope}' is required. Reconnect TikTok and grant this scope.`);
  }
}

async function getTikTokCreatorInfo({ clerkUserId }) {
  const { account } = await getConnectedTikTokAccount(clerkUserId);

  if (!account || !account.access_token_encrypted) {
    return {
      connected: false,
      creator: {
        avatarUrl: null,
        username: null,
        nickname: null,
        privacyLevelOptions: [],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
        maxVideoPostDurationSec: null,
      },
      account: {
        platform: "tiktok",
        username: null,
        externalId: null,
        scopes: null,
        expiresAt: null,
      },
    };
  }

  let accessToken = await getValidTikTokAccessToken(account);

  try {
    const payload = await postTikTokJson(TIKTOK_CREATOR_INFO_URL, accessToken, {});
    return mapCreatorInfo(payload, account);
  } catch (error) {
    if (error.status === 401) {
      accessToken = await refreshTikTokAccessToken(account);
      const payload = await postTikTokJson(TIKTOK_CREATOR_INFO_URL, accessToken, {});
      return mapCreatorInfo(payload, account);
    }

    throw error;
  }
}

async function upsertTikTokPostRecord({
  user,
  account,
  mediaType,
  postMode,
  sourceType,
  publishId,
  mediaUrls,
  title,
  description,
  privacyLevel,
  creatorInfo,
  requestJson,
  responseJson,
}) {
  const now = new Date();
  const existing = await TikTokPost.findOne({ publish_id: publishId, user_id: user._id });
  const post = existing || new TikTokPost({
    user_id: user._id,
    workspace_id: account.workspace_id || null,
    connected_account_id: account._id,
    publish_id: publishId,
    media_type: mediaType,
    post_mode: postMode,
    source_type: sourceType,
    created_at: now,
  });

  post.status = "INIT_ACCEPTED";
  post.fail_reason = null;
  post.media_urls = Array.isArray(mediaUrls) ? mediaUrls : [];
  post.title = title || null;
  post.description = description || null;
  post.privacy_level = privacyLevel || null;
  post.creator_username = creatorInfo && creatorInfo.creator ? creatorInfo.creator.username || null : null;
  post.creator_nickname = creatorInfo && creatorInfo.creator ? creatorInfo.creator.nickname || null : null;
  post.requested_at = now;
  post.request_json = requestJson || null;
  post.response_json = responseJson || null;
  post.updated_at = now;

  await post.save();

  return post;
}

async function publishTikTokVideo({
  clerkUserId,
  title,
  privacyLevel,
  videoUrl,
  videoCoverTimestampMs,
  videoDurationSec,
  disableDuet = false,
  disableComment = false,
  disableStitch = false,
  brandContentToggle = false,
  brandOrganicToggle = false,
  isAigc = false,
}) {
  if (!videoUrl || typeof videoUrl !== "string") {
    throw createHttpError(400, "videoUrl is required.");
  }

  const { user, account } = await getConnectedTikTokAccount(clerkUserId);

  if (!account || !account.access_token_encrypted) {
    throw createHttpError(404, "TikTok account is not connected.");
  }

  const accountScopes = account.scopes_json && account.scopes_json.scope ? account.scopes_json.scope : "";
  ensurePostingScope(accountScopes, "video.publish");

  const creatorInfo = await getTikTokCreatorInfo({ clerkUserId });
  ensureCreatorInfoPermissions(creatorInfo, privacyLevel);

  const requestBody = {
    post_info: {
      title: title || undefined,
      privacy_level: privacyLevel,
      disable_duet: Boolean(disableDuet),
      disable_comment: Boolean(disableComment),
      disable_stitch: Boolean(disableStitch),
      brand_content_toggle: Boolean(brandContentToggle),
      brand_organic_toggle: Boolean(brandOrganicToggle),
      is_aigc: Boolean(isAigc),
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    },
  };

  if (toNullableNumber(videoCoverTimestampMs) != null) {
    requestBody.post_info.video_cover_timestamp_ms = toNullableNumber(videoCoverTimestampMs);
  }

  if (toNullableNumber(videoDurationSec) != null) {
    requestBody.source_info.video_duration = toNullableNumber(videoDurationSec);
  }

  let accessToken = await getValidTikTokAccessToken(account);
  let payload;

  try {
    payload = await postTikTokJson(TIKTOK_VIDEO_INIT_URL, accessToken, requestBody);
  } catch (error) {
    if (error.status === 401) {
      accessToken = await refreshTikTokAccessToken(account);
      payload = await postTikTokJson(TIKTOK_VIDEO_INIT_URL, accessToken, requestBody);
    } else {
      throw error;
    }
  }

  const publishId = payload && payload.data ? payload.data.publish_id : null;

  if (!publishId) {
    throw createHttpError(502, "TikTok did not return a publish_id.", payload);
  }

  const post = await upsertTikTokPostRecord({
    user,
    account,
    mediaType: "VIDEO",
    postMode: "DIRECT_POST",
    sourceType: "PULL_FROM_URL",
    publishId,
    mediaUrls: [videoUrl],
    title,
    description: null,
    privacyLevel,
    creatorInfo,
    requestJson: requestBody,
    responseJson: payload,
  });

  return {
    publishId,
    creator: creatorInfo.creator,
    post: serializePost(post),
  };
}

async function publishTikTokPhoto({
  clerkUserId,
  title,
  description,
  privacyLevel,
  photoImages,
  photoCoverIndex = 0,
  disableComment = false,
  autoAddMusic = false,
  brandContentToggle = false,
  brandOrganicToggle = false,
}) {
  const normalizedImages = Array.isArray(photoImages)
    ? photoImages.map((url) => String(url || "").trim()).filter(Boolean)
    : [];

  if (!normalizedImages.length) {
    throw createHttpError(400, "photoImages is required and must include at least one URL.");
  }

  if (normalizedImages.length > 35) {
    throw createHttpError(400, "photoImages supports up to 35 URLs.");
  }

  const { user, account } = await getConnectedTikTokAccount(clerkUserId);

  if (!account || !account.access_token_encrypted) {
    throw createHttpError(404, "TikTok account is not connected.");
  }

  const accountScopes = account.scopes_json && account.scopes_json.scope ? account.scopes_json.scope : "";

  if (!hasScope(accountScopes, "video.publish") && !hasScope(accountScopes, "video.upload")) {
    throw createHttpError(403, "TikTok scope 'video.publish' or 'video.upload' is required for photo posting.");
  }

  const creatorInfo = await getTikTokCreatorInfo({ clerkUserId });
  ensureCreatorInfoPermissions(creatorInfo, privacyLevel);

  const requestBody = {
    media_type: "PHOTO",
    post_mode: "DIRECT_POST",
    post_info: {
      title: title || undefined,
      description: description || undefined,
      privacy_level: privacyLevel,
      disable_comment: Boolean(disableComment),
      auto_add_music: Boolean(autoAddMusic),
      brand_content_toggle: Boolean(brandContentToggle),
      brand_organic_toggle: Boolean(brandOrganicToggle),
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_images: normalizedImages,
      photo_cover_index: Math.max(0, Math.floor(Number(photoCoverIndex) || 0)),
    },
  };

  let accessToken = await getValidTikTokAccessToken(account);
  let payload;

  try {
    payload = await postTikTokJson(TIKTOK_PHOTO_INIT_URL, accessToken, requestBody);
  } catch (error) {
    if (error.status === 401) {
      accessToken = await refreshTikTokAccessToken(account);
      payload = await postTikTokJson(TIKTOK_PHOTO_INIT_URL, accessToken, requestBody);
    } else {
      throw error;
    }
  }

  const publishId = payload && payload.data ? payload.data.publish_id : null;

  if (!publishId) {
    throw createHttpError(502, "TikTok did not return a publish_id.", payload);
  }

  const post = await upsertTikTokPostRecord({
    user,
    account,
    mediaType: "PHOTO",
    postMode: "DIRECT_POST",
    sourceType: "PULL_FROM_URL",
    publishId,
    mediaUrls: normalizedImages,
    title,
    description,
    privacyLevel,
    creatorInfo,
    requestJson: requestBody,
    responseJson: payload,
  });

  return {
    publishId,
    creator: creatorInfo.creator,
    post: serializePost(post),
  };
}

async function getTikTokPostStatus({ clerkUserId, publishId }) {
  if (!publishId || typeof publishId !== "string") {
    throw createHttpError(400, "publishId is required.");
  }

  const { user, account } = await getConnectedTikTokAccount(clerkUserId);

  if (!account || !account.access_token_encrypted) {
    throw createHttpError(404, "TikTok account is not connected.");
  }

  const post = await TikTokPost.findOne({ publish_id: publishId, user_id: user._id });

  if (!post) {
    throw createHttpError(404, "TikTok post record was not found for this user.");
  }

  let accessToken = await getValidTikTokAccessToken(account);
  let payload;

  try {
    payload = await postTikTokJson(TIKTOK_POST_STATUS_URL, accessToken, {
      publish_id: publishId,
    });
  } catch (error) {
    if (error.status === 401) {
      accessToken = await refreshTikTokAccessToken(account);
      payload = await postTikTokJson(TIKTOK_POST_STATUS_URL, accessToken, {
        publish_id: publishId,
      });
    } else {
      throw error;
    }
  }

  const data = payload && payload.data ? payload.data : {};
  const now = new Date();
  const status = data.status || post.status || "INIT_ACCEPTED";
  const failReason = data.fail_reason || null;
  const publiclyAvailablePostIds = Array.isArray(data.publicly_available_post_ids)
    ? data.publicly_available_post_ids
    : [];

  post.status = status;
  post.fail_reason = failReason;
  post.publicly_available_post_ids = publiclyAvailablePostIds;
  post.last_status_checked_at = now;
  post.updated_at = now;
  post.response_json = payload;

  if (status === "PUBLISH_COMPLETE") {
    post.completed_at = now;
  }

  await post.save();

  return {
    post: serializePost(post),
    status: {
      status,
      failReason,
      uploadedBytes: toNullableNumber(data.uploaded_bytes),
      downloadedBytes: toNullableNumber(data.downloaded_bytes),
      publiclyAvailablePostIds,
    },
  };
}

module.exports = {
  getTikTokCreatorInfo,
  getTikTokPostStatus,
  publishTikTokPhoto,
  publishTikTokVideo,
};
