const {
  activateSellerOrganization,
  createSellerOrganization,
  getCurrentUser,
  listSellerOrganizations,
  loginWithRole,
  syncSellerOrganizationMembers,
  upsertUserFromClerk,
  syncSellerActiveOrganization,
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

async function getSellerOrganizations(req, res) {
  try {
    const result = await listSellerOrganizations({
      clerkUserId: req.auth.userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createSellerOrganizationEntry(req, res) {
  try {
    const result = await createSellerOrganization({
      clerkUserId: req.auth.userId,
      name: req.body && req.body.name,
      slug: req.body && req.body.slug,
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function activateSellerOrganizationEntry(req, res) {
  try {
    const result = await activateSellerOrganization({
      clerkUserId: req.auth.userId,
      workspaceId: req.body && req.body.workspaceId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncSellerActiveOrganizationEntry(req, res) {
  try {
    const result = await syncSellerActiveOrganization({
      clerkUserId: req.auth.userId,
      clerkOrganizationId: req.body && req.body.clerkOrganizationId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncSellerOrganizationMembersEntry(req, res) {
  try {
    const result = await syncSellerOrganizationMembers({
      clerkUserId: req.auth.userId,
      clerkOrganizationId: req.body && req.body.clerkOrganizationId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  activateSellerOrganizationEntry,
  createSellerOrganizationEntry,
  getSellerOrganizations,
  login,
  me,
  syncSellerOrganizationMembersEntry,
  syncSellerActiveOrganizationEntry,
  syncUser,
};
