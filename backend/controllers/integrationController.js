const {
  checkStripeAccountStatus,
  createConnectionSession,
  disconnectPlatform,
  getConnectedAccounts,
  getTikTokProfile,
  handleTikTokCallback,
} = require("../services/integrationService");

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

async function tiktokCallback(req, res) {
  const result = await handleTikTokCallback({
    code: req.query.code,
    state: req.query.state,
    error: req.query.error,
    errorDescription: req.query.error_description,
  });

  return res.redirect(result.redirectUrl);
}

module.exports = {
  checkStripeStatus,
  getTikTokProfileData,
  listConnections,
  removeConnection,
  startConnection,
  tiktokCallback,
};