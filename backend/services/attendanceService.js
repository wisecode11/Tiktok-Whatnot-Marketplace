const User = require("../models/Users");
const SellerWorkspace = require("../models/SellerWorkspace");
const WorkspaceMembership = require("../models/WorkspaceMembership");
const AttendanceSegment = require("../models/AttendanceSegment");
const EmployeeCompensation = require("../models/EmployeeCompensation");
const PayrollRun = require("../models/PayrollRun");

const { DEFAULT_MODULES } = require("./permissionsService");

const WEEKLY_REGULAR_CAP_MINUTES = 40 * 60;

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function resolveWorkspaceContext(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  if (user.user_type === "seller") {
    const workspace = await SellerWorkspace.findOne({ owner_user_id: user._id });

    if (!workspace) {
      throw createHttpError(404, "Workspace was not found.");
    }

    return { user, workspace, role: "seller", membership: null };
  }

  if (user.user_type === "staff") {
    const membership = await WorkspaceMembership.findOne({
      user_id: user._id,
      role: "staff",
      status: "active",
    });

    if (!membership) {
      throw createHttpError(404, "Staff membership was not found.");
    }

    const workspace = await SellerWorkspace.findById(membership.workspace_id);

    if (!workspace) {
      throw createHttpError(404, "Workspace was not found.");
    }

    return { user, workspace, role: "staff", membership };
  }

  throw createHttpError(403, "Attendance is only available for streamers and staff.");
}

function staffHasAttendanceModule(membership) {
  if (!membership || !membership.permissions_json) {
    return false;
  }

  const modules = membership.permissions_json.modules;

  if (!Array.isArray(modules) || modules.length === 0) {
    return DEFAULT_MODULES.includes("attendance");
  }

  return modules.includes("attendance");
}

async function assertStaffAttendanceAccess({ role, membership }) {
  if (role !== "staff") {
    return;
  }

  if (!staffHasAttendanceModule(membership)) {
    throw createHttpError(403, "Attendance module is not enabled for your account.");
  }
}

async function assertSeller(user) {
  if (user.user_type !== "seller") {
    throw createHttpError(403, "Only streamers can perform this action.");
  }
}

function segmentMinutes(segment) {
  if (!segment.clock_out_at) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((segment.clock_out_at.getTime() - segment.clock_in_at.getTime()) / 60000),
  );
}

async function clockIn({ clerkUserId, notes }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertStaffAttendanceAccess(ctx);

  if (ctx.role !== "staff") {
    throw createHttpError(403, "Only staff members can clock in.");
  }

  const open = await AttendanceSegment.findOne({
    workspace_id: ctx.workspace._id,
    user_id: ctx.user._id,
    clock_out_at: null,
  });

  if (open) {
    throw createHttpError(400, "You already have an open clock-in. Clock out first.");
  }

  const now = new Date();
  const segment = new AttendanceSegment({
    workspace_id: ctx.workspace._id,
    user_id: ctx.user._id,
    clock_in_at: now,
    clock_out_at: null,
    notes: typeof notes === "string" ? notes.slice(0, 500) : null,
    created_at: now,
    updated_at: now,
  });

  await segment.save();

  return {
    segment: serializeSegment(segment),
    status: { clockedIn: true, segmentId: segment._id },
  };
}

async function clockOut({ clerkUserId, notes }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertStaffAttendanceAccess(ctx);

  if (ctx.role !== "staff") {
    throw createHttpError(403, "Only staff members can clock out.");
  }

  const open = await AttendanceSegment.findOne({
    workspace_id: ctx.workspace._id,
    user_id: ctx.user._id,
    clock_out_at: null,
  }).sort({ clock_in_at: -1 });

  if (!open) {
    throw createHttpError(400, "No open clock-in found.");
  }

  const now = new Date();

  if (now <= open.clock_in_at) {
    throw createHttpError(400, "Invalid clock-out time.");
  }

  open.clock_out_at = now;
  if (typeof notes === "string" && notes.trim()) {
    open.notes = [open.notes, notes.trim()].filter(Boolean).join(" · ").slice(0, 500);
  }

  open.updated_at = now;
  await open.save();

  return {
    segment: serializeSegment(open),
    status: { clockedIn: false },
  };
}

async function getClockStatus({ clerkUserId }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertStaffAttendanceAccess(ctx);

  if (ctx.role !== "staff") {
    return { clockedIn: false, segment: null };
  }

  const open = await AttendanceSegment.findOne({
    workspace_id: ctx.workspace._id,
    user_id: ctx.user._id,
    clock_out_at: null,
  }).sort({ clock_in_at: -1 });

  return {
    clockedIn: Boolean(open),
    segment: open ? serializeSegment(open) : null,
  };
}

function serializeSegment(segment) {
  return {
    id: segment._id,
    workspaceId: segment.workspace_id,
    userId: segment.user_id,
    clockInAt: segment.clock_in_at.toISOString(),
    clockOutAt: segment.clock_out_at ? segment.clock_out_at.toISOString() : null,
    minutes: segment.clock_out_at ? segmentMinutes(segment) : null,
    notes: segment.notes || null,
  };
}

async function listMySegments({ clerkUserId, from, to }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertStaffAttendanceAccess(ctx);

  if (ctx.role !== "staff") {
    throw createHttpError(403, "Only staff can list personal attendance segments.");
  }

  const range = normalizeRange(from, to);

  const segments = await AttendanceSegment.find({
    workspace_id: ctx.workspace._id,
    user_id: ctx.user._id,
    clock_in_at: { $gte: range.start, $lte: range.end },
  }).sort({ clock_in_at: -1 });

  return { segments: segments.map(serializeSegment) };
}

function normalizeRange(from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw createHttpError(400, "Invalid date range.");
  }

  if (start > end) {
    throw createHttpError(400, "from must be before to.");
  }

  return { start, end };
}

async function listTeamSegments({ clerkUserId, from, to, userId }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertSeller(ctx.user);

  const range = normalizeRange(from, to);

  const query = {
    workspace_id: ctx.workspace._id,
    clock_in_at: { $gte: range.start, $lte: range.end },
  };

  if (userId) {
    query.user_id = userId;
  }

  const segments = await AttendanceSegment.find(query).sort({ clock_in_at: -1 });
  const userIds = [...new Set(segments.map((s) => s.user_id))];
  const users = await User.find({ _id: { $in: userIds } });
  const nameById = new Map(users.map((u) => [u._id, formatUserName(u)]));

  return {
    segments: segments.map((s) => ({
      ...serializeSegment(s),
      memberName: nameById.get(s.user_id) || s.user_id,
    })),
  };
}

function formatUserName(u) {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();

  return n || u.email || u._id;
}

function startOfWeekMonday(d) {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDaysUtc(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

async function getTimesheets({ clerkUserId, weekStarts }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  const weeks = Array.isArray(weekStarts) && weekStarts.length ? weekStarts : [null];

  const results = [];

  for (const ws of weeks) {
    const weekStart = ws ? new Date(ws) : startOfWeekMonday(new Date());

    if (Number.isNaN(weekStart.getTime())) {
      throw createHttpError(400, "Invalid weekStarts entry.");
    }

    const anchor = startOfWeekMonday(weekStart);
    const weekEnd = addDaysUtc(anchor, 7);

    const query = {
      workspace_id: ctx.workspace._id,
      clock_in_at: { $gte: anchor, $lt: weekEnd },
      clock_out_at: { $ne: null },
    };

    if (ctx.role === "staff") {
      await assertStaffAttendanceAccess(ctx);
      query.user_id = ctx.user._id;
    }

    const segments = await AttendanceSegment.find(query);

    const byUser = new Map();

    for (const seg of segments) {
      const mins = segmentMinutes(seg);

      if (!byUser.has(seg.user_id)) {
        byUser.set(seg.user_id, { totalMinutes: 0, segments: [] });
      }

      const row = byUser.get(seg.user_id);
      row.totalMinutes += mins;
      row.segments.push(serializeSegment(seg));
    }

    const userIds = [...byUser.keys()];
    const users = await User.find({ _id: { $in: userIds } });
    const nameById = new Map(users.map((u) => [u._id, formatUserName(u)]));

    const rows = [];

    for (const [uid, data] of byUser.entries()) {
      const regular = Math.min(data.totalMinutes, WEEKLY_REGULAR_CAP_MINUTES);
      const overtime = Math.max(0, data.totalMinutes - WEEKLY_REGULAR_CAP_MINUTES);

      rows.push({
        userId: uid,
        memberName: nameById.get(uid) || uid,
        totalMinutes: data.totalMinutes,
        regularMinutes: regular,
        overtimeMinutes: overtime,
        segments: data.segments,
      });
    }

    results.push({
      weekStart: anchor.toISOString(),
      weekEnd: weekEnd.toISOString(),
      rows,
    });
  }

  if (ctx.role === "staff") {
    return { timesheets: results };
  }

  return { timesheets: results };
}

async function upsertCompensation({ clerkUserId, staffUserId, payload }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertSeller(ctx.user);

  const membership = await WorkspaceMembership.findOne({
    workspace_id: ctx.workspace._id,
    user_id: staffUserId,
    role: "staff",
  });

  if (!membership) {
    throw createHttpError(404, "Staff member not found in this workspace.");
  }

  const now = new Date();
  let record = await EmployeeCompensation.findOne({
    workspace_id: ctx.workspace._id,
    user_id: staffUserId,
  });

  if (!record) {
    record = new EmployeeCompensation({
      workspace_id: ctx.workspace._id,
      user_id: staffUserId,
      created_at: now,
    });
  }

  if (payload.hourly_rate_cents != null) {
    record.hourly_rate_cents = Math.max(0, Math.round(Number(payload.hourly_rate_cents)));
  }

  if (payload.deduction_fixed_cents != null) {
    record.deduction_fixed_cents = Math.max(0, Math.round(Number(payload.deduction_fixed_cents)));
  }

  if (payload.deduction_percent != null) {
    record.deduction_percent = Math.min(100, Math.max(0, Number(payload.deduction_percent)));
  }

  record.updated_at = now;
  await record.save();

  return { compensation: serializeCompensation(record) };
}

function serializeCompensation(c) {
  return {
    userId: c.user_id,
    hourlyRateCents: c.hourly_rate_cents,
    deductionFixedCents: c.deduction_fixed_cents,
    deductionPercent: c.deduction_percent,
    updatedAt: c.updated_at ? c.updated_at.toISOString() : null,
  };
}

async function listCompensations({ clerkUserId }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertSeller(ctx.user);

  const memberships = await WorkspaceMembership.find({
    workspace_id: ctx.workspace._id,
    role: "staff",
    status: "active",
  });

  const staffIds = memberships.map((m) => m.user_id);
  const comps = await EmployeeCompensation.find({
    workspace_id: ctx.workspace._id,
    user_id: { $in: staffIds },
  });

  const compByUser = new Map(comps.map((c) => [c.user_id, c]));
  const users = await User.find({ _id: { $in: staffIds } });

  return {
    compensations: staffIds.map((id) => {
      const u = users.find((x) => x._id === id);
      const c = compByUser.get(id);

      return {
        userId: id,
        memberName: u ? formatUserName(u) : id,
        email: u && u.email,
        ...(c ? serializeCompensation(c) : {
          hourlyRateCents: 1500,
          deductionFixedCents: 0,
          deductionPercent: 0,
          updatedAt: null,
        }),
      };
    }),
  };
}

function computePayForMinutes({ regularMinutes, overtimeMinutes, hourlyRateCents, deductionFixed, deductionPercent }) {
  const regularCents = Math.round((regularMinutes / 60) * hourlyRateCents);
  const overtimeCents = Math.round((overtimeMinutes / 60) * hourlyRateCents * 1.5);
  const grossCents = regularCents + overtimeCents;
  const pct = Math.round((grossCents * deductionPercent) / 100);
  const deductionCents = Math.min(grossCents, deductionFixed + pct);
  const netCents = grossCents - deductionCents;

  return { grossCents, deductionCents, netCents };
}

async function runPayroll({ clerkUserId, periodStart, periodEnd, finalize }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertSeller(ctx.user);

  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  if (Number.isNaN(pStart.getTime()) || Number.isNaN(pEnd.getTime()) || pStart >= pEnd) {
    throw createHttpError(400, "Invalid payroll period.");
  }

  const segments = await AttendanceSegment.find({
    workspace_id: ctx.workspace._id,
    clock_in_at: { $gte: pStart, $lt: pEnd },
    clock_out_at: { $ne: null },
  });

  const minutesByUser = new Map();

  for (const seg of segments) {
    const m = segmentMinutes(seg);
    minutesByUser.set(seg.user_id, (minutesByUser.get(seg.user_id) || 0) + m);
  }

  const memberships = await WorkspaceMembership.find({
    workspace_id: ctx.workspace._id,
    role: "staff",
    status: "active",
  });

  const staffIds = memberships.map((m) => m.user_id);
  const comps = await EmployeeCompensation.find({
    workspace_id: ctx.workspace._id,
    user_id: { $in: staffIds },
  });

  const compByUser = new Map(comps.map((c) => [c.user_id, c]));

  const periodMs = pEnd.getTime() - pStart.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const periodWeeks = Math.max(1, Math.ceil(periodMs / weekMs));
  const regularCapForPeriod = WEEKLY_REGULAR_CAP_MINUTES * periodWeeks;

  const lines = [];

  for (const uid of staffIds) {
    const totalMinutes = minutesByUser.get(uid) || 0;

    if (totalMinutes <= 0) {
      continue;
    }

    const regularMinutes = Math.min(totalMinutes, regularCapForPeriod);
    const overtimeMinutes = Math.max(0, totalMinutes - regularCapForPeriod);
    const comp = compByUser.get(uid);
    const hourlyRateCents = comp ? comp.hourly_rate_cents : 1500;
    const deductionFixed = comp ? comp.deduction_fixed_cents : 0;
    const deductionPercent = comp ? comp.deduction_percent : 0;

    const pay = computePayForMinutes({
      regularMinutes,
      overtimeMinutes,
      hourlyRateCents,
      deductionFixed,
      deductionPercent,
    });

    lines.push({
      user_id: uid,
      minutes_worked: totalMinutes,
      regular_minutes: regularMinutes,
      overtime_minutes: overtimeMinutes,
      hourly_rate_cents: hourlyRateCents,
      gross_cents: pay.grossCents,
      deduction_cents: pay.deductionCents,
      net_cents: pay.netCents,
    });
  }

  const now = new Date();
  const run = new PayrollRun({
    workspace_id: ctx.workspace._id,
    period_start: pStart,
    period_end: pEnd,
    status: finalize ? "finalized" : "draft",
    lines,
    quickbooks_sync: { synced_at: null, realm_id: null, journal_entry_id: null, error: null },
    created_at: now,
    updated_at: now,
  });

  await run.save();

  return { payrollRun: serializePayrollRun(run) };
}

function serializePayrollRun(run) {
  return {
    id: run._id,
    workspaceId: run.workspace_id,
    periodStart: run.period_start.toISOString(),
    periodEnd: run.period_end.toISOString(),
    status: run.status,
    lines: (run.lines || []).map((line) => ({
      userId: line.user_id,
      minutesWorked: line.minutes_worked,
      regularMinutes: line.regular_minutes,
      overtimeMinutes: line.overtime_minutes,
      hourlyRateCents: line.hourly_rate_cents,
      grossCents: line.gross_cents,
      deductionCents: line.deduction_cents,
      netCents: line.net_cents,
    })),
    quickbooksSync: run.quickbooks_sync
      ? {
          syncedAt: run.quickbooks_sync.synced_at ? run.quickbooks_sync.synced_at.toISOString() : null,
          realmId: run.quickbooks_sync.realm_id || null,
          journalEntryId: run.quickbooks_sync.journal_entry_id || null,
          error: run.quickbooks_sync.error || null,
        }
      : null,
    createdAt: run.created_at.toISOString(),
  };
}

async function listPayrollRuns({ clerkUserId }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertSeller(ctx.user);

  const runs = await PayrollRun.find({ workspace_id: ctx.workspace._id })
    .sort({ period_end: -1 })
    .limit(50);

  return { payrollRuns: runs.map(serializePayrollRun) };
}

async function getPayrollRun({ clerkUserId, runId }) {
  const ctx = await resolveWorkspaceContext(clerkUserId);
  await assertSeller(ctx.user);

  const run = await PayrollRun.findOne({
    _id: runId,
    workspace_id: ctx.workspace._id,
  });

  if (!run) {
    throw createHttpError(404, "Payroll run not found.");
  }

  return { payrollRun: serializePayrollRun(run) };
}

module.exports = {
  clockIn,
  clockOut,
  getClockStatus,
  listMySegments,
  listTeamSegments,
  getTimesheets,
  upsertCompensation,
  listCompensations,
  runPayroll,
  listPayrollRuns,
  getPayrollRun,
  assertSeller,
  resolveWorkspaceContext,
};
