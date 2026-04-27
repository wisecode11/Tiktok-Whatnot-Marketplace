const {
  getStaffPermissions,
  updateStaffPermissions,
  getMyPermissions,
} = require("../services/permissionsService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

async function listPermissions(req, res) {
  try {
    const { staffId } = req.params;
    const result = await getStaffPermissions({
      clerkUserId: req.auth.userId,
      staffId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function updatePermissions(req, res) {
  try {
    const { staffId } = req.params;
    const { modules } = req.body || {};

    const result = await updateStaffPermissions({
      clerkUserId: req.auth.userId,
      staffId,
      modules,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function listMyPermissions(req, res) {
  try {
    const result = await getMyPermissions({
      clerkUserId: req.auth.userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  listPermissions,
  updatePermissions,
  listMyPermissions,
};
