const {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require("../services/notificationService");

function sendError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({ error: error.message || "Unexpected error." });
}

async function getNotifications(req, res) {
  try {
    const result = await listNotifications({
      clerkUserId: req.auth.userId,
      limit: req.query && req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function patchNotificationRead(req, res) {
  try {
    const result = await markNotificationRead({
      clerkUserId: req.auth.userId,
      notificationId: req.params.notificationId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function patchAllNotificationsRead(req, res) {
  try {
    const result = await markAllNotificationsRead({
      clerkUserId: req.auth.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getNotifications,
  patchAllNotificationsRead,
  patchNotificationRead,
};
