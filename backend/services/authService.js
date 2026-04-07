const { createClerkClient } = require("@clerk/backend");

const User = require("../models/Users");
const ConnectedAccount = require("../models/ConnectedAccount");

const ROLE_MAP = {
  streamer: "seller",
  seller: "seller",
  moderator: "moderator",
  admin: "admin",
};

const FRONTEND_ROLE_MAP = {
  seller: "streamer",
  moderator: "moderator",
  admin: "admin",
};

const DASHBOARD_PATHS = {
  streamer: "/seller",
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
  return ROLE_MAP[normalized] ? FRONTEND_ROLE_MAP[ROLE_MAP[normalized]] : null;
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

function getSignupRedirect(role) {
  return role === "admin" ? getDashboardPath(role) : getLaunchPadPath(role);
}

async function getLoginRedirect(user) {
  const role = FRONTEND_ROLE_MAP[user.user_type];

  if (role !== "moderator") {
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
    status: user.status,
    dashboardPath: getDashboardPath(role),
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

async function upsertUserFromClerk({ clerkUserId, role }) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    throw createHttpError(400, "A valid role is required.");
  }

  const clerkUser = await getClerkUser(clerkUserId);
  const email = pickPrimaryEmail(clerkUser);

  if (!email) {
    throw createHttpError(400, "The Clerk user does not have an email address.");
  }

  const userType = toDatabaseRole(normalizedRole);
  const existingUser = await User.findOne({
    $or: [{ clerk_user_id: clerkUser.id }, { email: email.toLowerCase() }],
  });

  const now = new Date();
  const user = existingUser || new User({ created_at: now });

  user.clerk_user_id = clerkUser.id;
  user.email = email.toLowerCase();
  user.first_name = clerkUser.firstName || user.first_name || "";
  user.last_name = clerkUser.lastName || user.last_name || "";
  user.user_type = userType;
  user.status = user.status || "active";
  user.updated_at = now;

  await user.save();
  await updateClerkRole(clerkUser, normalizedRole);

  return {
    user: serializeUser(user),
    redirectTo: getSignupRedirect(normalizedRole),
  };
}

async function loginWithRole({ clerkUserId, role }) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    throw createHttpError(400, "A valid role is required.");
  }

  let user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    const syncResult = await upsertUserFromClerk({ clerkUserId, role: normalizedRole });
    user = await User.findById(syncResult.user.id);
  }

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  if (user.status && user.status !== "active") {
    throw createHttpError(403, "This account is not active.");
  }

  const actualRole = FRONTEND_ROLE_MAP[user.user_type];

  if (actualRole !== normalizedRole) {
    throw createHttpError(403, `This account belongs to the ${actualRole} portal.`, {
      actualRole,
      redirectTo: getDashboardPath(actualRole),
    });
  }

  user.updated_at = new Date();
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
    redirectTo: serializedUser.dashboardPath,
  };
}

module.exports = {
  getCurrentUser,
  getDashboardPath,
  loginWithRole,
  normalizeRole,
  upsertUserFromClerk,
};
