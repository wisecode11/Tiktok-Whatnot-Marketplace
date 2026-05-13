const express = require("express");

const {
  checkStripeStatus,
  createTikTokPhotoPost,
  createTikTokVideoPost,
  getWhatnotExtensionStatusData,
  getWhatnotInventoryCreateFormOptionsData,
  getWhatnotLivestreamCategoryTreeData,
  getWhatnotInventoryLiveData,
  getWhatnotInventorySnapshotData,
  getTikTokCreatorInfoData,
  getTikTokPostStatusData,
  getTikTokProfileData,
  getTikTokVideoAnalyticsData,
  searchTikTokShopOrdersData,
  searchTikTokShopPackagesData,
  getTikTokShopOrderDetailData,
  createTikTokShopPackageData,
  splitTikTokShopOrderData,
  shipTikTokPackageData,
  getTikTokFinanceStatementsData,
  getTikTokFinancePaymentsData,
  getTikTokFinanceWithdrawalsData,
  getTikTokFinanceStatementTransactionsData,
  getTikTokFinanceUnsettledOrdersData,
  getWhatnotOrders,
  syncWhatnotOrders,
  listConnections,
  removeConnection,
  saveGetSessionApiDataEntry,
  saveWhatnotInventoryEditCategoriesEntry,
  saveWhatnotLivestreamTagDirectDescendantsEntry,
  saveWhatnotShippingProfilesEntry,
  saveWhatnotOrdersEntry,
  saveWhatnotSessionData,
  syncWhatnotInventoryLiveData,
  syncWhatnotEarlyPayoutBalanceData,
  startConnection,
  whatnotCallback,
  tiktokCallback,
  updateWhatnotBio,
  generateWhatnotMediaUploadUrls,
  publishWhatnotInventory,
  fetchMyLiveStatsData,
  fetchWhatnotShowTabData,
  fetchWhatnotPrimaryShowFormatTagsData,
  scheduleWhatnotShowData,
  fetchWhatnotShipmentsLivestreamsCurrentData,
  fetchWhatnotShipmentsTableData,
} = require("../controllers/integrationController");

const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

function authenticateWhatnotExtension(req, res, next) {
  const configuredKey = (process.env.WHATNOT_EXTENSION_API_KEY || "").trim();
  const incomingKey = String(req.headers["x-whatnot-extension-key"] || "").trim();

  if (!configuredKey) {
    return next();
  }

  if (!incomingKey || incomingKey !== configuredKey) {
    return res.status(401).json({ error: "Unauthorized extension request." });
  }

  return next();
}

router.get("/accounts", authenticateRequest, listConnections);
router.get("/tiktok/creator-info", authenticateRequest, getTikTokCreatorInfoData);
router.get("/tiktok/profile", authenticateRequest, getTikTokProfileData);
router.get("/tiktok/video-analytics", authenticateRequest, getTikTokVideoAnalyticsData);
router.post("/tiktok/shop/orders/search", authenticateRequest, searchTikTokShopOrdersData);
router.post("/tiktok/shop/packages/search", authenticateRequest, searchTikTokShopPackagesData);
router.post("/tiktok/shop/packages", authenticateRequest, createTikTokShopPackageData);
router.post("/tiktok/shop/orders/:orderId/split", authenticateRequest, splitTikTokShopOrderData);
router.post("/tiktok/shop/packages/:packageId/ship", authenticateRequest, shipTikTokPackageData);
router.get("/tiktok/shop/orders/:orderId", authenticateRequest, getTikTokShopOrderDetailData);
router.get("/tiktok/shop/finance/statements", authenticateRequest, getTikTokFinanceStatementsData);
router.get("/tiktok/shop/finance/payments", authenticateRequest, getTikTokFinancePaymentsData);
router.get("/tiktok/shop/finance/withdrawals", authenticateRequest, getTikTokFinanceWithdrawalsData);
router.get(
  "/tiktok/shop/finance/statements/:statementId/transactions",
  authenticateRequest,
  getTikTokFinanceStatementTransactionsData,
);
router.get("/tiktok/shop/finance/orders/unsettled", authenticateRequest, getTikTokFinanceUnsettledOrdersData);
router.get("/whatnot/inventory-snapshot", authenticateRequest, getWhatnotInventorySnapshotData);
router.get("/whatnot/inventory/live", authenticateRequest, getWhatnotInventoryLiveData);
router.get("/whatnot/inventory/create-form-options", authenticateRequest, getWhatnotInventoryCreateFormOptionsData);
router.get("/whatnot/livestream-category-tree", authenticateRequest, getWhatnotLivestreamCategoryTreeData);
router.post("/whatnot/inventory/sync", authenticateRequest, syncWhatnotInventoryLiveData);
router.post("/whatnot/my-live-stats", authenticateRequest, fetchMyLiveStatsData);
router.post("/whatnot/show-tab", authenticateRequest, fetchWhatnotShowTabData);
router.post("/whatnot/show-tab/primary-show-format-tags", authenticateRequest, fetchWhatnotPrimaryShowFormatTagsData);
router.post("/whatnot/show-tab/schedule", authenticateRequest, scheduleWhatnotShowData);
router.get(
  "/whatnot/shipments-livestreams/current",
  authenticateRequest,
  fetchWhatnotShipmentsLivestreamsCurrentData,
);
router.post("/whatnot/shipments/table", authenticateRequest, fetchWhatnotShipmentsTableData);
router.post(
  "/whatnot/finance/early-payout-balance-sync",
  authenticateRequest,
  syncWhatnotEarlyPayoutBalanceData,
);
router.get("/whatnot/extension-status", authenticateRequest, getWhatnotExtensionStatusData);
router.get("/whatnot/orders", authenticateRequest, getWhatnotOrders);
router.post("/whatnot/orders/sync", authenticateRequest, syncWhatnotOrders);
router.post("/tiktok/posts/photo", authenticateRequest, createTikTokPhotoPost);
router.post("/tiktok/posts/status", authenticateRequest, getTikTokPostStatusData);
router.post("/tiktok/posts/video", authenticateRequest, createTikTokVideoPost);
router.post("/connect", authenticateRequest, startConnection);
router.post("/whatnot/seller-sessions", authenticateWhatnotExtension, saveWhatnotSessionData);
router.post("/whatnot/get-session-api-data", authenticateWhatnotExtension, saveGetSessionApiDataEntry);
router.post("/whatnot/inventory-edit-categories", authenticateWhatnotExtension, saveWhatnotInventoryEditCategoriesEntry);
router.post("/whatnot/shipping-profiles", authenticateWhatnotExtension, saveWhatnotShippingProfilesEntry);
router.post(
  "/whatnot/livestream-tag-direct-descendants",
  authenticateWhatnotExtension,
  saveWhatnotLivestreamTagDirectDescendantsEntry,
);
router.post("/whatnot/orders", authenticateWhatnotExtension, saveWhatnotOrdersEntry);
router.post("/whatnot/profile/bio", authenticateRequest, updateWhatnotBio);
router.post("/whatnot/media/upload-urls", authenticateRequest, generateWhatnotMediaUploadUrls);
router.post("/whatnot/inventory/publish", authenticateRequest, publishWhatnotInventory);
router.delete("/accounts/:platform", authenticateRequest, removeConnection);
router.get("/stripe/status", authenticateRequest, checkStripeStatus);
router.get("/tiktok/callback", tiktokCallback);
router.get("/whatnot/callback", whatnotCallback);

module.exports = router;