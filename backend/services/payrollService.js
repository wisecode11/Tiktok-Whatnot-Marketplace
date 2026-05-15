const Attendance = require("../models/Attendance");
const AttendanceSegment = require("../models/AttendanceSegment");
const EmployeeCompensation = require("../models/EmployeeCompensation");
const PayrollRun = require("../models/PayrollRun");
const User = require("../models/Users");

const DEFAULT_HOURLY_RATE_CENTS = 1500;
const DEFAULT_OVERTIME_THRESHOLD_MINUTES_PER_WEEK = 40 * 60; // 2400
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

/**
 * Collect closed-shift records from both attendance models for the period.
 *
 * The staff app writes to the `Attendance` model (one row per user per day,
 * with clock_in_at + clock_out_at + the pre-computed duration_minutes that
 * is also shown on the staff dashboard). Legacy / segment-based imports write
 * to `AttendanceSegment`. We union both so payroll picks up every recorded
 * shift.
 *
 * `duration_minutes` (when present, i.e. on Attendance docs) is the canonical
 * value captured at clock-out time. The payroll calc trusts it, so the seller
 * and the staff see the same hours even if the underlying timestamps were
 * later edited or got out of sync.
 */
async function collectShiftRecords(workspaceId, staffUserIds, periodStart, periodEnd) {
  const [segments, dailyRecords] = await Promise.all([
    AttendanceSegment.find({
      workspace_id: workspaceId,
      user_id: { $in: staffUserIds },
      clock_in_at: { $gte: periodStart, $lte: periodEnd },
    }).lean(),
    Attendance.find({
      workspace_id: workspaceId,
      user_id: { $in: staffUserIds },
      clock_in_at: { $gte: periodStart, $lte: periodEnd },
    }).lean(),
  ]);

  return [
    ...segments.map((s) => ({
      _id: s._id,
      user_id: s.user_id,
      clock_in_at: s.clock_in_at,
      clock_out_at: s.clock_out_at,
      duration_minutes: null,
      source: "segment",
    })),
    ...dailyRecords.map((d) => ({
      _id: d._id,
      user_id: d.user_id,
      clock_in_at: d.clock_in_at,
      clock_out_at: d.clock_out_at,
      duration_minutes: typeof d.duration_minutes === "number" ? d.duration_minutes : null,
      source: "daily",
    })),
  ];
}

/**
 * Resolve the worked minutes for a single shift record.
 * Prefers `duration_minutes` when the record carries it (Attendance daily
 * record). Falls back to clock_out_at − clock_in_at for segments / older
 * records that don't store a duration.
 */
function shiftMinutes(record) {
  if (!record.clock_out_at) {
    return null;
  }

  if (typeof record.duration_minutes === "number" && record.duration_minutes >= 0) {
    return Math.round(record.duration_minutes);
  }

  const diff = record.clock_out_at.getTime() - record.clock_in_at.getTime();
  if (!Number.isFinite(diff) || diff < 0) {
    return 0;
  }

  return Math.round(diff / 60000);
}

/**
 * Bucket a Date into an ISO Monday-start week key in UTC.
 * Returns "YYYY-MM-DD" of the Monday that begins the week.
 */
function weekStartKey(date) {
  const d = new Date(date.getTime());
  const dayFromMonday = (d.getUTCDay() + 6) % 7; // 0 = Mon, 6 = Sun
  d.setUTCDate(d.getUTCDate() - dayFromMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate payroll for a given period using week-based overtime.
 *
 * Behaviour:
 *  - Overtime is calculated per ISO week (Mon-Sun UTC). Default threshold is
 *    40h/week, multiplier 1.5×. Both can be overridden per-staff via
 *    EmployeeCompensation.overtime_threshold_minutes_per_week / overtime_multiplier
 *    once those fields are populated (additive — falls back to defaults).
 *  - Segments without clock_out_at are NOT counted in pay. Instead they are
 *    surfaced in `warnings` so the seller can fix attendance before approving.
 *  - Segments are bucketed by clock_in_at's week. Cross-week shifts are rare
 *    in practice and counted in the week they began.
 */
async function calculatePayrollForPeriod(workspaceId, staffUserIds, periodStart, periodEnd) {
  const attendanceRecords = await collectShiftRecords(
    workspaceId,
    staffUserIds,
    periodStart,
    periodEnd,
  );

  const compensations = await EmployeeCompensation.find({
    workspace_id: workspaceId,
    user_id: { $in: staffUserIds },
  }).lean();

  const compensationMap = Object.fromEntries(
    compensations.map((c) => [c.user_id, c])
  );

  const lines = [];
  const warnings = [];
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  for (const staffId of staffUserIds) {
    const staffAttendance = attendanceRecords.filter((a) => a.user_id === staffId);

    const minutesByWeek = new Map();
    let openShiftCount = 0;

    for (const record of staffAttendance) {
      if (!record.clock_out_at) {
        openShiftCount += 1;
        warnings.push({
          type: "open_shift",
          user_id: staffId,
          segment_id: record._id,
          clock_in_at: record.clock_in_at,
          message: "Shift has no clock-out; hours excluded from payroll.",
        });
        continue;
      }

      const minutes = Math.max(0, shiftMinutes(record));

      if (minutes === 0) {
        continue;
      }

      const key = weekStartKey(record.clock_in_at);
      minutesByWeek.set(key, (minutesByWeek.get(key) || 0) + minutes);
    }

    const compensation = compensationMap[staffId];
    const hourlyRateCents =
      compensation && compensation.hourly_rate_cents
        ? compensation.hourly_rate_cents
        : DEFAULT_HOURLY_RATE_CENTS;
    const overtimeThreshold =
      compensation && compensation.overtime_threshold_minutes_per_week
        ? compensation.overtime_threshold_minutes_per_week
        : DEFAULT_OVERTIME_THRESHOLD_MINUTES_PER_WEEK;
    const overtimeMultiplier =
      compensation && compensation.overtime_multiplier
        ? compensation.overtime_multiplier
        : DEFAULT_OVERTIME_MULTIPLIER;

    if (!compensation) {
      warnings.push({
        type: "missing_compensation",
        user_id: staffId,
        message: `Staff has no compensation record; using default $${(DEFAULT_HOURLY_RATE_CENTS / 100).toFixed(2)}/hr.`,
      });
    }

    let totalMinutes = 0;
    let regularMinutes = 0;
    let overtimeMinutes = 0;

    for (const weekMinutes of minutesByWeek.values()) {
      const reg = Math.min(weekMinutes, overtimeThreshold);
      const ot = Math.max(0, weekMinutes - overtimeThreshold);
      regularMinutes += reg;
      overtimeMinutes += ot;
      totalMinutes += weekMinutes;
    }

    const rateDollars = hourlyRateCents / 100;
    const regularPay = (regularMinutes / 60) * rateDollars;
    const overtimePay = (overtimeMinutes / 60) * rateDollars * overtimeMultiplier;
    const grossCents = Math.round((regularPay + overtimePay) * 100);

    const fixedDeductionCents = (compensation && compensation.deduction_fixed_cents) || 0;
    const percentDeductionCents = Math.round(
      grossCents * (((compensation && compensation.deduction_percent) || 0) / 100)
    );
    const deductionCents = fixedDeductionCents + percentDeductionCents;
    const netCents = Math.max(0, grossCents - deductionCents);

    if (openShiftCount === 0 && totalMinutes === 0) {
      warnings.push({
        type: "zero_hours",
        user_id: staffId,
        message: "Staff has no completed shifts in this period.",
      });
    }

    lines.push({
      user_id: staffId,
      minutes_worked: totalMinutes,
      regular_minutes: regularMinutes,
      overtime_minutes: overtimeMinutes,
      hourly_rate_cents: hourlyRateCents,
      gross_cents: grossCents,
      deduction_cents: deductionCents,
      net_cents: netCents,
    });

    totalGross += grossCents;
    totalDeductions += deductionCents;
    totalNet += netCents;
  }

  return {
    lines,
    totals: {
      total_gross_cents: totalGross,
      total_deductions_cents: totalDeductions,
      total_net_cents: totalNet,
    },
    warnings,
  };
}

/**
 * Get payroll summary for dashboard
 */
async function getPayrollSummary(workspaceId) {
  try {
    const runs = await PayrollRun.find({ workspace_id: workspaceId })
      .sort({ period_end: -1 })
      .limit(12)
      .lean();

    return runs.map((run) => ({
      _id: run._id,
      period_start: run.period_start,
      period_end: run.period_end,
      status: run.status,
      staff_count: run.lines.length,
      total_gross_cents: run.lines.reduce((sum, l) => sum + l.gross_cents, 0),
      total_deductions_cents: run.lines.reduce((sum, l) => sum + l.deduction_cents, 0),
      total_net_cents: run.lines.reduce((sum, l) => sum + l.net_cents, 0),
      qb_synced: run.quickbooks_sync?.synced_at ? true : false,
      qb_journal_id: run.quickbooks_sync?.journal_entry_id,
      created_at: run.created_at,
      updated_at: run.updated_at,
    }));
  } catch (error) {
    throw error;
  }
}

/**
 * Get detailed payroll summary with user names
 */
async function getPayrollWithUserDetails(payrollRunId) {
  try {
    const payrollRun = await PayrollRun.findById(payrollRunId).lean();
    if (!payrollRun) {
      return null;
    }

    const userIds = payrollRun.lines.map((l) => l.user_id);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id, u]));

    const staffDetails = payrollRun.lines.map((line) => {
      const userInfo = userMap[line.user_id] || {};
      return {
        user_id: line.user_id,
        name: userInfo.full_name || "Unknown",
        email: userInfo.email,
        hours_worked: line.minutes_worked / 60,
        regular_hours: line.regular_minutes / 60,
        overtime_hours: line.overtime_minutes / 60,
        hourly_rate_cents: line.hourly_rate_cents,
        gross_cents: line.gross_cents,
        deduction_cents: line.deduction_cents,
        net_cents: line.net_cents,
      };
    });

    const totalGross = payrollRun.lines.reduce((sum, l) => sum + l.gross_cents, 0);
    const totalDeductions = payrollRun.lines.reduce((sum, l) => sum + l.deduction_cents, 0);
    const totalNet = payrollRun.lines.reduce((sum, l) => sum + l.net_cents, 0);

    return {
      _id: payrollRun._id,
      period_start: payrollRun.period_start,
      period_end: payrollRun.period_end,
      status: payrollRun.status,
      staff: staffDetails,
      totals: {
        total_gross_cents: totalGross,
        total_deductions_cents: totalDeductions,
        total_net_cents: totalNet,
      },
      quickbooks_sync: payrollRun.quickbooks_sync || null,
      created_at: payrollRun.created_at,
      updated_at: payrollRun.updated_at,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Export to CSV format
 */
async function exportPayrollToCSV(payrollRunId) {
  try {
    const payrollData = await getPayrollWithUserDetails(payrollRunId);
    if (!payrollData) {
      return null;
    }

    const headers = [
      "Staff Name",
      "Email",
      "Hours Worked",
      "Regular Hours",
      "Overtime Hours",
      "Hourly Rate",
      "Gross Pay",
      "Deductions",
      "Net Pay",
    ];

    const rows = payrollData.staff.map((staff) => [
      staff.name,
      staff.email,
      (staff.hours_worked).toFixed(2),
      (staff.regular_hours).toFixed(2),
      (staff.overtime_hours).toFixed(2),
      (staff.hourly_rate_cents / 100).toFixed(2),
      (staff.gross_cents / 100).toFixed(2),
      (staff.deduction_cents / 100).toFixed(2),
      (staff.net_cents / 100).toFixed(2),
    ]);

    // Add totals row
    rows.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      (payrollData.totals.total_gross_cents / 100).toFixed(2),
      (payrollData.totals.total_deductions_cents / 100).toFixed(2),
      (payrollData.totals.total_net_cents / 100).toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    return csvContent;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  calculatePayrollForPeriod,
  getPayrollSummary,
  getPayrollWithUserDetails,
  exportPayrollToCSV,
};
