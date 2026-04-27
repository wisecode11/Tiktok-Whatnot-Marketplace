const { createClerkClient } = require("@clerk/backend");

const User = require("../models/Users");
const SellerWorkspace = require("../models/SellerWorkspace");
const WorkspaceMembership = require("../models/WorkspaceMembership");
const { getEmailDeliveryErrorMessage, sendStaffWelcomeEmail } = require("./emailService");

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function normalizeClerkError(error, fallbackMessage) {
  if (error && Array.isArray(error.errors) && error.errors.length > 0) {
    const firstError = error.errors[0];
    return createHttpError(
      422,
      firstError.longMessage || firstError.message || fallbackMessage,
      {
        errors: error.errors,
      },
    );
  }

  return createHttpError(422, fallbackMessage);
}

function getClerkClient() {
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeUsername(username) {
  return typeof username === "string" ? username.trim() : "";
}

function normalizePassword(password) {
  return typeof password === "string" ? password.trim() : "";
}

function buildStaffNameParts(username) {
  const cleaned = normalizeUsername(username).replace(/[._-]+/g, " ").trim();

  if (!cleaned) {
    return {
      firstName: "Staff",
      lastName: "Member",
    };
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Staff",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function buildLoginUrl() {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim();
  return `${frontendUrl.replace(/\/$/, "")}/login?role=staff`;
}

function buildStreamerDisplayName(seller) {
  const fullName = [seller.first_name, seller.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }
  return seller.email || "Streamer";
}

async function findAuthenticatedSeller(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "Seller account was not found.");
  }

  if (user.user_type !== "seller") {
    throw createHttpError(403, "Only streamers can manage staff.");
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

function serializeStaffMember({ user, membership }) {
  return {
    id: user._id,
    clerkUserId: user.clerk_user_id,
    username: membership && membership.permissions_json ? membership.permissions_json.username || null : null,
    email: user.email,
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    role: "staff",
    status: user.status,
    streamerUserId: user.parent_seller_user_id || null,
    workspaceId: membership ? membership.workspace_id : null,
    joinedAt: membership && membership.joined_at ? membership.joined_at : null,
    createdAt: user.created_at || null,
  };
}

async function listStaffMembers({ clerkUserId }) {
  const seller = await findAuthenticatedSeller(clerkUserId);
  const workspace = await ensureSellerWorkspace(seller);

  const memberships = await WorkspaceMembership.find({
    workspace_id: workspace._id,
    role: "staff",
    status: { $in: ["active", "invited"] },
  }).sort({ created_at: -1, joined_at: -1 });

  const userIds = memberships.map((membership) => membership.user_id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = new Map(users.map((user) => [user._id, user]));

  return {
    staff: memberships
      .map((membership) => {
        const user = userMap.get(membership.user_id);
        if (!user) {
          return null;
        }

        return serializeStaffMember({ user, membership });
      })
      .filter(Boolean),
  };
}

async function createStaffMember({ clerkUserId, username, email, password }) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password);
  const { firstName, lastName } = buildStaffNameParts(normalizedUsername);

  if (!normalizedUsername) {
    throw createHttpError(400, "Username is required.");
  }

  if (!normalizedEmail) {
    throw createHttpError(400, "Email is required.");
  }

  if (!normalizedPassword || normalizedPassword.length < 8) {
    throw createHttpError(400, "Password must be at least 8 characters long.");
  }

  const seller = await findAuthenticatedSeller(clerkUserId);
  const workspace = await ensureSellerWorkspace(seller);

  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw createHttpError(409, "A user with this email already exists.");
  }

  const existingMembership = await WorkspaceMembership.findOne({
    workspace_id: workspace._id,
    "permissions_json.username": normalizedUsername,
  });

  if (existingMembership) {
    throw createHttpError(409, "This username is already in use for your team.");
  }

  const clerkClient = getClerkClient();
  let clerkUser = null;

  try {
    clerkUser = await clerkClient.users.createUser({
      emailAddress: [normalizedEmail],
      password: normalizedPassword,
      firstName,
      lastName,
      skipPasswordChecks: true,
      publicMetadata: {
        role: "staff",
        dashboardRole: "streamer",
      },
      privateMetadata: {
        parentSellerUserId: seller._id,
        sellerWorkspaceId: workspace._id,
        role: "staff",
      },
      unsafeMetadata: {
        role: "staff",
        parentSellerUserId: seller._id,
        sellerWorkspaceId: workspace._id,
      },
    });
  } catch (error) {
    throw normalizeClerkError(error, "Unable to create the Clerk staff account.");
  }

  let user = null;
  let membership = null;

  try {
    const now = new Date();
    user = new User({
      clerk_user_id: clerkUser.id,
      email: normalizedEmail,
      first_name: clerkUser.firstName || firstName,
      last_name: clerkUser.lastName || lastName,
      user_type: "staff",
      parent_seller_user_id: seller._id,
      status: "active",
      created_at: now,
      updated_at: now,
    });

    await user.save();

    membership = new WorkspaceMembership({
      workspace_id: workspace._id,
      user_id: user._id,
      role: "staff",
      permissions_json: {
        username: normalizedUsername,
        modules: [],
      },
      status: "active",
      joined_at: now,
      created_at: now,
      updated_at: now,
    });

    await membership.save();

    const loginUrl = buildLoginUrl();
    const streamerName = buildStreamerDisplayName(seller);
    const inviteAlreadySentAt = membership.permissions_json && membership.permissions_json.staff_invite_email_sent_at
      ? membership.permissions_json.staff_invite_email_sent_at
      : null;
    let emailSent = Boolean(inviteAlreadySentAt);
    let emailError = null;

    if (!inviteAlreadySentAt) {
      try {
        await sendStaffWelcomeEmail({
          to: normalizedEmail,
          password: normalizedPassword,
          loginUrl,
          streamerName,
        });

        membership.permissions_json = {
          ...membership.permissions_json,
          staff_invite_email_sent_at: new Date(),
        };
        membership.updated_at = new Date();
        await membership.save();
        emailSent = true;
      } catch (error) {
        emailSent = false;
        emailError = getEmailDeliveryErrorMessage(error);
      }
    }

    return {
      member: serializeStaffMember({ user, membership }),
      emailError,
      emailSent,
      loginUrl,
      message: "Staff member created successfully.",
    };
  } catch (error) {
    if (membership) {
      await WorkspaceMembership.deleteOne({ _id: membership._id }).catch(() => null);
    }

    if (user) {
      await User.deleteOne({ _id: user._id }).catch(() => null);
    }

    if (clerkUser && clerkUser.id) {
      await clerkClient.users.deleteUser(clerkUser.id).catch(() => null);
    }
    throw error;
  }
}

module.exports = {
  createStaffMember,
  listStaffMembers,
};