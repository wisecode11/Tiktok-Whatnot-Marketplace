const {
  getModeratorAvailability,
  getOrCreateModeratorProfile,
  getPublicModeratorProfileBySlug,
  getPublicModeratorProfileByUserId,
  listPublicModerators,
  publishModeratorProfile,
  upsertModeratorAvailability,
  upsertModeratorProfile,
} = require("../services/moderatorProfileService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

async function getMyModeratorProfile(req, res) {
  try {
    const result = await getOrCreateModeratorProfile({
      clerkUserId: req.auth.userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateMyModeratorProfile(req, res) {
  try {
    const result = await upsertModeratorProfile({
      clerkUserId: req.auth.userId,
      payload: req.body || {},
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function publishMyModeratorProfile(req, res) {
  try {
    const result = await publishModeratorProfile({
      clerkUserId: req.auth.userId,
      payload: req.body || {},
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getMyAvailability(req, res) {
  try {
    const result = await getModeratorAvailability({
      clerkUserId: req.auth.userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateMyAvailability(req, res) {
  try {
    const result = await upsertModeratorAvailability({
      clerkUserId: req.auth.userId,
      payload: req.body || {},
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getPublicModeratorProfile(req, res) {
  try {
    const result = await getPublicModeratorProfileBySlug({
      slug: req.params.slug,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getPublicModeratorProfileByUser(req, res) {
  try {
    const result = await getPublicModeratorProfileByUserId({
      userId: req.params.userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function listPublicModeratorProfiles(req, res) {
  try {
    const result = await listPublicModerators({
      query: req.query || {},
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getMyAvailability,
  getMyModeratorProfile,
  getPublicModeratorProfile,
  getPublicModeratorProfileByUser,
  listPublicModeratorProfiles,
  publishMyModeratorProfile,
  updateMyAvailability,
  updateMyModeratorProfile,
};
