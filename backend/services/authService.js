const { createClerkClient } = require("@clerk/backend");

const User = require("../models/Users");
const ConnectedAccount = require("../models/ConnectedAccount");
const SellerWorkspace = require("../models/SellerWorkspace");
const WorkspaceMembership = require("../models/WorkspaceMembership");
const WorkspaceSubscription = require("../models/WorkspaceSubscription");

const ROLE_MAP = {
  streamer: "seller",
  seller: "seller",
  staff: "staff",
  moderator: "moderator",
  admin: "admin",
};

const FRONTEND_ROLE_MAP = {
  seller: "streamer",
  staff: "staff",
  moderator: "moderator",
  admin: "admin",
};

const DASHBOARD_PATHS = {
  streamer: "/seller",
  staff: "/staff",
  moderator: "/moderator",
  admin: "/admin",
};

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function getClerkClient() {
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

function normalizeRole(role) {
  if (!role || typeof role !== "string") {
    return null;
  }

  const normalized = role.trim().toLowerCase();

  if (normalized === "seller") {
    return "streamer";
  }

  if (["streamer", "staff", "moderator", "admin"].includes(normalized)) {
    return normalized;
  }

  return null;
}

function toDatabaseRole(role) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? ROLE_MAP[normalizedRole] : null;
}

function getDashboardPath(role) {
  return DASHBOARD_PATHS[role] || "/login";
}

function getLaunchPadPath(role) {
  return `/launch-pad?role=${role}`;
}

async function getSignupRedirectForUser(user) {
  const role = FRONTEND_ROLE_MAP[user.user_type];

  if (role === "staff") {
    return getDashboardPath(role);
  }

  if (role === "streamer") {
    const organizations = await listSellerWorkspacesForUser(user._id);

    if (organizations.length === 0) {
      return "/seller/setup-organization";
    }

    const hasActiveWorkspace =
      user.active_workspace_id &&
      organizations.some((workspace) => String(workspace._id) === String(user.active_workspace_id));

    if (!hasActiveWorkspace) {
      return "/seller/select-organization";
    }

    return getLaunchPadPath("streamer");
  }

  return getLaunchPadPath(role);
}

function normalizeOrganizationName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrganizationSlug(value) {
  if (typeof value !== "string") {
    return null;
  }

  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || null;
}

function serializeSellerOrganization(workspace, activeWorkspaceId) {
  return {
    id: workspace._id,
    name: workspace.business_name || "",
    slug: workspace.slug || null,
    clerkOrganizationId: workspace.clerk_organization_id || null,
    status: workspace.status || "trial",
    isActive: workspace._id === activeWorkspaceId,
    createdAt: workspace.created_at || null,
  };
}

function mapClerkMembershipRoleToWorkspaceRole(clerkRole) {
  const normalized = typeof clerkRole === "string" ? clerkRole.toLowerCase() : "";
  if (normalized.includes("admin")) {
    return "admin";
  }
  return "staff";
}

async function findWorkspaceByClerkOrganizationId(clerkOrganizationId) {
  if (!clerkOrganizationId) {
    return null;
  }

  return SellerWorkspace.findOne({ clerk_organization_id: clerkOrganizationId });
}

async function ensureStaffLinkedToSellerClerkOrganization({ clerkUserId, user }) {
  if (!user || user.user_type !== "staff" || !user.parent_seller_user_id) {
    return;
  }

  const workspace = await SellerWorkspace.findOne({ owner_user_id: user.parent_seller_user_id });
  const organizationId =
    workspace && typeof workspace.clerk_organization_id === "string"
      ? workspace.clerk_organization_id.trim()
      : "";

  if (!organizationId) {
    return;
  }

  const existingMemberships = await getClerkOrganizationMembershipWorkspaces(clerkUserId);
  const alreadyInOrganization = existingMemberships.some((entry) => entry.organizationId === organizationId);

  if (alreadyInOrganization) {
    return;
  }

  const clerkClient = getClerkClient();

  try {
    await clerkClient.organizations.createOrganizationMembership({
      organizationId,
      userId: clerkUserId,
      role: "org:member",
    });
  } catch (error) {
    const clerkErrors = error && Array.isArray(error.errors) ? error.errors : [];
    const isAlreadyMember = clerkErrors.some((entry) => {
      const code = entry && typeof entry.code === "string" ? entry.code : "";
      return code === "already_a_member_in_organization" || code === "duplicate_record";
    });

    if (!isAlreadyMember) {
      throw error;
    }
  }
}

async function getClerkOrganizationMembershipWorkspaces(clerkUserId) {
  const clerkClient = getClerkClient();
  const memberships = await clerkClient.users.getOrganizationMembershipList({
    userId: clerkUserId,
    limit: 100,
  });

  const entries = memberships && Array.isArray(memberships.data) ? memberships.data : [];
  const resolved = [];

  for (const entry of entries) {
    const organizationId =
      entry && entry.organization && typeof entry.organization.id === "string"
        ? entry.organization.id
        : null;

    if (!organizationId) {
      continue;
    }

    const workspace = await findWorkspaceByClerkOrganizationId(organizationId);
    if (!workspace) {
      continue;
    }

    resolved.push({
      workspace,
      clerkRole: entry.role || null,
      organizationId,
    });
  }

  return resolved;
}

async function revokeDuplicateStaffMemberships({ workspaceId, keepMembershipId, userId, email }) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const duplicateFilters = [];

  if (userId) {
    duplicateFilters.push({ user_id: userId });
  }

  if (normalizedEmail) {
    duplicateFilters.push({ "permissions_json.email": normalizedEmail });
  }

  if (duplicateFilters.length === 0) {
    return;
  }

  await WorkspaceMembership.updateMany(
    {
      workspace_id: workspaceId,
      role: "staff",
      _id: { $ne: keepMembershipId },
      status: { $in: ["invited", "active"] },
      $or: duplicateFilters,
    },
    {
      $set: {
        status: "revoked",
        updated_at: new Date(),
      },
    },
  );
}

async function ensureWorkspaceMembershipForUser({ user, workspace, clerkRole }) {
  if (!user || !workspace) {
    return null;
  }

  const now = new Date();
  const normalizedEmail = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";

  let existingMembership = await WorkspaceMembership.findOne({
    workspace_id: workspace._id,
    user_id: user._id,
    status: { $ne: "revoked" },
  });

  if (!existingMembership && normalizedEmail) {
    existingMembership = await WorkspaceMembership.findOne({
      workspace_id: workspace._id,
      role: "staff",
      status: { $in: ["invited", "active"] },
      "permissions_json.email": normalizedEmail,
    });
  }

  const membershipRole = mapClerkMembershipRoleToWorkspaceRole(clerkRole);
  const resolvedRole = membershipRole === "admin" ? "admin" : "staff";

  if (!existingMembership) {
    const created = new WorkspaceMembership({
      workspace_id: workspace._id,
      user_id: user._id,
      role: resolvedRole,
      permissions_json: {
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        source: "clerk-organization",
      },
      status: "active",
      joined_at: now,
      created_at: now,
      updated_at: now,
    });

    await created.save();
    await revokeDuplicateStaffMemberships({
      workspaceId: workspace._id,
      keepMembershipId: created._id,
      userId: user._id,
      email: normalizedEmail,
    });
    return created;
  }

  existingMembership.user_id = user._id;
  existingMembership.role = resolvedRole;
  existingMembership.status = "active";
  existingMembership.joined_at = existingMembership.joined_at || now;
  existingMembership.updated_at = now;
  existingMembership.permissions_json = {
    ...(existingMembership.permissions_json || {}),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    source: "clerk-organization",
  };
  await existingMembership.save();

  await revokeDuplicateStaffMemberships({
    workspaceId: workspace._id,
    keepMembershipId: existingMembership._id,
    userId: user._id,
    email: normalizedEmail,
  });

  return existingMembership;
}

function getMembershipUserId(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  if (entry.publicUserData && typeof entry.publicUserData.userId === "string") {
    return entry.publicUserData.userId.trim() || null;
  }

  if (entry.public_user_data && typeof entry.public_user_data.user_id === "string") {
    return entry.public_user_data.user_id.trim() || null;
  }

  return null;
}

function getMembershipEmail(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  if (entry.publicUserData && typeof entry.publicUserData.identifier === "string") {
    const value = entry.publicUserData.identifier.trim().toLowerCase();
    return value || null;
  }

  if (entry.public_user_data && typeof entry.public_user_data.identifier === "string") {
    const value = entry.public_user_data.identifier.trim().toLowerCase();
    return value || null;
  }

  return null;
}

async function syncSellerOrganizationMembers({ clerkUserId, clerkOrganizationId }) {
  const user = await loadUserByClerkId(clerkUserId);
  assertSellerRole(user);

  const normalizedOrgId =
    typeof clerkOrganizationId === "string" ? clerkOrganizationId.trim() : "";

  if (!normalizedOrgId) {
    throw createHttpError(400, "clerkOrganizationId is required.");
  }

  const clerkClient = getClerkClient();
  const requesterMemberships = await clerkClient.users.getOrganizationMembershipList({
    userId: clerkUserId,
    limit: 100,
  });

  const requesterMembership = requesterMemberships.data.find((entry) => {
    return entry && entry.organization && entry.organization.id === normalizedOrgId;
  });

  if (!requesterMembership) {
    throw createHttpError(403, "You are not a member of this organization.");
  }

  const organization = await clerkClient.organizations.getOrganization({
    organizationId: normalizedOrgId,
  });

  const now = new Date();
  let workspace = await SellerWorkspace.findOne({
    clerk_organization_id: normalizedOrgId,
  });

  if (!workspace) {
    const initialStatus = await resolveInitialWorkspaceStatusForOwner(user._id);

    workspace = new SellerWorkspace({
      owner_user_id: user._id,
      clerk_organization_id: normalizedOrgId,
      slug: organization.slug || null,
      business_name: organization.name || "Seller Organization",
      billing_email: user.email,
      billing_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
      status: initialStatus,
      created_at: now,
      updated_at: now,
    });
    await workspace.save();
  }

  const membershipsPage = await clerkClient.organizations.getOrganizationMembershipList({
    organizationId: normalizedOrgId,
    limit: 100,
  });
  const membershipEntries = membershipsPage && Array.isArray(membershipsPage.data) ? membershipsPage.data : [];

  let syncedUsers = 0;
  let syncedMemberships = 0;

  const ownerUserId = workspace.owner_user_id ? String(workspace.owner_user_id) : null;

  for (const membership of membershipEntries) {
    const memberClerkUserId = getMembershipUserId(membership);
    const fallbackEmail = getMembershipEmail(membership);

    let clerkMemberUser = null;
    if (memberClerkUserId) {
      clerkMemberUser = await clerkClient.users.getUser(memberClerkUserId).catch(() => null);
    }

    const primaryEmail = clerkMemberUser ? pickPrimaryEmail(clerkMemberUser) : null;
    const email = (primaryEmail || fallbackEmail || "").trim().toLowerCase();

    if (!memberClerkUserId && !email) {
      continue;
    }

    const userLookupFilters = [];
    if (memberClerkUserId) {
      userLookupFilters.push({ clerk_user_id: memberClerkUserId });
    }
    if (email) {
      userLookupFilters.push({ email });
    }

    const existingUser = userLookupFilters.length
      ? await User.findOne({ $or: userLookupFilters })
      : null;

    const memberUser = existingUser || new User({ created_at: now });

    if (memberClerkUserId) {
      memberUser.clerk_user_id = memberClerkUserId;
    }
    if (email) {
      memberUser.email = email;
    }

    const firstName = clerkMemberUser
      ? clerkMemberUser.firstName
      : membership && membership.publicUserData && membership.publicUserData.firstName;
    const lastName = clerkMemberUser
      ? clerkMemberUser.lastName
      : membership && membership.publicUserData && membership.publicUserData.lastName;

    if (typeof firstName === "string" && firstName.trim()) {
      memberUser.first_name = firstName.trim();
    }
    if (typeof lastName === "string" && lastName.trim()) {
      memberUser.last_name = lastName.trim();
    }

    const isWorkspaceOwner =
      ownerUserId && memberUser._id && String(memberUser._id) === ownerUserId;

    if (isWorkspaceOwner) {
      memberUser.user_type = "seller";
      memberUser.parent_seller_user_id = null;
    } else {
      memberUser.user_type = "staff";
      memberUser.parent_seller_user_id = workspace.owner_user_id || memberUser.parent_seller_user_id || null;
    }

    if (!memberUser.status) {
      memberUser.status = "active";
    }

    memberUser.updated_at = now;
    await memberUser.save();
    syncedUsers += 1;

    await ensureWorkspaceMembershipForUser({
      user: memberUser,
      workspace,
      clerkRole: isWorkspaceOwner ? membership && membership.role : "org:member",
    });
    syncedMemberships += 1;
  }

  const invitationsPage = await clerkClient.organizations
    .getOrganizationInvitationList({
      organizationId: normalizedOrgId,
      status: ["pending"],
      limit: 100,
    })
    .catch(() => ({ data: [] }));

  const invitationEntries =
    invitationsPage && Array.isArray(invitationsPage.data) ? invitationsPage.data : [];

  for (const invitation of invitationEntries) {
    const invitedEmail =
      invitation && typeof invitation.emailAddress === "string"
        ? invitation.emailAddress.trim().toLowerCase()
        : "";

    if (!invitedEmail) {
      continue;
    }

    const invitedUser = await User.findOne({ email: invitedEmail });
    if (invitedUser && ownerUserId && String(invitedUser._id) === ownerUserId) {
      continue;
    }

    if (invitedUser) {
      invitedUser.user_type = "staff";
      invitedUser.parent_seller_user_id = workspace.owner_user_id || invitedUser.parent_seller_user_id || null;
      invitedUser.updated_at = now;
      await invitedUser.save();

      const activeMembership = await WorkspaceMembership.findOne({
        workspace_id: workspace._id,
        user_id: invitedUser._id,
        role: "staff",
        status: "active",
      });

      if (activeMembership) {
        await WorkspaceMembership.updateMany(
          {
            workspace_id: workspace._id,
            role: "staff",
            status: "invited",
            _id: { $ne: activeMembership._id },
            $or: [{ user_id: invitedUser._id }, { "permissions_json.email": invitedEmail }],
          },
          { $set: { status: "revoked", updated_at: now } },
        );
        continue;
      }
    }

    const invitationId =
      invitation && typeof invitation.id === "string" ? invitation.id.trim() : null;

    const membershipLookup = {
      workspace_id: workspace._id,
      role: "staff",
      status: { $ne: "revoked" },
      $or: [
        ...(invitationId ? [{ "permissions_json.invitationId": invitationId }] : []),
        { "permissions_json.email": invitedEmail },
        ...(invitedUser ? [{ user_id: invitedUser._id }] : []),
      ],
    };

    let pendingMembership = await WorkspaceMembership.findOne(membershipLookup);

    if (!pendingMembership) {
      pendingMembership = new WorkspaceMembership({
        workspace_id: workspace._id,
        user_id: invitedUser ? invitedUser._id : null,
        role: "staff",
        permissions_json: {
          email: invitedEmail,
          invitationId,
          source: "clerk-organization-invite",
        },
        status: "invited",
        created_at: now,
        updated_at: now,
      });
      await pendingMembership.save();
      syncedMemberships += 1;
      continue;
    }

    if (pendingMembership.status === "active" && pendingMembership.user_id) {
      continue;
    }

    pendingMembership.user_id = invitedUser ? invitedUser._id : pendingMembership.user_id;
    pendingMembership.status = invitedUser && pendingMembership.user_id ? "active" : "invited";
    pendingMembership.role = "staff";
    pendingMembership.joined_at = pendingMembership.joined_at || (pendingMembership.status === "active" ? now : null);
    pendingMembership.permissions_json = {
      ...(pendingMembership.permissions_json || {}),
      email: invitedEmail,
      invitationId,
      source: "clerk-organization-invite",
    };
    pendingMembership.updated_at = now;
    await pendingMembership.save();

    if (pendingMembership.user_id) {
      await revokeDuplicateStaffMemberships({
        workspaceId: workspace._id,
        keepMembershipId: pendingMembership._id,
        userId: pendingMembership.user_id,
        email: invitedEmail,
      });
    }

    syncedMemberships += 1;
  }

  if (!user.active_workspace_id || user.active_workspace_id !== workspace._id) {
    user.active_workspace_id = workspace._id;
    user.updated_at = now;
    await user.save();
  }

  return {
    organization: serializeSellerOrganization(workspace, user.active_workspace_id || workspace._id),
    syncedUsers,
    syncedMemberships,
  };
}

async function listSellerWorkspacesForUser(userId) {
  return SellerWorkspace.find({ owner_user_id: userId }).sort({ created_at: 1, _id: 1 });
}

async function resolveInitialWorkspaceStatusForOwner(ownerUserId) {
  const workspaces = await listSellerWorkspacesForUser(ownerUserId);

  if (workspaces.some((workspace) => workspace.status === "active")) {
    return "active";
  }

  const workspaceIds = workspaces.map((workspace) => workspace._id);
  if (workspaceIds.length === 0) {
    return "trial";
  }

  const activeSubscription = await WorkspaceSubscription.findOne({
    workspace_id: { $in: workspaceIds },
    status: { $in: ["active", "trialing", "past_due", "incomplete"] },
  }).sort({ updated_at: -1, created_at: -1 });

  return activeSubscription ? "active" : "trial";
}

async function resolveActiveSellerWorkspaceForSeller(seller) {
  if (!seller || seller.user_type !== "seller") {
    throw createHttpError(403, "Only seller accounts have workspaces.");
  }

  if (seller.active_workspace_id) {
    const activeWorkspace = await SellerWorkspace.findOne({
      _id: seller.active_workspace_id,
      owner_user_id: seller._id,
    });

    if (activeWorkspace) {
      return activeWorkspace;
    }
  }

  const workspaces = await listSellerWorkspacesForUser(seller._id);
  if (workspaces.length > 0) {
    const fallbackWorkspace = workspaces[0];
    seller.active_workspace_id = fallbackWorkspace._id;
    seller.updated_at = new Date();
    await seller.save();
    return fallbackWorkspace;
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
  seller.active_workspace_id = workspace._id;
  seller.updated_at = now;
  await seller.save();

  return workspace;
}

async function loadUserByClerkId(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  return user;
}

async function updateClerkWorkspaceMetadata({ clerkUserId, workspaceId, organizationId }) {
  const clerkClient = getClerkClient();
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  await clerkClient.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      ...(clerkUser.publicMetadata || {}),
      sellerWorkspaceId: workspaceId || null,
      sellerOrganizationId: organizationId || null,
    },
    privateMetadata: {
      ...(clerkUser.privateMetadata || {}),
      activeSellerWorkspaceId: workspaceId || null,
      activeSellerOrganizationId: organizationId || null,
    },
  });
}

async function getLoginRedirect(user) {
  const role = FRONTEND_ROLE_MAP[user.user_type];

  if (role === "streamer") {
    return "/seller/select-organization";
  }

  if (role !== "moderator" && role !== "admin") {
    return getDashboardPath(role);
  }

  const stripeConnection = await ConnectedAccount.findOne({
    user_id: user._id,
    platform: "stripe",
    status: "connected",
  });

  if (stripeConnection) {
    return getDashboardPath(role);
  }

  return getLaunchPadPath(role);
}

function pickPrimaryEmail(clerkUser) {
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId,
  );

  return (primaryEmail || clerkUser.emailAddresses[0] || {}).emailAddress || null;
}

function clerkUserHasStaffInvite(clerkUser) {
  const parentSellerUserId =
    (clerkUser.privateMetadata && typeof clerkUser.privateMetadata.parentSellerUserId === "string"
      ? clerkUser.privateMetadata.parentSellerUserId.trim()
      : "") ||
    (clerkUser.unsafeMetadata && typeof clerkUser.unsafeMetadata.parentSellerUserId === "string"
      ? clerkUser.unsafeMetadata.parentSellerUserId.trim()
      : "");

  const sellerWorkspaceId =
    (clerkUser.privateMetadata && typeof clerkUser.privateMetadata.sellerWorkspaceId === "string"
      ? clerkUser.privateMetadata.sellerWorkspaceId.trim()
      : "") ||
    (clerkUser.unsafeMetadata && typeof clerkUser.unsafeMetadata.sellerWorkspaceId === "string"
      ? clerkUser.unsafeMetadata.sellerWorkspaceId.trim()
      : "");

  return Boolean(parentSellerUserId || sellerWorkspaceId);
}

async function resolveStaffParentSellerUserId(clerkUser, user) {
  if (user && user.parent_seller_user_id) {
    return user.parent_seller_user_id;
  }

  const parentFromMetadata =
    clerkUser.privateMetadata && typeof clerkUser.privateMetadata.parentSellerUserId === "string"
      ? clerkUser.privateMetadata.parentSellerUserId.trim()
      : clerkUser.unsafeMetadata && typeof clerkUser.unsafeMetadata.parentSellerUserId === "string"
        ? clerkUser.unsafeMetadata.parentSellerUserId.trim()
        : "";

  if (parentFromMetadata) {
    return parentFromMetadata;
  }

  const workspaceId =
    clerkUser.privateMetadata && typeof clerkUser.privateMetadata.sellerWorkspaceId === "string"
      ? clerkUser.privateMetadata.sellerWorkspaceId.trim()
      : clerkUser.unsafeMetadata && typeof clerkUser.unsafeMetadata.sellerWorkspaceId === "string"
        ? clerkUser.unsafeMetadata.sellerWorkspaceId.trim()
        : "";

  if (!workspaceId) {
    return null;
  }

  const workspace = await SellerWorkspace.findById(workspaceId);
  return workspace && workspace.owner_user_id ? workspace.owner_user_id : null;
}

function serializeUser(user) {
  const role = FRONTEND_ROLE_MAP[user.user_type];

  return {
    id: user._id,
    clerkUserId: user.clerk_user_id,
    email: user.email,
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    role,
    backendRole: user.user_type,
    activeWorkspaceId: user.active_workspace_id || null,
    status: user.status,
    dashboardPath: getDashboardPath(role),
  };
}

async function getCurrentUserRedirect(user) {
  const role = FRONTEND_ROLE_MAP[user.user_type];

  if (role === "streamer") {
    const organizations = await listSellerWorkspacesForUser(user._id);

    if (organizations.length === 0) {
      return "/seller/select-organization";
    }

    const hasActiveWorkspace =
      user.active_workspace_id && organizations.some((workspace) => workspace._id === user.active_workspace_id);

    if (!hasActiveWorkspace) {
      return "/seller/select-organization";
    }

    return getDashboardPath(role);
  }

  return getDashboardPath(role);
}

function assertSellerRole(user) {
  if (user.user_type !== "seller") {
    throw createHttpError(403, "Seller organization flow is only available for seller accounts.");
  }
}

async function listSellerOrganizations({ clerkUserId }) {
  const user = await loadUserByClerkId(clerkUserId);
  assertSellerRole(user);

  const organizations = await listSellerWorkspacesForUser(user._id);

  return {
    organizations: organizations.map((workspace) => serializeSellerOrganization(workspace, user.active_workspace_id)),
    activeWorkspaceId: user.active_workspace_id || null,
    hasOrganizations: organizations.length > 0,
  };
}

async function createSellerOrganization({ clerkUserId, name, slug }) {
  const user = await loadUserByClerkId(clerkUserId);
  assertSellerRole(user);

  const normalizedName = normalizeOrganizationName(name);
  const normalizedSlug = normalizeOrganizationSlug(slug) || null;

  if (!normalizedName) {
    throw createHttpError(400, "Organization name is required.");
  }

  const now = new Date();
  const clerkClient = getClerkClient();
  let createdOrganization = null;

  try {
    createdOrganization = await clerkClient.organizations.createOrganization({
      name: normalizedName,
      slug: normalizedSlug || undefined,
      createdBy: clerkUserId,
    });

    const initialStatus = await resolveInitialWorkspaceStatusForOwner(user._id);
    const workspace = new SellerWorkspace({
      owner_user_id: user._id,
      clerk_organization_id: createdOrganization.id,
      slug: normalizedSlug || createdOrganization.slug || null,
      business_name: normalizedName,
      billing_email: user.email,
      billing_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
      status: initialStatus,
      created_at: now,
      updated_at: now,
    });

    await workspace.save();

    const ownerMembership = new WorkspaceMembership({
      workspace_id: workspace._id,
      user_id: user._id,
      role: "admin",
      permissions_json: {
        isOwner: true,
      },
      status: "active",
      joined_at: now,
      created_at: now,
      updated_at: now,
    });

    await ownerMembership.save();

    user.active_workspace_id = workspace._id;
    user.updated_at = now;
    await user.save();

    await updateClerkWorkspaceMetadata({
      clerkUserId,
      workspaceId: workspace._id,
      organizationId: createdOrganization.id,
    });

    return {
      organization: serializeSellerOrganization(workspace, workspace._id),
      redirectTo: getLaunchPadPath("streamer"),
    };
  } catch (error) {
    if (createdOrganization && createdOrganization.id) {
      await clerkClient.organizations.deleteOrganization(createdOrganization.id).catch(() => null);
    }
    const duplicateKeyError = error && error.code === 11000;

    if (duplicateKeyError) {
      throw createHttpError(409, "Organization slug already exists. Please try another one.");
    }

    if (error && error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      const firstError = error.errors[0];
      throw createHttpError(422, firstError.longMessage || firstError.message || "Unable to create organization.");
    }

    throw error;
  }
}

async function activateSellerOrganization({ clerkUserId, workspaceId }) {
  const user = await loadUserByClerkId(clerkUserId);
  assertSellerRole(user);

  if (!workspaceId || typeof workspaceId !== "string") {
    throw createHttpError(400, "workspaceId is required.");
  }

  const workspace = await SellerWorkspace.findOne({
    _id: workspaceId,
    owner_user_id: user._id,
  });

  if (!workspace) {
    throw createHttpError(404, "Organization was not found for this seller.");
  }

  user.active_workspace_id = workspace._id;
  user.updated_at = new Date();
  await user.save();

  await updateClerkWorkspaceMetadata({
    clerkUserId,
    workspaceId: workspace._id,
    organizationId: workspace.clerk_organization_id || null,
  });

  return {
    organization: serializeSellerOrganization(workspace, workspace._id),
    redirectTo: getDashboardPath("streamer"),
  };
}

async function syncSellerActiveOrganization({ clerkUserId, clerkOrganizationId }) {
  const user = await loadUserByClerkId(clerkUserId);
  assertSellerRole(user);

  const normalizedOrgId =
    typeof clerkOrganizationId === "string" ? clerkOrganizationId.trim() : "";

  if (!normalizedOrgId) {
    throw createHttpError(400, "clerkOrganizationId is required.");
  }

  const clerkClient = getClerkClient();
  const memberships = await clerkClient.users.getOrganizationMembershipList({
    userId: clerkUserId,
    limit: 100,
  });

  const membership = memberships.data.find((entry) => {
    return entry && entry.organization && entry.organization.id === normalizedOrgId;
  });

  if (!membership) {
    throw createHttpError(403, "You are not a member of this organization.");
  }

  const organization = await clerkClient.organizations.getOrganization({
    organizationId: normalizedOrgId,
  });

  const now = new Date();
  let workspace = await SellerWorkspace.findOne({
    clerk_organization_id: normalizedOrgId,
  });

  if (!workspace) {
    const initialStatus = await resolveInitialWorkspaceStatusForOwner(user._id);

    workspace = new SellerWorkspace({
      owner_user_id: user._id,
      clerk_organization_id: normalizedOrgId,
      slug: organization.slug || null,
      business_name: organization.name || "Seller Organization",
      billing_email: user.email,
      billing_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
      status: initialStatus,
      created_at: now,
      updated_at: now,
    });

    await workspace.save();
  } else {
    workspace.owner_user_id = workspace.owner_user_id || user._id;
    workspace.business_name = organization.name || workspace.business_name;
    workspace.slug = organization.slug || workspace.slug || null;
    workspace.updated_at = now;
    await workspace.save();
  }

  const existingMembership = await WorkspaceMembership.findOne({
    workspace_id: workspace._id,
    user_id: user._id,
  });

  if (!existingMembership) {
    const ownerMembership = new WorkspaceMembership({
      workspace_id: workspace._id,
      user_id: user._id,
      role: "admin",
      permissions_json: {
        isOwner: true,
      },
      status: "active",
      joined_at: now,
      created_at: now,
      updated_at: now,
    });

    await ownerMembership.save();
  } else {
    existingMembership.role = "admin";
    existingMembership.status = "active";
    existingMembership.updated_at = now;
    existingMembership.joined_at = existingMembership.joined_at || now;
    existingMembership.permissions_json = {
      ...(existingMembership.permissions_json || {}),
      isOwner: true,
    };
    await existingMembership.save();
  }

  user.active_workspace_id = workspace._id;
  user.updated_at = now;
  await user.save();

  await updateClerkWorkspaceMetadata({
    clerkUserId,
    workspaceId: workspace._id,
    organizationId: normalizedOrgId,
  });

  return {
    organization: serializeSellerOrganization(workspace, workspace._id),
    redirectTo: getDashboardPath("streamer"),
  };
}

async function getClerkUser(clerkUserId) {
  const clerkClient = getClerkClient();
  return clerkClient.users.getUser(clerkUserId);
}

async function updateClerkRole(clerkUser, role) {
  const clerkClient = getClerkClient();

  await clerkClient.users.updateUserMetadata(clerkUser.id, {
    publicMetadata: {
      ...(clerkUser.publicMetadata || {}),
      role,
    },
  });
}

function assertSignupRoleAllowed({ normalizedRole, clerkUser }) {
  if (normalizedRole !== "staff") {
    return;
  }

  const parentSellerUserId =
    clerkUser.privateMetadata && typeof clerkUser.privateMetadata.parentSellerUserId === "string"
      ? clerkUser.privateMetadata.parentSellerUserId.trim()
      : "";

  if (!parentSellerUserId) {
    throw createHttpError(
      403,
      "Staff accounts must be created by a streamer. Use the sign-in page with the Staff portal instead.",
      {
        redirectTo: "/login?role=staff",
      },
    );
  }
}

function assertRequestedRoleMatchesExistingUser({ existingUser, normalizedRole }) {
  if (!existingUser || !existingUser.user_type) {
    return;
  }

  const actualRole = FRONTEND_ROLE_MAP[existingUser.user_type];

  if (actualRole !== normalizedRole) {
    throw createHttpError(403, `This account belongs to the ${actualRole} portal.`, {
      actualRole,
      redirectTo: getDashboardPath(actualRole),
    });
  }
}

async function upsertUserFromClerk({ clerkUserId, role }) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    throw createHttpError(400, "A valid role is required.");
  }

  const clerkUser = await getClerkUser(clerkUserId);
  assertSignupRoleAllowed({ normalizedRole, clerkUser });
  const email = pickPrimaryEmail(clerkUser);

  if (!email) {
    throw createHttpError(400, "The Clerk user does not have an email address.");
  }

  const userType = toDatabaseRole(normalizedRole);
  const workspaceMemberships =
    userType === "staff" ? await getClerkOrganizationMembershipWorkspaces(clerkUser.id) : [];
  const primaryWorkspaceMembership = workspaceMemberships.length > 0 ? workspaceMemberships[0] : null;
  const existingUser = await User.findOne({
    $or: [{ clerk_user_id: clerkUser.id }, { email: email.toLowerCase() }],
  });

  assertRequestedRoleMatchesExistingUser({ existingUser, normalizedRole });

  const now = new Date();
  const user = existingUser || new User({ created_at: now });

  user.clerk_user_id = clerkUser.id;
  user.email = email.toLowerCase();
  user.first_name = clerkUser.firstName || user.first_name || "";
  user.last_name = clerkUser.lastName || user.last_name || "";
  user.user_type = userType;
  if (userType === "staff") {
    user.parent_seller_user_id =
      (primaryWorkspaceMembership && primaryWorkspaceMembership.workspace
        ? primaryWorkspaceMembership.workspace.owner_user_id
        : null) ||
      (await resolveStaffParentSellerUserId(clerkUser, user)) ||
      user.parent_seller_user_id ||
      null;
  } else {
    user.parent_seller_user_id = null;
  }
  user.status = user.status || "active";
  user.updated_at = now;

  await user.save();

  if (userType === "staff") {
    await ensureStaffLinkedToSellerClerkOrganization({ clerkUserId: clerkUser.id, user });

    if (primaryWorkspaceMembership && primaryWorkspaceMembership.workspace) {
      await ensureWorkspaceMembershipForUser({
        user,
        workspace: primaryWorkspaceMembership.workspace,
        clerkRole: primaryWorkspaceMembership.clerkRole,
      });
    } else if (user.parent_seller_user_id) {
      const sellerWorkspace = await SellerWorkspace.findOne({ owner_user_id: user.parent_seller_user_id });
      if (sellerWorkspace) {
        await ensureWorkspaceMembershipForUser({
          user,
          workspace: sellerWorkspace,
          clerkRole: "org:member",
        });
      }
    }
  }

  await updateClerkRole(clerkUser, normalizedRole);

  return {
    user: serializeUser(user),
    redirectTo: await getSignupRedirectForUser(user),
  };
}

async function loginWithRole({ clerkUserId, role }) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    throw createHttpError(400, "A valid role is required.");
  }

  let user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    const clerkUser = await getClerkUser(clerkUserId);
    const email = pickPrimaryEmail(clerkUser);

    if (email) {
      const emailMatch = await User.findOne({
        email: email.toLowerCase(),
        user_type: "staff",
      });

      if (emailMatch) {
        emailMatch.clerk_user_id = clerkUserId;
        emailMatch.updated_at = new Date();
        await emailMatch.save();
        user = emailMatch;
      }
    }

    if (!user) {
      if (normalizedRole === "staff") {
        if (!clerkUserHasStaffInvite(clerkUser)) {
          throw createHttpError(
            403,
            "This staff account was not set up by a streamer. Ask your streamer admin to create your account, then sign in here.",
            {
              redirectTo: "/login?role=staff",
            },
          );
        }

        await upsertUserFromClerk({ clerkUserId, role: normalizedRole });
        user = await User.findOne({ clerk_user_id: clerkUserId });
      } else {
        await upsertUserFromClerk({ clerkUserId, role: normalizedRole });
        user = await User.findOne({ clerk_user_id: clerkUserId });
      }
    }
  }

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  if (user.status && user.status !== "active") {
    throw createHttpError(403, "This account is not active.", {
      accountStatus: user.status === "pending" ? "inactive" : user.status,
    });
  }

  const actualRole = FRONTEND_ROLE_MAP[user.user_type];

  if (user.user_type === "staff") {
    if (normalizedRole !== "staff") {
      throw createHttpError(403, "This account belongs to the staff portal.", {
        actualRole: "staff",
        redirectTo: getDashboardPath("staff"),
      });
    }
  } else if (actualRole !== normalizedRole) {
    throw createHttpError(403, `This account belongs to the ${actualRole} portal.`, {
      actualRole,
      redirectTo: getDashboardPath(actualRole),
    });
  }

  user.updated_at = new Date();

  if (user.user_type === "staff") {
    await ensureStaffLinkedToSellerClerkOrganization({ clerkUserId, user });

    const workspaceMemberships = await getClerkOrganizationMembershipWorkspaces(clerkUserId);
    const primaryWorkspaceMembership = workspaceMemberships.length > 0 ? workspaceMemberships[0] : null;

    if (primaryWorkspaceMembership && primaryWorkspaceMembership.workspace) {
      user.parent_seller_user_id = primaryWorkspaceMembership.workspace.owner_user_id || user.parent_seller_user_id || null;
      await ensureWorkspaceMembershipForUser({
        user,
        workspace: primaryWorkspaceMembership.workspace,
        clerkRole: primaryWorkspaceMembership.clerkRole,
      });
    } else if (user.parent_seller_user_id) {
      const sellerWorkspace = await SellerWorkspace.findOne({ owner_user_id: user.parent_seller_user_id });
      if (sellerWorkspace) {
        await ensureWorkspaceMembershipForUser({
          user,
          workspace: sellerWorkspace,
          clerkRole: "org:member",
        });
      }
    }
  }

  await user.save();

  const redirectTo = await getLoginRedirect(user);

  return {
    user: serializeUser(user),
    redirectTo,
  };
}

async function getCurrentUser(clerkUserId) {
  let user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    const clerkUser = await getClerkUser(clerkUserId);
    const role = normalizeRole(
      clerkUser.publicMetadata && clerkUser.publicMetadata.role
        ? clerkUser.publicMetadata.role
        : clerkUser.unsafeMetadata && clerkUser.unsafeMetadata.role,
    );

    if (!role) {
      throw createHttpError(404, "No local account exists for this session.");
    }

    const syncResult = await upsertUserFromClerk({ clerkUserId, role });
    user = await User.findById(syncResult.user.id);
  }

  if (!user) {
    throw createHttpError(404, "No local account exists for this session.");
  }

  const serializedUser = serializeUser(user);
  return {
    user: serializedUser,
    redirectTo: await getCurrentUserRedirect(user),
  };
}

module.exports = {
  activateSellerOrganization,
  createSellerOrganization,
  getCurrentUser,
  getDashboardPath,
  listSellerOrganizations,
  loginWithRole,
  normalizeRole,
  resolveActiveSellerWorkspaceForSeller,
  syncSellerOrganizationMembers,
  syncSellerActiveOrganization,
  upsertUserFromClerk,
};
