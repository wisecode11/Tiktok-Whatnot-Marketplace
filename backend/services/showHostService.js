const User = require("../models/Users");
const SellerWorkspace = require("../models/SellerWorkspace");
const WorkspaceMembership = require("../models/WorkspaceMembership");
const WhatnotShowHostAssignment = require("../models/WhatnotShowHostAssignment");
const WhatnotShowSnapshot = require("../models/WhatnotShowSnapshot");

const DEFAULT_SHOW_DURATION_MS = 60 * 60 * 1000;
const ASSIGNED_SHOWS_MODULE = "assigned_shows";

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function findAuthenticatedSeller(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "Seller account was not found.");
  }

  if (user.user_type !== "seller") {
    throw createHttpError(403, "Only streamers can manage show host assignments.");
  }

  return user;
}

async function findAuthenticatedStaff(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "Staff account was not found.");
  }

  if (user.user_type !== "staff") {
    throw createHttpError(403, "Only staff members can access assigned shows.");
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

function buildHostDisplayName(user, membership) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  const username = membership && membership.permissions_json && membership.permissions_json.username
    ? String(membership.permissions_json.username).trim()
    : "";

  if (username) {
    return username;
  }

  return user.email || "Staff member";
}

function getMembershipModules(membership) {
  const permissions = membership && membership.permissions_json ? membership.permissions_json : {};
  return Array.isArray(permissions.modules) ? permissions.modules : [];
}

function resolveAssignmentWindow({ scheduledStartAt, scheduledEndAt }) {
  const start = scheduledStartAt ? new Date(scheduledStartAt) : null;
  const end = scheduledEndAt ? new Date(scheduledEndAt) : null;

  const startValid = start && !Number.isNaN(start.getTime()) ? start : null;
  let endValid = end && !Number.isNaN(end.getTime()) ? end : null;

  if (startValid && !endValid) {
    endValid = new Date(startValid.getTime() + DEFAULT_SHOW_DURATION_MS);
  }

  if (startValid && endValid && endValid.getTime() <= startValid.getTime()) {
    endValid = new Date(startValid.getTime() + DEFAULT_SHOW_DURATION_MS);
  }

  return {
    startAt: startValid,
    endAt: endValid,
  };
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

function buildWhatnotLiveLink(showId) {
  const normalizedShowId = typeof showId === "string" ? showId.trim() : "";
  if (!normalizedShowId) {
    return null;
  }

  return `https://www.whatnot.com/live/${normalizedShowId}`;
}

async function loadWhatnotShowsByIdForWorkspace(workspaceId) {
  const workspace = await SellerWorkspace.findById(workspaceId);
  if (!workspace) {
    return new Map();
  }

  const seller = await User.findById(workspace.owner_user_id);
  if (!seller || !seller.clerk_user_id) {
    return new Map();
  }

  const snapshot = await WhatnotShowSnapshot.findOne({
    platform: "whatnot",
    clerk_user_id: seller.clerk_user_id,
  }).sort({ updated_at: -1 });

  const shows = snapshot && Array.isArray(snapshot.shows_payload) ? snapshot.shows_payload : [];
  const map = new Map();

  for (const show of shows) {
    if (show && show.id) {
      map.set(String(show.id), show);
    }
  }

  return map;
}

function serializeAssignment({ assignment, hostUser, membership, whatnotShow = null }) {
  const showId = assignment.show_id;
  const showLink =
    (typeof assignment.show_link === "string" && assignment.show_link.trim()
      ? assignment.show_link.trim()
      : null) ||
    (whatnotShow && whatnotShow.link ? String(whatnotShow.link) : null) ||
    buildWhatnotLiveLink(showId);

  const showTitle =
    (typeof assignment.show_title === "string" && assignment.show_title.trim()
      ? assignment.show_title.trim()
      : null) ||
    (whatnotShow && whatnotShow.title ? String(whatnotShow.title).trim() : null) ||
    null;

  return {
    showId,
    platform: assignment.platform || "whatnot",
    showTitle,
    showLink,
    showType: whatnotShow && whatnotShow.showType ? String(whatnotShow.showType) : null,
    showStatus: whatnotShow && whatnotShow.status ? String(whatnotShow.status) : null,
    whatnotStartTime: whatnotShow && whatnotShow.startTime != null ? whatnotShow.startTime : null,
    whatnotEndTime: whatnotShow && whatnotShow.endTime != null ? whatnotShow.endTime : null,
    scheduledStartAt: assignment.scheduled_start_at || null,
    scheduledEndAt: assignment.scheduled_end_at || null,
    hostStaffUserId: assignment.host_staff_user_id,
    hostName: hostUser ? buildHostDisplayName(hostUser, membership) : null,
    hostEmail: hostUser && hostUser.email ? hostUser.email : null,
    assignedAt: assignment.assigned_at || assignment.updated_at || null,
    updatedAt: assignment.updated_at || null,
  };
}

async function ensureStaffBelongsToWorkspace({ workspaceId, hostStaffUserId }) {
  const membership = await WorkspaceMembership.findOne({
    workspace_id: workspaceId,
    user_id: hostStaffUserId,
    role: { $in: ["staff", "host"] },
    status: { $in: ["active", "invited"] },
  });

  if (!membership) {
    throw createHttpError(400, "Selected host must be an active staff member in your workspace.");
  }

  const hostUser = await User.findOne({ _id: hostStaffUserId, user_type: "staff" });

  if (!hostUser) {
    throw createHttpError(404, "Staff host account was not found.");
  }

  const modules = getMembershipModules(membership);
  if (!modules.includes(ASSIGNED_SHOWS_MODULE)) {
    throw createHttpError(
      400,
      "Selected staff member does not have Host Shows access. Enable it in Manage Staff → Allow Access first.",
    );
  }

  return { membership, hostUser };
}

async function assertNoHostScheduleConflict({
  workspaceId,
  hostStaffUserId,
  showId,
  scheduledStartAt,
  scheduledEndAt,
}) {
  const window = resolveAssignmentWindow({ scheduledStartAt, scheduledEndAt });

  if (!window.startAt || !window.endAt) {
    throw createHttpError(400, "Show start and end time are required to assign a host.");
  }

  const existingAssignments = await WhatnotShowHostAssignment.find({
    workspace_id: workspaceId,
    host_staff_user_id: hostStaffUserId,
    show_id: { $ne: showId },
    scheduled_start_at: { $ne: null },
  });

  for (const existing of existingAssignments) {
    const existingWindow = resolveAssignmentWindow({
      scheduledStartAt: existing.scheduled_start_at,
      scheduledEndAt: existing.scheduled_end_at,
    });

    if (!existingWindow.startAt || !existingWindow.endAt) {
      continue;
    }

    if (rangesOverlap(window.startAt, window.endAt, existingWindow.startAt, existingWindow.endAt)) {
      throw createHttpError(
        409,
        `This host is already assigned to "${existing.show_title || "another show"}" during this time slot.`,
        {
          conflictingShow: {
            showId: existing.show_id,
            showTitle: existing.show_title || null,
            scheduledStartAt: existing.scheduled_start_at,
            scheduledEndAt: existing.scheduled_end_at,
          },
        },
      );
    }
  }
}

async function listShowHostAssignments({ clerkUserId }) {
  const seller = await findAuthenticatedSeller(clerkUserId);
  const workspace = await ensureSellerWorkspace(seller);

  const [assignments, whatnotShowsById] = await Promise.all([
    WhatnotShowHostAssignment.find({
      workspace_id: workspace._id,
    }).sort({ scheduled_start_at: 1, updated_at: -1 }),
    loadWhatnotShowsByIdForWorkspace(workspace._id),
  ]);

  const hostIds = [...new Set(assignments.map((item) => item.host_staff_user_id).filter(Boolean))];
  const [hostUsers, memberships] = await Promise.all([
    User.find({ _id: { $in: hostIds } }),
    WorkspaceMembership.find({
      workspace_id: workspace._id,
      user_id: { $in: hostIds },
    }),
  ]);

  const hostUserMap = new Map(hostUsers.map((user) => [user._id, user]));
  const membershipMap = new Map(memberships.map((membership) => [membership.user_id, membership]));

  return {
    assignments: assignments.map((assignment) =>
      serializeAssignment({
        assignment,
        hostUser: hostUserMap.get(assignment.host_staff_user_id) || null,
        membership: membershipMap.get(assignment.host_staff_user_id) || null,
        whatnotShow: whatnotShowsById.get(assignment.show_id) || null,
      }),
    ),
  };
}

async function listMyShowAssignments({ clerkUserId }) {
  const staffUser = await findAuthenticatedStaff(clerkUserId);

  const membership = await WorkspaceMembership.findOne({
    user_id: staffUser._id,
    role: "staff",
    status: { $in: ["active", "invited"] },
  });

  if (!membership) {
    throw createHttpError(404, "Staff membership not found.");
  }

  const modules = getMembershipModules(membership);
  if (!modules.includes(ASSIGNED_SHOWS_MODULE)) {
    throw createHttpError(403, "You do not have access to the Host Shows module.");
  }

  const [assignments, whatnotShowsById] = await Promise.all([
    WhatnotShowHostAssignment.find({
      workspace_id: membership.workspace_id,
      host_staff_user_id: staffUser._id,
    }).sort({ scheduled_start_at: 1, updated_at: -1 }),
    loadWhatnotShowsByIdForWorkspace(membership.workspace_id),
  ]);

  return {
    assignments: assignments.map((assignment) =>
      serializeAssignment({
        assignment,
        hostUser: staffUser,
        membership,
        whatnotShow: whatnotShowsById.get(assignment.show_id) || null,
      }),
    ),
  };
}

async function assignShowHost({
  clerkUserId,
  showId,
  hostStaffUserId,
  showTitle,
  scheduledStartAt,
  scheduledEndAt,
  showLink,
  platform = "whatnot",
}) {
  const normalizedShowId = typeof showId === "string" ? showId.trim() : "";
  const normalizedHostStaffUserId = typeof hostStaffUserId === "string" ? hostStaffUserId.trim() : "";

  if (!normalizedShowId) {
    throw createHttpError(400, "showId is required.");
  }

  if (!normalizedHostStaffUserId) {
    throw createHttpError(400, "hostStaffUserId is required.");
  }

  const seller = await findAuthenticatedSeller(clerkUserId);
  const workspace = await ensureSellerWorkspace(seller);
  const { hostUser, membership } = await ensureStaffBelongsToWorkspace({
    workspaceId: workspace._id,
    hostStaffUserId: normalizedHostStaffUserId,
  });

  const window = resolveAssignmentWindow({ scheduledStartAt, scheduledEndAt });

  await assertNoHostScheduleConflict({
    workspaceId: workspace._id,
    hostStaffUserId: normalizedHostStaffUserId,
    showId: normalizedShowId,
    scheduledStartAt: window.startAt,
    scheduledEndAt: window.endAt,
  });

  const now = new Date();
  const assignment = await WhatnotShowHostAssignment.findOneAndUpdate(
    {
      workspace_id: workspace._id,
      platform: typeof platform === "string" && platform.trim() ? platform.trim() : "whatnot",
      show_id: normalizedShowId,
    },
    {
      $set: {
        seller_user_id: seller._id,
        show_title: typeof showTitle === "string" && showTitle.trim() ? showTitle.trim() : null,
        show_link:
          typeof showLink === "string" && showLink.trim()
            ? showLink.trim()
            : buildWhatnotLiveLink(normalizedShowId),
        scheduled_start_at: window.startAt,
        scheduled_end_at: window.endAt,
        host_staff_user_id: normalizedHostStaffUserId,
        assigned_at: now,
        updated_at: now,
      },
      $setOnInsert: {
        created_at: now,
      },
    },
    {
      upsert: true,
      new: true,
    },
  );

  return {
    assignment: serializeAssignment({ assignment, hostUser, membership }),
  };
}

module.exports = {
  assignShowHost,
  listShowHostAssignments,
  listMyShowAssignments,
};
