const express = require("express");

const {
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
} = require("../controllers/integrationController");

const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.get("/accounts", authenticateRequest, listConnections);
router.get("/tiktok/creator-info", authenticateRequest, getTikTokCreatorInfoData);
router.get("/tiktok/profile", authenticateRequest, getTikTokProfileData);
router.get("/tiktok/video-analytics", authenticateRequest, getTikTokVideoAnalyticsData);
router.get("/whatnot/inventory-snapshot", authenticateRequest, getWhatnotInventorySnapshotData);
router.post("/tiktok/posts/photo", authenticateRequest, createTikTokPhotoPost);
router.post("/tiktok/posts/status", authenticateRequest, getTikTokPostStatusData);
router.post("/tiktok/posts/video", authenticateRequest, createTikTokVideoPost);
router.post("/connect", authenticateRequest, startConnection);
router.delete("/accounts/:platform", authenticateRequest, removeConnection);
router.get("/stripe/status", authenticateRequest, checkStripeStatus);
router.get("/tiktok/callback", tiktokCallback);
router.get("/whatnot/callback", whatnotCallback);

module.exports = router;