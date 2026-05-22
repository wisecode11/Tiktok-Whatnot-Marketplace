const {
  searchTiktokShopOrders,
  searchTiktokShopPackages,
  splitTiktokShopOrder,
  shipTiktokPackage,
  searchTiktokGlobalProducts,
  createTiktokGlobalProduct,
  getTiktokGlobalProduct,
  updateTiktokGlobalProduct202509,
  deleteTiktokGlobalProducts,
  getTiktokShopOrderDetail,
  createTiktokPackage,
  getTiktokFinanceStatements,
  getTiktokFinancePayments,
  getTiktokFinanceWithdrawals,
  getTiktokFinanceStatementTransactions,
  getTiktokFinanceUnsettledOrders,
} = require("../services/tiktokShopService");

const {
  checkStripeAccountStatus,
  createConnectionSession,
  disconnectPlatform,
  getConnectedAccounts,
  getWhatnotExtensionConnectionStatus,
  getLatestWhatnotInventorySnapshot,
  getWhatnotInventoryCreateFormOptions,
  getWhatnotLivestreamCategoryTree,
  getWhatnotReferenceCacheStatus,
  getWhatnotInventorySnapshot,
  getTikTokProfile,
  getTikTokVideoAnalytics,
  getWhatnotOrders,
  syncWhatnotOrdersFromExtension,
  handleWhatnotCallback,
  handleTikTokCallback,
  saveGetSessionApiData,
  saveWhatnotInventorySnapshotsFromExtension,
  saveWhatnotInventoryEditCategories,
  saveWhatnotLivestreamTagDirectDescendants,
  saveWhatnotShippingProfiles,
  saveWhatnotOrders,
  saveWhatnotSellerSession,
  fetchWhatnotInventoryTabDataFromExtension,
  syncWhatnotInventoryFromPlatform,
  syncWhatnotEarlyPayoutBalanceFromPlatform,
  generateWhatnotMediaUploadUrlsFromPlatform,
  createWhatnotListingFromPlatform,
  updateWhatnotBioFromPlatform,
  fetchMyLiveStatsFromExtension,
  fetchWhatnotShowTabDataFromExtension,
  fetchWhatnotPrimaryShowFormatTagsFromExtension,
  scheduleWhatnotShowFromPlatform,
  syncWhatnotReferenceCacheFromExtension,
  fetchWhatnotCurrentLiveIdFromExtension,
  fetchWhatnotShipmentsTable,
} = require("../services/integrationService");
const {
  getTikTokCreatorInfo,
  getTikTokPostStatus,
  publishTikTokPhoto,
  publishTikTokVideo,
} = require("../services/tiktokPostingService");
const {
  createQuickBooksConnectionSession,
  handleQuickBooksCallback,
  syncPayrollRunToQuickBooks,
  downloadPayrollRunPdfFromQuickBooks,
} = require("../services/quickbooksService");

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

async function getWhatnotLivestreamCategoryTreeData(_req, res) {
  try {
    const result = await getWhatnotLivestreamCategoryTree();
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getWhatnotReferenceCacheStatusData(_req, res) {
  try {
    const result = await getWhatnotReferenceCacheStatus();
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function fetchWhatnotInventoryTabData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await fetchWhatnotInventoryTabDataFromExtension({
      clerkUserId: req.auth.userId,
      status: body.status ? body.status : "ACTIVE",
      forceRefresh: Boolean(body.forceRefresh),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncWhatnotInventoryLiveData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const forceRefresh = body.forceRefresh !== false;
    const result = await fetchWhatnotInventoryTabDataFromExtension({
      clerkUserId: req.auth.userId,
      status: body.status ? body.status : "ACTIVE",
      forceRefresh,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveWhatnotInventorySnapshotsEntry(req, res) {
  try {
    const bodyClerkUserId = req.body && typeof req.body.clerkUserId === "string"
      ? req.body.clerkUserId.trim()
      : null;
    const result = await saveWhatnotInventorySnapshotsFromExtension({
      clerkUserId: bodyClerkUserId || (req.auth && req.auth.userId ? req.auth.userId : null),
      status: req.body && req.body.status ? req.body.status : "ACTIVE",
      responsePayload: req.body && req.body.responsePayload ? req.body.responsePayload : {},
      requestPayload: req.body && req.body.requestPayload ? req.body.requestPayload : {},
      tabId: req.body && req.body.tabId != null ? req.body.tabId : null,
      source: req.body && req.body.source ? req.body.source : "whatnot-extension",
    });

    return res.status(200).json({
      success: true,
      savedCount: result.savedCount,
      receivedCount: result.receivedCount,
      status: result.status,
      syncedAt: result.syncedAt,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function fetchMyLiveStatsData(req, res) {
  try {
    const liveId = req.body && typeof req.body.liveId === "string" ? req.body.liveId.trim() : "";
    const result = await fetchMyLiveStatsFromExtension({
      clerkUserId: req.auth.userId,
      liveId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function fetchWhatnotShowTabData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await fetchWhatnotShowTabDataFromExtension({
      clerkUserId: req.auth.userId,
      upcomingShowsCount: body.upcomingShowsCount != null ? Number(body.upcomingShowsCount) : 0,
      forceRefresh: Boolean(body.forceRefresh),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function scheduleWhatnotShowData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await scheduleWhatnotShowFromPlatform({
      clerkUserId: req.auth.userId,
      schedulePayload: body,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncWhatnotReferenceCacheData(req, res) {
  try {
    const result = await syncWhatnotReferenceCacheFromExtension({
      clerkUserId: req.auth.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function fetchWhatnotPrimaryShowFormatTagsData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const result = await fetchWhatnotPrimaryShowFormatTagsFromExtension({
      clerkUserId: req.auth.userId,
      categoryId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function fetchWhatnotShipmentsLivestreamsCurrentData(req, res) {
  try {
    const result = await fetchWhatnotCurrentLiveIdFromExtension({
      clerkUserId: req.auth.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function fetchWhatnotShipmentsTableData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const liveId = typeof body.liveId === "string" ? body.liveId.trim() : "";
    const rawIds = body.shipmentIds;
    const shipmentIds = Array.isArray(rawIds)
      ? rawIds.map((id) => String(id || "").trim()).filter(Boolean)
      : typeof body.shipmentIdsText === "string"
        ? body.shipmentIdsText.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean)
        : null;
    const manifestUrls = Array.isArray(body.manifestUrls)
      ? body.manifestUrls.filter((u) => typeof u === "string" && u.trim())
      : null;
    const forceRefresh = Boolean(body.forceRefresh);
    const result = await fetchWhatnotShipmentsTable({
      clerkUserId: req.auth.userId,
      liveId: liveId || null,
      shipmentIds: shipmentIds && shipmentIds.length ? shipmentIds : null,
      manifestUrls: manifestUrls && manifestUrls.length ? manifestUrls : null,
      forceRefresh,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncWhatnotEarlyPayoutBalanceData(req, res) {
  try {
    const result = await syncWhatnotEarlyPayoutBalanceFromPlatform({
      clerkUserId: req.auth.userId,
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

async function saveWhatnotLivestreamTagDirectDescendantsEntry(req, res) {
  try {
    const result = await saveWhatnotLivestreamTagDirectDescendants({
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

async function searchTikTokShopOrdersData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await searchTiktokShopOrders({
      clerkUserId: req.auth.userId,
      filters: body.filters,
      pageSize: body.pageSize != null ? Number(body.pageSize) : undefined,
      pageToken: typeof body.pageToken === "string" ? body.pageToken : undefined,
      sortOrder: body.sortOrder === "ASC" || body.sortOrder === "DESC" ? body.sortOrder : undefined,
      sortField: typeof body.sortField === "string" ? body.sortField : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function searchTikTokShopPackagesData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await searchTiktokShopPackages({
      clerkUserId: req.auth.userId,
      filters: body.filters,
      pageSize: body.pageSize != null ? Number(body.pageSize) : undefined,
      pageToken: typeof body.pageToken === "string" ? body.pageToken : undefined,
      sortOrder: body.sortOrder === "ASC" || body.sortOrder === "DESC" ? body.sortOrder : undefined,
      sortField: typeof body.sortField === "string" ? body.sortField : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokShopOrderDetailData(req, res) {
  try {
    const rawId =
      typeof req.params.orderId === "string"
        ? req.params.orderId
        : String(req.params.orderId ?? "");
    const result = await getTiktokShopOrderDetail({
      clerkUserId: req.auth.userId,
      orderId: decodeURIComponent(rawId.trim()),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createTikTokShopPackageData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await createTiktokPackage({
      clerkUserId: req.auth.userId,
      shipType: body.ship_type,
      orderId: body.order_id,
      orderLineItems: Array.isArray(body.order_line_item) ? body.order_line_item : [],
      orderListIds: Array.isArray(body.order_list_ids) ? body.order_list_ids : [],
      dimension: body.dimension,
      shippingServiceId: body.shipping_service_id,
      weight: body.weight,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function splitTikTokShopOrderData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const rawId =
      typeof req.params.orderId === "string"
        ? req.params.orderId
        : String(req.params.orderId ?? "");
    const result = await splitTiktokShopOrder({
      clerkUserId: req.auth.userId,
      orderId: decodeURIComponent(rawId.trim()),
      splittableGroups: Array.isArray(body.splittable_groups) ? body.splittable_groups : [],
      splittableGroupsV2: Array.isArray(body.splittable_groups_v2) ? body.splittable_groups_v2 : [],
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function shipTikTokPackageData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const rawId =
      typeof req.params.packageId === "string"
        ? req.params.packageId
        : String(req.params.packageId ?? "");
    const result = await shipTiktokPackage({
      clerkUserId: req.auth.userId,
      packageId: decodeURIComponent(rawId.trim()),
      handoverMethod: body.handover_method,
      pickupSlot: body.pickup_slot,
      selfShipment: body.self_shipment,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/** Proxies TikTok Shop `POST /product/202309/global_products/search` (mock envelope until shop is connected). */
async function searchTikTokGlobalProductsData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await searchTiktokGlobalProducts({
      clerkUserId: req.auth.userId,
      body,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokFinanceStatementsData(req, res) {
  try {
    const query = req.query && typeof req.query === "object" ? req.query : {};
    const result = await getTiktokFinanceStatements({
      clerkUserId: req.auth.userId,
      statementTimeGe: query.statementTimeGe || query.statement_time_ge,
      statementTimeLt: query.statementTimeLt || query.statement_time_lt,
      paymentStatus: query.paymentStatus || query.payment_status,
      pageSize: query.pageSize || query.page_size,
      pageToken: query.pageToken || query.page_token,
      sortOrder: query.sortOrder || query.sort_order,
      sortField: query.sortField || query.sort_field,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createTikTokGlobalProductsData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await createTiktokGlobalProduct({
      clerkUserId: req.auth.userId,
      body,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokFinancePaymentsData(req, res) {
  try {
    const query = req.query && typeof req.query === "object" ? req.query : {};
    const result = await getTiktokFinancePayments({
      clerkUserId: req.auth.userId,
      createTimeGe: query.createTimeGe || query.create_time_ge,
      createTimeLt: query.createTimeLt || query.create_time_lt,
      pageSize: query.pageSize || query.page_size,
      pageToken: query.pageToken || query.page_token,
      sortOrder: query.sortOrder || query.sort_order,
      sortField: query.sortField || query.sort_field,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/** Proxies TikTok Shop `GET /product/202309/products/{product_id}` (mock until shop is connected). */
async function getTikTokGlobalProductData(req, res) {
  try {
    const rawId =
      typeof req.params.productId === "string"
        ? req.params.productId
        : String(req.params.productId ?? "");
    const result = await getTiktokGlobalProduct({
      clerkUserId: req.auth.userId,
      productId: decodeURIComponent(rawId.trim()),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/** Proxies TikTok Shop `PUT /product/202509/products/{product_id}` (mock until shop is connected). */
async function updateTikTokGlobalProduct202509Data(req, res) {
  try {
    const rawId =
      typeof req.params.productId === "string"
        ? req.params.productId
        : String(req.params.productId ?? "");
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await updateTiktokGlobalProduct202509({
      clerkUserId: req.auth.userId,
      productId: decodeURIComponent(rawId.trim()),
      body,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/** Proxies TikTok Shop `DELETE /product/202309/products` (mock until shop is connected). */
async function deleteTikTokGlobalProductsData(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const productIds = Array.isArray(body.product_ids)
      ? body.product_ids
      : Array.isArray(body.productIds)
        ? body.productIds
        : [];

    const result = await deleteTiktokGlobalProducts({
      clerkUserId: req.auth.userId,
      productIds,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokFinanceWithdrawalsData(req, res) {
  try {
    const query = req.query && typeof req.query === "object" ? req.query : {};
    const result = await getTiktokFinanceWithdrawals({
      clerkUserId: req.auth.userId,
      createTimeGe: query.createTimeGe || query.create_time_ge,
      createTimeLt: query.createTimeLt || query.create_time_lt,
      types: query.types,
      pageSize: query.pageSize || query.page_size,
      pageToken: query.pageToken || query.page_token,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokFinanceStatementTransactionsData(req, res) {
  try {
    const query = req.query && typeof req.query === "object" ? req.query : {};
    const result = await getTiktokFinanceStatementTransactions({
      clerkUserId: req.auth.userId,
      statementId: req.params && req.params.statementId ? req.params.statementId : "",
      pageSize: query.pageSize || query.page_size,
      pageToken: query.pageToken || query.page_token,
      sortOrder: query.sortOrder || query.sort_order,
      sortField: query.sortField || query.sort_field,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getTikTokFinanceUnsettledOrdersData(req, res) {
  try {
    const query = req.query && typeof req.query === "object" ? req.query : {};
    const result = await getTiktokFinanceUnsettledOrders({
      clerkUserId: req.auth.userId,
      pageSize: query.pageSize || query.page_size,
      pageToken: query.pageToken || query.page_token,
      sortOrder: query.sortOrder || query.sort_order,
      sortField: query.sortField || query.sort_field,
      searchTimeGe: query.searchTimeGe || query.search_time_ge,
      searchTimeLt: query.searchTimeLt || query.search_time_lt,
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
    const bodyProductAttrs =
      req.body && Array.isArray(req.body.productAttributeValues)
        ? req.body.productAttributeValues
        : null;

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
      productAttributeValues: bodyProductAttrs,
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

async function startQuickBooksConnection(req, res) {
  try {
    const result = await createQuickBooksConnectionSession({
      clerkUserId: req.auth.userId,
      role: req.query && req.query.role ? req.query.role : "streamer",
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function quickBooksCallback(req, res) {
  const result = await handleQuickBooksCallback({
    code: req.query.code,
    state: req.query.state,
    realmId: req.query.realmId,
    error: req.query.error,
    errorDescription: req.query.error_description,
  });

  return res.redirect(result.redirectUrl);
}

async function syncQuickBooksPayrollRun(req, res) {
  try {
    const result = await syncPayrollRunToQuickBooks({
      clerkUserId: req.auth.userId,
      payrollRunId: req.body && req.body.payrollRunId,
      force: Boolean(req.body && req.body.force),
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function downloadQuickBooksPayrollPdf(req, res) {
  try {
    const { pdfBuffer, filename, source } = await downloadPayrollRunPdfFromQuickBooks({
      clerkUserId: req.auth.userId,
      payrollRunId: req.params.payrollRunId,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    if (source) {
      res.setHeader('X-QB-PDF-Source', source);
    }
    return res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  checkStripeStatus,
  createTikTokPhotoPost,
  createTikTokVideoPost,
  getWhatnotInventorySnapshotData,
  getWhatnotInventoryLiveData,
  getWhatnotInventoryCreateFormOptionsData,
  getWhatnotLivestreamCategoryTreeData,
  getWhatnotReferenceCacheStatusData,
  getWhatnotExtensionStatusData,
  getTikTokCreatorInfoData,
  getTikTokPostStatusData,
  getTikTokProfileData,
  getTikTokVideoAnalyticsData,
  searchTikTokShopOrdersData,
  searchTikTokShopPackagesData,
  searchTikTokGlobalProductsData,
  createTikTokGlobalProductsData,
  getTikTokGlobalProductData,
  updateTikTokGlobalProduct202509Data,
  deleteTikTokGlobalProductsData,
  getTikTokShopOrderDetailData,
  createTikTokShopPackageData,
  splitTikTokShopOrderData,
  shipTikTokPackageData,
  getTikTokFinanceStatementsData,
  getTikTokFinancePaymentsData,
  getTikTokFinanceWithdrawalsData,
  getTikTokFinanceStatementTransactionsData,
  getTikTokFinanceUnsettledOrdersData,
  getWhatnotOrders: listWhatnotOrders,
  syncWhatnotOrders,
  listConnections,
  removeConnection,
  saveGetSessionApiDataEntry,
  saveWhatnotInventorySnapshotsEntry,
  saveWhatnotInventoryEditCategoriesEntry,
  saveWhatnotLivestreamTagDirectDescendantsEntry,
  saveWhatnotShippingProfilesEntry,
  saveWhatnotOrdersEntry,
  saveWhatnotSessionData,
  fetchWhatnotInventoryTabData,
  syncWhatnotInventoryLiveData,
  fetchMyLiveStatsData,
  fetchWhatnotShowTabData,
  fetchWhatnotPrimaryShowFormatTagsData,
  scheduleWhatnotShowData,
  syncWhatnotReferenceCacheData,
  fetchWhatnotShipmentsLivestreamsCurrentData,
  fetchWhatnotShipmentsTableData,
  syncWhatnotEarlyPayoutBalanceData,
  startConnection,
  startQuickBooksConnection,
  quickBooksCallback,
  syncQuickBooksPayrollRun,
  downloadQuickBooksPayrollPdf,
  whatnotCallback,
  tiktokCallback,
  updateWhatnotBio,
  generateWhatnotMediaUploadUrls,
  publishWhatnotInventory,
};