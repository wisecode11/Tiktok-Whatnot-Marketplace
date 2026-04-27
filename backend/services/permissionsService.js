const User = require("../models/Users");
const SellerWorkspace = require("../models/SellerWorkspace");
const WorkspaceMembership = require("../models/WorkspaceMembership");

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

const DEFAULT_MODULES = [
  "view_inventory",
  "update_stock",
  "add_edit_products",
  "view_orders",
  "packing",
  "labelling",
  "order_status_update",
  "attendance",
];

async function findAuthenticatedSeller(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "Seller account was not found.");
  }

  if (user.user_type !== "seller") {
    throw createHttpError(403, "Only streamers can manage staff permissions.");
  }

  return user;
}

async function ensureSellerWorkspace(seller) {
  const existingWorkspace = await SellerWorkspace.findOne({ owner_user_id: seller._id });

  if (existingWorkspace) {
    return existingWorkspace;
  }

  const now = new Date();
  const workspace = new SellerWorkspace({
    owner_user_id: seller._id,
    business_name: [seller.first_name, seller.last_name].filter(Boolean).join(" ") || seller.email,
    billing_email: seller.email,
    billing_name: [seller.first_name, seller.last_name].filter(Boolean).join(" ") || seller.email,
    status: "trial",
    created_at: now,
    updated_at: now,
  });

  await workspace.save();
  return workspace;
}

function normalizeModules(modules) {
  // Filter to only include valid module names
  if (!Array.isArray(modules)) {
    return [];
  }
  return modules.filter((module) => DEFAULT_MODULES.includes(module));
}

function serializePermissions(membership) {
  const permissions = membership.permissions_json || {};
  return {
    staffId: membership.user_id,
    modules: Array.isArray(permissions.modules) ? permissions.modules : [],
    allModules: DEFAULT_MODULES,
    updatedAt: membership.updated_at,
  };
}

async function getStaffPermissions({ clerkUserId, staffId }) {
  const seller = await findAuthenticatedSeller(clerkUserId);
  const workspace = await ensureSellerWorkspace(seller);

  const membership = await WorkspaceMembership.findOne({
    workspace_id: workspace._id,
    user_id: staffId,
    role: "staff",
  });

  if (!membership) {
    throw createHttpError(404, "Staff member not found in this workspace.");
  }

  return serializePermissions(membership);
}

async function updateStaffPermissions({ clerkUserId, staffId, modules }) {
  const seller = await findAuthenticatedSeller(clerkUserId);
  const workspace = await ensureSellerWorkspace(seller);

  const normalizedModules = normalizeModules(modules);

  const membership = await WorkspaceMembership.findOne({
    workspace_id: workspace._id,
    user_id: staffId,
    role: "staff",
  });

  if (!membership) {
    throw createHttpError(404, "Staff member not found in this workspace.");
  }

  // Update permissions in the permissions_json field
  membership.permissions_json = {
    ...membership.permissions_json,
    modules: normalizedModules,
  };
  membership.updated_at = new Date();

  await membership.save();

  return {
    success: true,
    permissions: serializePermissions(membership),
  };
}

async function getMyPermissions({ clerkUserId }) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  if (user.user_type !== "staff") {
    throw createHttpError(403, "Only staff members can access this endpoint.");
  }

  const membership = await WorkspaceMembership.findOne({
    user_id: user._id,
    role: "staff",
  });

  if (!membership) {
    throw createHttpError(404, "Staff membership not found.");
  }

  let modules =
    membership.permissions_json && Array.isArray(membership.permissions_json.modules)
      ? membership.permissions_json.modules
      : [];

  if (modules.length === 0) {
    modules = [...DEFAULT_MODULES];
  }

  return { modules };
}

module.exports = {
  getStaffPermissions,
  updateStaffPermissions,
  getMyPermissions,
  DEFAULT_MODULES,
};
