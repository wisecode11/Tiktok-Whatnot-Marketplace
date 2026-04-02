const {
  getCurrentUser,
  loginWithRole,
  upsertUserFromClerk,
} = require("../services/authService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

async function syncUser(req, res) {
  try {
    const result = await upsertUserFromClerk({
      clerkUserId: req.auth.userId,
      role: req.body && req.body.role,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function login(req, res) {
  try {
    const result = await loginWithRole({
      clerkUserId: req.auth.userId,
      role: req.body && req.body.role,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function me(req, res) {
  try {
    const result = await getCurrentUser(req.auth.userId);
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  login,
  me,
  syncUser,
};
