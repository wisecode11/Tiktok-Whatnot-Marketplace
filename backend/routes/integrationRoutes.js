const express = require("express");

const {
  checkStripeStatus,
  getTikTokProfileData,
  getTikTokVideoAnalyticsData,
  listConnections,
  removeConnection,
  startConnection,
  tiktokCallback,
} = require("../controllers/integrationController");

const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.get("/accounts", authenticateRequest, listConnections);
router.get("/tiktok/profile", authenticateRequest, getTikTokProfileData);
router.get("/tiktok/video-analytics", authenticateRequest, getTikTokVideoAnalyticsData);
router.post("/connect", authenticateRequest, startConnection);
router.delete("/accounts/:platform", authenticateRequest, removeConnection);
router.get("/stripe/status", authenticateRequest, checkStripeStatus);
router.get("/tiktok/callback", tiktokCallback);

module.exports = router;