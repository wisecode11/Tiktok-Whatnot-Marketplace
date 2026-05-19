const {
  assignShowHost,
  listMyShowAssignments,
  listShowHostAssignments,
} = require("../services/showHostService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

async function listShowHostAssignmentsHandler(req, res) {
  try {
    const result = await listShowHostAssignments({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function assignShowHostHandler(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await assignShowHost({
      clerkUserId: req.auth.userId,
      showId: req.params.showId,
      hostStaffUserId: body.hostStaffUserId,
      showTitle: body.showTitle,
      scheduledStartAt: body.scheduledStartAt,
      scheduledEndAt: body.scheduledEndAt,
      platform: body.platform,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function listMyShowAssignmentsHandler(req, res) {
  try {
    const result = await listMyShowAssignments({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  assignShowHostHandler,
  listMyShowAssignmentsHandler,
  listShowHostAssignmentsHandler,
};
