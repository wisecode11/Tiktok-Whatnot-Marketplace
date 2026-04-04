const express = require("express");

const {
  listConnections,
  removeConnection,
  startConnection,
  tiktokCallback,
} = require("../controllers/integrationController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.get("/accounts", authenticateRequest, listConnections);
router.post("/connect", authenticateRequest, startConnection);
router.delete("/accounts/:platform", authenticateRequest, removeConnection);
router.get("/tiktok/callback", tiktokCallback);

module.exports = router;