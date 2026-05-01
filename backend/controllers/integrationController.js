const {
  checkStripeAccountStatus,
  createConnectionSession,
  disconnectPlatform,
  getConnectedAccounts,
  getWhatnotExtensionConnectionStatus,
  getLatestWhatnotInventorySnapshot,
  getWhatnotInventoryCreateFormOptions,
  getWhatnotInventorySnapshot,
  getTikTokProfile,
  getTikTokVideoAnalytics,
  getWhatnotOrders,
  syncWhatnotOrdersFromExtension,
  handleWhatnotCallback,
  handleTikTokCallback,
  saveGetSessionApiData,
  saveWhatnotInventoryEditCategories,
  saveWhatnotShippingProfiles,
  saveWhatnotOrders,
  saveWhatnotSellerSession,
  syncWhatnotInventoryFromPlatform,
  generateWhatnotMediaUploadUrlsFromPlatform,
  createWhatnotListingFromPlatform,
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

async function getWhatnotInventoryCreateFormOptionsData(_req, res) {
  try {
    const result = await getWhatnotInventoryCreateFormOptions();
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

async function saveWhatnotOrdersEntry(req, res) {
  try {
    const bodyClerkUserId = req.body && typeof req.body.clerkUserId === "string"
      ? req.body.clerkUserId.trim()
      : null;
    const result = await saveWhatnotOrders({
      clerkUserId: bodyClerkUserId || (req.auth && req.auth.userId ? req.auth.userId : null),
      orders: req.body && Array.isArray(req.body.orders) ? req.body.orders : [],
      tabId: req.body && req.body.tabId != null ? req.body.tabId : null,
      source: req.body && req.body.source ? req.body.source : "whatnot-extension",
    });

    return res.status(200).json({
      success: true,
      savedCount: result.savedCount,
      receivedCount: result.receivedCount,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveWhatnotInventoryEditCategoriesEntry(req, res) {
  try {
    const result = await saveWhatnotInventoryEditCategories({
      responsePayload: req.body && req.body.responsePayload ? req.body.responsePayload : {},
      tabId: req.body && req.body.tabId != null ? req.body.tabId : null,
      source: req.body && req.body.source ? req.body.source : "whatnot-extension",
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveWhatnotShippingProfilesEntry(req, res) {
  try {
    const result = await saveWhatnotShippingProfiles({
      responsePayload: req.body && req.body.responsePayload ? req.body.responsePayload : {},
      tabId: req.body && req.body.tabId != null ? req.body.tabId : null,
      source: req.body && req.body.source ? req.body.source : "whatnot-extension",
      categoryId: req.body && req.body.categoryId != null ? req.body.categoryId : null,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function listWhatnotOrders(req, res) {
  try {
    const result = await getWhatnotOrders({
      clerkUserId: req.auth.userId,
      limit: req.query && req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncWhatnotOrders(req, res) {
  try {
    const result = await syncWhatnotOrdersFromExtension({
      clerkUserId: req.auth.userId,
    });
    return res.status(200).json(result);
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

async function generateWhatnotMediaUploadUrls(req, res) {
  try {
    const result = await generateWhatnotMediaUploadUrlsFromPlatform({
      media: req.body && Array.isArray(req.body.media) ? req.body.media : [],
      fileBase64: req.body && typeof req.body.fileBase64 === "string" ? req.body.fileBase64 : "",
      fileContentType:
        req.body && typeof req.body.fileContentType === "string" ? req.body.fileContentType : "",
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function publishWhatnotInventory(req, res) {
  try {
    const result = await createWhatnotListingFromPlatform({
      title: req.body && typeof req.body.title === "string" ? req.body.title : "",
      description: req.body && typeof req.body.description === "string" ? req.body.description : "",
      quantity: req.body && req.body.quantity != null ? req.body.quantity : null,
      priceUsd: req.body && req.body.priceUsd != null ? req.body.priceUsd : null,
      subcategoryId: req.body && typeof req.body.subcategoryId === "string" ? req.body.subcategoryId : "",
      shippingProfileId:
        req.body && typeof req.body.shippingProfileId === "string" ? req.body.shippingProfileId : "",
      hazmatType: req.body && typeof req.body.hazmatType === "string" ? req.body.hazmatType : "",
      imageId: req.body && typeof req.body.imageId === "string" ? req.body.imageId : "",
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
  getWhatnotInventoryCreateFormOptionsData,
  getWhatnotExtensionStatusData,
  getTikTokCreatorInfoData,
  getTikTokPostStatusData,
  getTikTokProfileData,
  getTikTokVideoAnalyticsData,
  getWhatnotOrders: listWhatnotOrders,
  syncWhatnotOrders,
  listConnections,
  removeConnection,
  saveGetSessionApiDataEntry,
  saveWhatnotInventoryEditCategoriesEntry,
  saveWhatnotShippingProfilesEntry,
  saveWhatnotOrdersEntry,
  saveWhatnotSessionData,
  syncWhatnotInventoryLiveData,
  startConnection,
  whatnotCallback,
  tiktokCallback,
  updateWhatnotBio,
  generateWhatnotMediaUploadUrls,
  publishWhatnotInventory,
};