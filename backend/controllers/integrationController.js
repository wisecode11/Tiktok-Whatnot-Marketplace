const {
  checkStripeAccountStatus,
  createConnectionSession,
  disconnectPlatform,
  getConnectedAccounts,
  getWhatnotExtensionConnectionStatus,
  getLatestWhatnotInventorySnapshot,
  getWhatnotInventorySnapshot,
  getTikTokProfile,
  getTikTokVideoAnalytics,
  handleWhatnotCallback,
  handleTikTokCallback,
  saveGetSessionApiData,
  saveWhatnotSellerSession,
  syncWhatnotInventoryFromPlatform,
  updateWhatnotBioFromPlatform,
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

async function getWhatnotExtensionStatusData(req, res) {
  try {
    const result = await getWhatnotExtensionConnectionStatus({
      clerkUserId: req.auth.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getWhatnotInventoryLiveData(req, res) {
  try {
    const result = await getLatestWhatnotInventorySnapshot({
      clerkUserId: req.auth.userId,
      status: req.query && req.query.status ? req.query.status : "ACTIVE",
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncWhatnotInventoryLiveData(req, res) {
  try {
    const result = await syncWhatnotInventoryFromPlatform({
      clerkUserId: req.auth.userId,
      status: req.body && req.body.status ? req.body.status : "ACTIVE",
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

async function saveWhatnotSessionData(req, res) {
  try {
    const bodyClerkUserId = req.body && typeof req.body.clerkUserId === "string"
      ? req.body.clerkUserId.trim()
      : null;
    const result = await saveWhatnotSellerSession({
      clerkUserId: bodyClerkUserId || (req.auth && req.auth.userId ? req.auth.userId : null),
      auth: req.body && req.body.auth ? req.body.auth : {},
      sessionData: req.body && req.body.sessionData ? req.body.sessionData : {},
      tabId: req.body && req.body.tabId != null ? req.body.tabId : null,
      source: req.body && req.body.source ? req.body.source : "whatnot-extension",
    });

    return res.status(result.created ? 201 : 200).json({
      success: true,
      sellerSessionId: result.id,
      created: result.created,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveGetSessionApiDataEntry(req, res) {
  try {
    const result = await saveGetSessionApiData({
      responsePayload: req.body && req.body.responsePayload ? req.body.responsePayload : {},
      tabId: req.body && req.body.tabId != null ? req.body.tabId : null,
      source: req.body && req.body.source ? req.body.source : "whatnot-extension",
    });

    return res.status(201).json({ success: true, getSessionApiDataId: result.id, createdAt: result.createdAt });
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateWhatnotBio(req, res) {
  try {
    const result = await updateWhatnotBioFromPlatform({
      bio: req.body && req.body.bio ? req.body.bio : "",
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
  getWhatnotInventoryLiveData,
  getWhatnotExtensionStatusData,
  getTikTokCreatorInfoData,
  getTikTokPostStatusData,
  getTikTokProfileData,
  getTikTokVideoAnalyticsData,
  listConnections,
  removeConnection,
  saveGetSessionApiDataEntry,
  saveWhatnotSessionData,
  syncWhatnotInventoryLiveData,
  startConnection,
  whatnotCallback,
  tiktokCallback,
  updateWhatnotBio,
};