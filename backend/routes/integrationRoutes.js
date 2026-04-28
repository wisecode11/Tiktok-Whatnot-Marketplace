const express = require("express");

const {
  checkStripeStatus,
  createTikTokPhotoPost,
  createTikTokVideoPost,
  getWhatnotExtensionStatusData,
  getWhatnotInventorySnapshotData,
  getTikTokCreatorInfoData,
  getTikTokPostStatusData,
  getTikTokProfileData,
  getTikTokVideoAnalyticsData,
  listConnections,
  removeConnection,
  saveGetSessionApiDataEntry,
  saveWhatnotSessionData,
  startConnection,
  whatnotCallback,
  tiktokCallback,
  updateWhatnotBio,
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
router.get("/whatnot/inventory-snapshot", authenticateRequest, getWhatnotInventorySnapshotData);
router.get("/whatnot/extension-status", authenticateRequest, getWhatnotExtensionStatusData);
router.post("/tiktok/posts/photo", authenticateRequest, createTikTokPhotoPost);
router.post("/tiktok/posts/status", authenticateRequest, getTikTokPostStatusData);
router.post("/tiktok/posts/video", authenticateRequest, createTikTokVideoPost);
router.post("/connect", authenticateRequest, startConnection);
router.post("/whatnot/seller-sessions", authenticateWhatnotExtension, saveWhatnotSessionData);
router.post("/whatnot/get-session-api-data", authenticateWhatnotExtension, saveGetSessionApiDataEntry);
router.post("/whatnot/profile/bio", authenticateRequest, updateWhatnotBio);
router.delete("/accounts/:platform", authenticateRequest, removeConnection);
router.get("/stripe/status", authenticateRequest, checkStripeStatus);
router.get("/tiktok/callback", tiktokCallback);
router.get("/whatnot/callback", whatnotCallback);

module.exports = router;