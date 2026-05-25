const express = require("express");

const {
  getNotifications,
  patchAllNotificationsRead,
  patchNotificationRead,
} = require("../controllers/notificationController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.get("/", authenticateRequest, getNotifications);
router.patch("/read-all", authenticateRequest, patchAllNotificationsRead);
router.patch("/:notificationId/read", authenticateRequest, patchNotificationRead);

module.exports = router;
