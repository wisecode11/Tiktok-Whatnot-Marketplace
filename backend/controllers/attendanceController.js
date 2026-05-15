const Attendance = require("../models/Attendance");
const User = require("../models/Users");
const WorkspaceMembership = require("../models/WorkspaceMembership");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };
  if (error.details) {
    payload.details = error.details;
  }
  return res.status(status).json(payload);
}

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Build the YYYY-MM-DD date string for "today" in a stable, timezone-aware
 * way (UTC) so records are consistent across server restarts / timezones.
 */
function todayDateString() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Resolve the internal User record + workspace + creator for the
 * currently authenticated clerk user.
 */
async function resolveStaffContext(clerkUserId) {
  const staffUser = await User.findOne({ clerk_user_id: clerkUserId }).lean();
  if (!staffUser) {
    throw createHttpError(404, "Staff user not found.");
  }

  // workspace_id comes from the user's active_workspace_id, or fall back to
  // their WorkspaceMembership record.
  let workspace_id = staffUser.active_workspace_id;

  if (!workspace_id) {
    const membership = await WorkspaceMembership.findOne({
      user_id: staffUser._id,
      status: "active",
    }).lean();

    if (!membership) {
      throw createHttpError(403, "No active workspace found for this staff member.");
    }
    workspace_id = membership.workspace_id;
  }

  // creator_id is the seller/streamer who created this staff account
  const creator_id = staffUser.parent_seller_user_id;
  if (!creator_id) {
    throw createHttpError(403, "Could not resolve the streamer for this staff account.");
  }

  return {
    user_id: staffUser._id,
    workspace_id,
    creator_id,
  };
}

// ── POST /api/attendance/clock-in ─────────────────────────────────────────────
async function clockIn(req, res) {
  try {
    const { user_id, workspace_id, creator_id } = await resolveStaffContext(req.auth.userId);

    const date = todayDateString();
    const now = new Date();

    // Check if already clocked in today
    const existing = await Attendance.findOne({ user_id, date }).lean();

    if (existing) {
      if (existing.status === "clocked_in") {
        return res.status(409).json({
          error: "Already clocked in for today.",
          attendance: existing,
        });
      }
      // Already clocked out — return a clear message
      return res.status(409).json({
        error: "You have already completed your attendance for today.",
        attendance: existing,
      });
    }

    const attendance = await Attendance.create({
      user_id,
      workspace_id,
      creator_id,
      date,
      day: now.getUTCDate(),
      month: now.getUTCMonth() + 1,
      year: now.getUTCFullYear(),
      status: "clocked_in",
      clock_in_at: now,
    });

    return res.status(201).json({ attendance });
  } catch (error) {
    return sendError(res, error);
  }
}

// ── POST /api/attendance/clock-out ────────────────────────────────────────────
async function clockOut(req, res) {
  try {
    const { user_id } = await resolveStaffContext(req.auth.userId);

    const date = todayDateString();
    const now = new Date();

    const attendance = await Attendance.findOne({ user_id, date });

    if (!attendance) {
      return res.status(404).json({ error: "No clock-in found for today. Please clock in first." });
    }

    if (attendance.status === "clocked_out") {
      return res.status(409).json({
        error: "Already clocked out for today.",
        attendance: attendance.toObject(),
      });
    }

    const durationMs = now.getTime() - attendance.clock_in_at.getTime();
    const durationMinutes = Math.round((durationMs / 1000 / 60) * 100) / 100;

    attendance.clock_out_at = now;
    attendance.duration_minutes = durationMinutes;
    attendance.status = "clocked_out";
    await attendance.save();

    return res.status(200).json({ attendance: attendance.toObject() });
  } catch (error) {
    return sendError(res, error);
  }
}

// ── GET /api/attendance/today ─────────────────────────────────────────────────
async function getToday(req, res) {
  try {
    const { user_id } = await resolveStaffContext(req.auth.userId);
    const date = todayDateString();

    const attendance = await Attendance.findOne({ user_id, date }).lean();

    return res.status(200).json({ attendance: attendance || null, date });
  } catch (error) {
    return sendError(res, error);
  }
}

// ── GET /api/attendance/staff/:staffId/monthly  (seller-side) ─────────────────
// Query params: year (number), month (number, 1-12)
// Verifies the requesting seller actually owns/created this staff member.
async function getStaffMonthlyAttendance(req, res) {
  try {
    const { staffId } = req.params;
    const now = new Date();
    const year  = req.query.year  ? Number(req.query.year)  : now.getUTCFullYear();
    const month = req.query.month ? Number(req.query.month) : now.getUTCMonth() + 1;

    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      return res.status(400).json({ error: "Invalid year." });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "Invalid month (1-12)." });
    }

    // Verify the requesting user is a seller
    const sellerUser = await User.findOne({ clerk_user_id: req.auth.userId }).lean();
    if (!sellerUser || sellerUser.user_type !== "seller") {
      return res.status(403).json({ error: "Only sellers can view staff attendance." });
    }

    // Verify the staff member belongs to this seller
    // Try both: direct _id match and as a string comparison
    let staffUser = await User.findOne({ _id: staffId }).lean();
    
    if (!staffUser) {
      // Fallback: try with ObjectId conversion in case it's needed
      staffUser = await User.findOne({ _id: String(staffId) }).lean();
    }

    if (!staffUser) {
      return res.status(404).json({ 
        error: "Staff member not found.",
        debug: { staffId, lookupAttempted: true }
      });
    }

    if (String(staffUser.parent_seller_user_id) !== String(sellerUser._id)) {
      return res.status(403).json({ error: "This staff member does not belong to your account." });
    }

    // Fetch all attendance records for the month, sorted by day asc
    const records = await Attendance.find({ user_id: staffId, year, month })
      .sort({ day: 1 })
      .lean();

    // Aggregate totals
    const totalMinutes = records.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
    const totalDaysPresent = records.length;
    const totalDaysWorked  = records.filter((r) => r.status === "clocked_out").length;

    return res.status(200).json({
      staffId,
      staffName: staffUser.first_name
        ? `${staffUser.first_name} ${staffUser.last_name || ""}`.trim()
        : staffUser.email,
      year,
      month,
      records,
      summary: {
        totalDaysPresent,
        totalDaysWorked,
        totalMinutes: Math.round(totalMinutes * 100) / 100,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { clockIn, clockOut, getToday, getStaffMonthlyAttendance };
