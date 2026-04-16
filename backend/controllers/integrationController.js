const {
  checkStripeAccountStatus,
  createConnectionSession,
  disconnectPlatform,
  getConnectedAccounts,
  getWhatnotInventorySnapshot,
  getTikTokProfile,
  getTikTokVideoAnalytics,
  handleWhatnotCallback,
  handleTikTokCallback,
} = require("../services/integrationService");
const {
  getTikTokCreatorInfo,
  getTikTokPostStatus,
  publishTikTokPhoto,
  publishTikTokVideo,
} = require("../services/tiktokPostingService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }
  
  return res.status(status).json(payload);
}

async function checkStripeStatus(req, res) {
  try {
    const result = await checkStripeAccountStatus({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function startConnection(req, res) {
  try {
    const result = await createConnectionSession({
      clerkUserId: req.auth.userId,
      role: req.body && req.body.role,
      platform: req.body && req.body.platform,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function listConnections(req, res) {
  try {
    const result = await getConnectedAccounts({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokProfileData(req, res) {
  try {
    const result = await getTikTokProfile({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokVideoAnalyticsData(req, res) {
  try {
    const result = await getTikTokVideoAnalytics({
      clerkUserId: req.auth.userId,
      cursor: req.query && req.query.cursor ? Number(req.query.cursor) : null,
      maxCount: req.query && req.query.maxCount ? Number(req.query.maxCount) : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getWhatnotInventorySnapshotData(req, res) {
  try {
    const result = await getWhatnotInventorySnapshot({
      clerkUserId: req.auth.userId,
      first: req.query && req.query.first ? Number(req.query.first) : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokCreatorInfoData(req, res) {
  try {
    const result = await getTikTokCreatorInfo({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createTikTokVideoPost(req, res) {
  try {
    const result = await publishTikTokVideo({
      clerkUserId: req.auth.userId,
      ...(req.body || {}),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createTikTokPhotoPost(req, res) {
  try {
    const result = await publishTikTokPhoto({
      clerkUserId: req.auth.userId,
      ...(req.body || {}),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokPostStatusData(req, res) {
  try {
    const publishId = req.body && req.body.publishId ? req.body.publishId : req.query.publishId;
    const result = await getTikTokPostStatus({
      clerkUserId: req.auth.userId,
      publishId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function removeConnection(req, res) {
  try {
    const result = await disconnectPlatform({
      clerkUserId: req.auth.userId,
      platform: req.params.platform,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function tiktokCallback(req, res) {
  const result = await handleTikTokCallback({
    code: req.query.code,
    state: req.query.state,
    error: req.query.error,
    errorDescription: req.query.error_description,
  });

  return res.redirect(result.redirectUrl);
}

async function whatnotCallback(req, res) {
  const result = await handleWhatnotCallback({
    code: req.query.code,
    state: req.query.state,
    error: req.query.error,
    errorDescription: req.query.error_description,
  });

  return res.redirect(result.redirectUrl);
}

module.exports = {
  checkStripeStatus,
  createTikTokPhotoPost,
  createTikTokVideoPost,
  getWhatnotInventorySnapshotData,
  getTikTokCreatorInfoData,
  getTikTokPostStatusData,
  getTikTokProfileData,
  getTikTokVideoAnalyticsData,
  listConnections,
  removeConnection,
  startConnection,
  whatnotCallback,
  tiktokCallback,
};