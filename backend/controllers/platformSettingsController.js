// controllers/platformSettingsController.js
// Admin endpoints to read and update the global platform settings
// (commission percent, etc.).

const {
  getAdminPlatformSettings,
  getPublicPlatformSettings,
  updateAdminPlatformFeePercent,
} = require("../services/platformSettingsService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };
  if (error.details) {
    payload.details = error.details;
  }
  return res.status(status).json(payload);
}

async function getAdminSettings(req, res) {
  try {
    const result = await getAdminPlatformSettings({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateAdminPlatformFee(req, res) {
  try {
    const platformFeePercent = req.body && req.body.platformFeePercent;
    const result = await updateAdminPlatformFeePercent({
      clerkUserId: req.auth.userId,
      platformFeePercent,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getPublicSettings(_req, res) {
  try {
    const result = await getPublicPlatformSettings();
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getAdminSettings,
  updateAdminPlatformFee,
  getPublicSettings,
};
