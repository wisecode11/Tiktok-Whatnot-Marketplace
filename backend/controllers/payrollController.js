const User = require("../models/Users");
const SellerWorkspace = require("../models/SellerWorkspace");
const WorkspaceMembership = require("../models/WorkspaceMembership");
const EmployeeCompensation = require("../models/EmployeeCompensation");
const PayrollRun = require("../models/PayrollRun");
const payrollService = require("../services/payrollService");
const {
  syncPayrollRunToQuickBooks,
  deleteQuickBooksJournalEntryForRun,
} = require("../services/quickbooksService");
const { buildStaffPayslipPdf } = require("../services/payslipPdfService");
const {
  getStaffStripeReadiness,
  createStaffPayrollPaymentIntent,
  confirmStaffPayrollPayment,
} = require("../services/payrollPaymentService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };
  if (error.details) {
    payload.details = error.details;
  }
  return res.status(status).json(payload);
}

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function asIdString(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

/**
 * Parse an inclusive end-of-day Date for a period_end input. "YYYY-MM-DD"
 * normally parses to UTC midnight which would exclude shifts later that day,
 * so we push it to 23:59:59.999 of the same UTC date.
 */
function parseInclusiveEnd(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

function isSameId(left, right) {
  const leftId = asIdString(left);
  const rightId = asIdString(right);

  return leftId !== "" && rightId !== "" && leftId === rightId;
}

/**
 * Get seller context from Clerk auth header
 */
async function getSellerContext(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });
  if (!user || user.user_type !== "seller") {
    throw createHttpError(403, "Only sellers can manage payroll");
  }

  const workspace = await SellerWorkspace.findOne({ owner_user_id: user._id });
  if (!workspace) {
    throw createHttpError(404, "Seller workspace not found");
  }

  return { user, workspace };
}

/**
 * GET /api/payroll/staff-rates
 * Get all staff member compensation rates in workspace
 */
async function getStaffRates(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { user, workspace } = await getSellerContext(clerkUserId);

    // Get all staff members in workspace
    const memberships = await WorkspaceMembership.find({
      workspace_id: workspace._id,
      role: "staff",
      status: "active",
    });

    const staffUserIds = memberships.map((m) => m.user_id);

    // Get compensation for each staff
    const compensations = await EmployeeCompensation.find({
      workspace_id: workspace._id,
      user_id: { $in: staffUserIds },
    });

    // Get user details
    const users = await User.find({ _id: { $in: staffUserIds } });
    const userMap = Object.fromEntries(users.map((u) => [asIdString(u._id), u]));

    const compensationMap = Object.fromEntries(
      compensations.map((comp) => [asIdString(comp.user_id), comp])
    );

    const staffRates = staffUserIds.map((staffUserId) => {
      const staffId = asIdString(staffUserId);
      const comp = compensationMap[staffId];

      const hourlyRateCents = comp?.hourly_rate_cents ?? 1500;
      const deductionFixedCents = comp?.deduction_fixed_cents ?? 0;
      const deductionPercent = comp?.deduction_percent ?? 0;

      return {
        user_id: staffId,
        name: userMap[staffId]?.full_name || userMap[staffId]?.email || "Unknown",
        email: userMap[staffId]?.email,
        hourly_rate_cents: hourlyRateCents,
        hourly_rate: (hourlyRateCents / 100).toFixed(2),
        deduction_fixed_cents: deductionFixedCents,
        deduction_percent: deductionPercent,
      };
    });

    return res.json({
      success: true,
      workspace_id: workspace._id,
      staff: staffRates,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/payroll/staff-rates
 * Update staff member hourly rate and deductions
 */
async function updateStaffRate(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { user, workspace } = await getSellerContext(clerkUserId);
    const { user_id, hourly_rate_cents, deduction_fixed_cents, deduction_percent } = req.body;

    if (!user_id || hourly_rate_cents === undefined) {
      return sendError(res, createHttpError(400, "user_id and hourly_rate_cents are required"));
    }

    const rateCents = Number(hourly_rate_cents);
    if (!Number.isFinite(rateCents) || rateCents <= 0) {
      return sendError(res, createHttpError(400, "hourly_rate_cents must be a positive number"));
    }

    const MAX_HOURLY_RATE_CENTS = 100000; // $1,000/hr cap to prevent typos like 12000
    if (rateCents > MAX_HOURLY_RATE_CENTS) {
      return sendError(
        res,
        createHttpError(
          400,
          `Hourly rate looks too high ($${(rateCents / 100).toFixed(2)}/hr). Maximum allowed is $${(MAX_HOURLY_RATE_CENTS / 100).toFixed(2)}/hr.`,
        ),
      );
    }

    if (deduction_fixed_cents !== undefined) {
      const fixed = Number(deduction_fixed_cents);
      if (!Number.isFinite(fixed) || fixed < 0) {
        return sendError(res, createHttpError(400, "deduction_fixed_cents must be 0 or positive"));
      }
    }

    if (deduction_percent !== undefined) {
      const pct = Number(deduction_percent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return sendError(res, createHttpError(400, "deduction_percent must be between 0 and 100"));
      }
    }

    const membership = await WorkspaceMembership.findOne({
      workspace_id: workspace._id,
      user_id: user_id,
      role: "staff",
      status: "active",
    });

    if (!membership) {
      return sendError(res, createHttpError(404, "Staff member not found in workspace"));
    }

    let compensation = await EmployeeCompensation.findOne({
      workspace_id: workspace._id,
      user_id: user_id,
    });

    if (!compensation) {
      compensation = new EmployeeCompensation({
        workspace_id: workspace._id,
        user_id: user_id,
      });
    }

    compensation.hourly_rate_cents = hourly_rate_cents;
    if (deduction_fixed_cents !== undefined) {
      compensation.deduction_fixed_cents = deduction_fixed_cents;
    }
    if (deduction_percent !== undefined) {
      compensation.deduction_percent = deduction_percent;
    }
    compensation.updated_at = new Date();

    await compensation.save();

    return res.json({
      success: true,
      compensation: {
        user_id: compensation.user_id,
        hourly_rate_cents: compensation.hourly_rate_cents,
        deduction_fixed_cents: compensation.deduction_fixed_cents,
        deduction_percent: compensation.deduction_percent,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/payroll/generate
 * Generate payroll for a given period
 */
async function generatePayroll(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { user, workspace } = await getSellerContext(clerkUserId);
    const { period_start, period_end } = req.body;

    if (!period_start || !period_end) {
      return sendError(res, createHttpError(400, "period_start and period_end are required"));
    }

    const start = new Date(period_start);
    const end = new Date(period_end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return sendError(res, createHttpError(400, "Invalid period dates"));
    }

    if (start > end) {
      return sendError(res, createHttpError(400, "period_start must be on or before period_end"));
    }

    const memberships = await WorkspaceMembership.find({
      workspace_id: workspace._id,
      role: "staff",
      status: "active",
    });

    const staffUserIds = memberships.map((m) => asIdString(m.user_id));

    const { lines, totals, warnings } = await payrollService.calculatePayrollForPeriod(
      workspace._id,
      staffUserIds,
      start,
      end,
    );

    const totalGross = totals.total_gross_cents;
    const totalDeductions = totals.total_deductions_cents;
    const totalNet = totals.total_net_cents;

    const payrollRun = new PayrollRun({
      workspace_id: workspace._id,
      period_start: start,
      period_end: end,
      lines: lines,
      status: "draft",
    });

    await payrollRun.save();

    // Get user details for staff array
    const userIds = lines.map((l) => l.user_id);
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = Object.fromEntries(users.map((u) => [asIdString(u._id), u]));

    const staffDetails = lines.map((line) => {
      const userInfo = userMap[asIdString(line.user_id)] || {};
      return {
        user_id: asIdString(line.user_id),
        name: userInfo.full_name || userInfo.email || "Unknown",
        email: userInfo.email,
        hours_worked: (line.minutes_worked / 60).toFixed(2),
        regular_hours: (line.regular_minutes / 60).toFixed(2),
        overtime_hours: (line.overtime_minutes / 60).toFixed(2),
        hourly_rate: (line.hourly_rate_cents / 100).toFixed(2),
        gross_pay: (line.gross_cents / 100).toFixed(2),
        deductions: (line.deduction_cents / 100).toFixed(2),
        net_pay: (line.net_cents / 100).toFixed(2),
      };
    });

    const userMapForWarnings = userMap;
    const enrichedWarnings = (warnings || []).map((w) => {
      const u = w.user_id ? userMapForWarnings[asIdString(w.user_id)] : null;
      return {
        ...w,
        user_name: u ? u.full_name || u.email || null : null,
      };
    });

    return res.json({
      success: true,
      payroll_run: {
        _id: payrollRun._id,
        workspace_id: payrollRun.workspace_id,
        period_start: payrollRun.period_start,
        period_end: payrollRun.period_end,
        status: payrollRun.status,
        lines: lines,
        staff: staffDetails,
        totals: {
          total_minutes: lines.reduce((sum, l) => sum + l.minutes_worked, 0),
          total_gross_cents: totalGross,
          total_gross: (totalGross / 100).toFixed(2),
          total_deductions_cents: totalDeductions,
          total_deductions: (totalDeductions / 100).toFixed(2),
          total_net_cents: totalNet,
          total_net: (totalNet / 100).toFixed(2),
        },
        warnings: enrichedWarnings,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/payroll/approve
 * Finalize/approve payroll run for QB sync
 */
async function approvePayroll(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { user, workspace } = await getSellerContext(clerkUserId);
    const { payroll_run_id } = req.body;

    if (!payroll_run_id) {
      return sendError(res, createHttpError(400, "payroll_run_id is required"));
    }

    const payrollRun = await PayrollRun.findById(payroll_run_id);
    if (!payrollRun || !isSameId(payrollRun.workspace_id, workspace._id)) {
      return sendError(res, createHttpError(404, "Payroll run not found"));
    }

    payrollRun.status = "finalized";
    payrollRun.updated_at = new Date();
    await payrollRun.save();

    return res.json({
      success: true,
      message: "Payroll approved and ready for QuickBooks sync",
      payroll_run: {
        _id: payrollRun._id,
        status: payrollRun.status,
        updated_at: payrollRun.updated_at,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/payroll/runs
 * Get all payroll runs for workspace
 */
async function getPayrollRuns(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { user, workspace } = await getSellerContext(clerkUserId);

    const payrollRuns = await PayrollRun.find({ workspace_id: workspace._id })
      .sort({ period_end: -1 })
      .lean();

    return res.json({
      success: true,
      payroll_runs: payrollRuns.map((run) => ({
        _id: run._id,
        period_start: run.period_start,
        period_end: run.period_end,
        status: run.status,
        staff_count: run.lines.length,
        total_gross: (
          run.lines.reduce((sum, l) => sum + l.gross_cents, 0) / 100
        ).toFixed(2),
        total_net: (run.lines.reduce((sum, l) => sum + l.net_cents, 0) / 100).toFixed(2),
        qb_synced: run.quickbooks_sync?.synced_at ? true : false,
        qb_journal_entry_id: run.quickbooks_sync?.journal_entry_id || null,
        qb_realm_id: run.quickbooks_sync?.realm_id || null,
        created_at: run.created_at,
      })),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/payroll/runs/:payroll_run_id
 * Get detailed payroll run with all staff details
 */
async function getPayrollRunDetails(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { user, workspace } = await getSellerContext(clerkUserId);
    const { payroll_run_id } = req.params;

    const payrollRun = await PayrollRun.findById(payroll_run_id);
    if (!payrollRun || !isSameId(payrollRun.workspace_id, workspace._id)) {
      return sendError(res, createHttpError(404, "Payroll run not found"));
    }

    // Get user details for each line
    const userIds = payrollRun.lines.map((l) => l.user_id);
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = Object.fromEntries(users.map((u) => [asIdString(u._id), u]));

    const staffDetails = payrollRun.lines.map((line) => {
      const userInfo = userMap[asIdString(line.user_id)] || {};
      return {
        user_id: asIdString(line.user_id),
        name: userInfo.full_name || userInfo.email || "Unknown",
        email: userInfo.email,
        hours_worked: (line.minutes_worked / 60).toFixed(2),
        regular_hours: (line.regular_minutes / 60).toFixed(2),
        overtime_hours: (line.overtime_minutes / 60).toFixed(2),
        hourly_rate: (line.hourly_rate_cents / 100).toFixed(2),
        gross_pay: (line.gross_cents / 100).toFixed(2),
        deductions: (line.deduction_cents / 100).toFixed(2),
        net_pay: (line.net_cents / 100).toFixed(2),
      };
    });

    const totalGross = payrollRun.lines.reduce((sum, l) => sum + l.gross_cents, 0);
    const totalDeductions = payrollRun.lines.reduce((sum, l) => sum + l.deduction_cents, 0);
    const totalNet = payrollRun.lines.reduce((sum, l) => sum + l.net_cents, 0);

    return res.json({
      success: true,
      payroll_run: {
        _id: payrollRun._id,
        period_start: payrollRun.period_start,
        period_end: payrollRun.period_end,
        status: payrollRun.status,
        staff: staffDetails,
        totals: {
          total_gross: (totalGross / 100).toFixed(2),
          total_deductions: (totalDeductions / 100).toFixed(2),
          total_net: (totalNet / 100).toFixed(2),
        },
        qb_sync: payrollRun.quickbooks_sync || null,
        created_at: payrollRun.created_at,
        updated_at: payrollRun.updated_at,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/payroll/preview?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
 * Compute per-staff hours and pay for a period without writing to DB.
 * Also reports whether each staff already has a QuickBooks-synced run for this period.
 */
async function getPayrollPreview(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { workspace } = await getSellerContext(clerkUserId);
    const { period_start, period_end } = req.query;

    if (!period_start || !period_end) {
      return sendError(res, createHttpError(400, "period_start and period_end are required"));
    }

    const start = new Date(period_start);
    const end = parseInclusiveEnd(period_end);
    if (Number.isNaN(start.getTime()) || !end) {
      return sendError(res, createHttpError(400, "Invalid period dates"));
    }
    if (start > end) {
      return sendError(res, createHttpError(400, "period_start must be on or before period_end"));
    }

    const memberships = await WorkspaceMembership.find({
      workspace_id: workspace._id,
      role: "staff",
      status: "active",
    });
    const staffUserIds = memberships.map((m) => asIdString(m.user_id));

    if (staffUserIds.length === 0) {
      return res.json({
        success: true,
        period_start: start,
        period_end: end,
        staff: [],
      });
    }

    const { lines } = await payrollService.calculatePayrollForPeriod(
      workspace._id,
      staffUserIds,
      start,
      end,
    );

    const users = await User.find({ _id: { $in: staffUserIds } });
    const userMap = Object.fromEntries(users.map((u) => [asIdString(u._id), u]));

    const existingRuns = await PayrollRun.find({
      workspace_id: workspace._id,
      target_user_id: { $in: staffUserIds },
      period_start: start,
      period_end: end,
    });
    const runByUser = Object.fromEntries(
      existingRuns.map((r) => [asIdString(r.target_user_id), r]),
    );

    const lineByUser = Object.fromEntries(lines.map((l) => [asIdString(l.user_id), l]));

    const stripeReadinessEntries = await Promise.all(
      staffUserIds.map(async (staffId) => {
        const readiness = await getStaffStripeReadiness(staffId);
        return [asIdString(staffId), readiness];
      }),
    );
    const stripeReadinessByUser = Object.fromEntries(stripeReadinessEntries);

    const staff = staffUserIds.map((staffId) => {
      const line = lineByUser[staffId] || {
        minutes_worked: 0,
        regular_minutes: 0,
        overtime_minutes: 0,
        hourly_rate_cents: 0,
        gross_cents: 0,
        deduction_cents: 0,
        net_cents: 0,
      };
      const userInfo = userMap[staffId] || {};
      const run = runByUser[staffId];
      const isSynced = !!(run && run.quickbooks_sync && run.quickbooks_sync.synced_at);
      const stripePayment = run && run.stripe_payment ? run.stripe_payment : null;
      const paymentStatus = stripePayment && stripePayment.status ? stripePayment.status : null;
      const isPaid = paymentStatus === "paid";
      const stripeReady = stripeReadinessByUser[staffId]?.ready === true;

      return {
        user_id: staffId,
        name: userInfo.full_name || userInfo.email || "Unknown",
        email: userInfo.email || null,
        hours_worked: (line.minutes_worked / 60).toFixed(2),
        regular_hours: (line.regular_minutes / 60).toFixed(2),
        overtime_hours: (line.overtime_minutes / 60).toFixed(2),
        hourly_rate: (line.hourly_rate_cents / 100).toFixed(2),
        gross_pay: (line.gross_cents / 100).toFixed(2),
        deductions: (line.deduction_cents / 100).toFixed(2),
        net_pay: (line.net_cents / 100).toFixed(2),
        can_download: line.minutes_worked > 0 && line.gross_cents > 0,
        already_downloaded: isSynced,
        qb_journal_entry_id:
          (run && run.quickbooks_sync && run.quickbooks_sync.journal_entry_id) || null,
        qb_realm_id: (run && run.quickbooks_sync && run.quickbooks_sync.realm_id) || null,
        payroll_run_id: run ? run._id : null,
        staff_stripe_ready: stripeReady,
        staff_stripe_message: stripeReadinessByUser[staffId]?.message || null,
        payment_status: paymentStatus,
        payment_paid_at:
          stripePayment && stripePayment.paid_at
            ? new Date(stripePayment.paid_at).toISOString()
            : null,
        stripe_invoice_id: (stripePayment && stripePayment.invoice_id) || null,
        stripe_hosted_invoice_url:
          (stripePayment && stripePayment.hosted_invoice_url) || null,
        stripe_invoice_pdf_url: (stripePayment && stripePayment.invoice_pdf_url) || null,
        can_pay_now:
          line.minutes_worked > 0 &&
          line.net_cents > 0 &&
          stripeReady &&
          !isPaid,
      };
    });

    return res.json({
      success: true,
      period_start: start,
      period_end: end,
      staff,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/payroll/staff/:userId/issue-and-download
 * One-click flow for the seller:
 *   1. Find or create a single-staff PayrollRun for the period
 *   2. Finalize it
 *   3. Sync to QuickBooks (idempotent — re-uses existing journal entry on repeat calls)
 *   4. Stream the official QuickBooks PDF back as a file download
 *
 * Body: { period_start, period_end }
 * Response: application/pdf binary
 */
async function issueAndDownloadStaffPayroll(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { workspace } = await getSellerContext(clerkUserId);
    const { userId } = req.params;
    const { period_start, period_end } = req.body || {};

    if (!userId || !period_start || !period_end) {
      return sendError(
        res,
        createHttpError(400, "userId, period_start and period_end are required"),
      );
    }

    const start = new Date(period_start);
    const end = parseInclusiveEnd(period_end);
    if (Number.isNaN(start.getTime()) || !end) {
      return sendError(res, createHttpError(400, "Invalid period dates"));
    }
    if (start > end) {
      return sendError(res, createHttpError(400, "period_start must be on or before period_end"));
    }

    const membership = await WorkspaceMembership.findOne({
      workspace_id: workspace._id,
      user_id: userId,
      role: "staff",
      status: "active",
    });
    if (!membership) {
      return sendError(res, createHttpError(404, "Staff member not found in workspace"));
    }

    // Always recompute from latest attendance/rates so the PDF and the
    // seller preview stay in sync even when shifts or rates have changed
    // since the previous download.
    const { lines } = await payrollService.calculatePayrollForPeriod(
      workspace._id,
      [userId],
      start,
      end,
    );

    const freshLine = lines.find((l) => asIdString(l.user_id) === asIdString(userId));

    if (!freshLine || freshLine.minutes_worked === 0) {
      return sendError(
        res,
        createHttpError(400, "Staff has no completed shifts in this period."),
      );
    }

    if (freshLine.gross_cents <= 0) {
      return sendError(
        res,
        createHttpError(400, "Gross pay is zero. Check hourly rate and attendance."),
      );
    }

    let payrollRun = await PayrollRun.findOne({
      workspace_id: workspace._id,
      target_user_id: userId,
      period_start: start,
      period_end: end,
    });

    let dataChanged = false;

    if (!payrollRun) {
      payrollRun = new PayrollRun({
        workspace_id: workspace._id,
        target_user_id: userId,
        period_start: start,
        period_end: end,
        status: "finalized",
        lines: [freshLine],
      });
      await payrollRun.save();
    } else {
      const oldLine = payrollRun.lines && payrollRun.lines[0];
      dataChanged =
        !oldLine ||
        oldLine.minutes_worked !== freshLine.minutes_worked ||
        oldLine.gross_cents !== freshLine.gross_cents ||
        oldLine.deduction_cents !== freshLine.deduction_cents ||
        oldLine.net_cents !== freshLine.net_cents ||
        oldLine.hourly_rate_cents !== freshLine.hourly_rate_cents;

      if (dataChanged) {
        // Best-effort: delete the stale Journal Entry from QuickBooks so we
        // don't accumulate duplicates. Failure is non-fatal — we still update
        // the local run and post a fresh JE below.
        await deleteQuickBooksJournalEntryForRun({
          clerkUserId,
          payrollRunId: payrollRun._id,
        }).catch(() => null);

        // Drop the sync state so the next sync call posts a fresh JE that
        // matches the new numbers.
        payrollRun.quickbooks_sync = {
          synced_at: null,
          realm_id: null,
          journal_entry_id: null,
          error: null,
        };
      }

      payrollRun.lines = [freshLine];
      payrollRun.status = "finalized";
      payrollRun.updated_at = new Date();

      await payrollRun.save();
    }

    let qbSyncError = null;
    try {
      await syncPayrollRunToQuickBooks({
        clerkUserId,
        payrollRunId: payrollRun._id,
      });
      payrollRun = await PayrollRun.findById(payrollRun._id);
    } catch (syncErr) {
      qbSyncError = syncErr;
    }

    const staffUser = await User.findById(userId).lean();

    const pdfBuffer = await buildStaffPayslipPdf({
      payrollRun,
      user: staffUser,
      workspace,
    });

    const safeName = (staffUser && (staffUser.full_name || staffUser.email) || "staff")
      .toString()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 60);
    const startStr = new Date(payrollRun.period_start).toISOString().slice(0, 10);
    const endStr = new Date(payrollRun.period_end).toISOString().slice(0, 10);
    const filename = `payslip-${safeName}-${startStr}-to-${endStr}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    if (qbSyncError) {
      res.setHeader(
        "X-QB-Sync-Warning",
        encodeURIComponent(qbSyncError.message || "QuickBooks sync skipped"),
      );
    }
    return res.end(pdfBuffer);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/payroll/staff/:userId/pay/create-intent
 * Body: { period_start, period_end }
 */
async function createStaffPayrollPayment(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { userId } = req.params;
    const { period_start, period_end } = req.body || {};

    if (!userId || !period_start || !period_end) {
      return sendError(
        res,
        createHttpError(400, "userId, period_start and period_end are required"),
      );
    }

    const result = await createStaffPayrollPaymentIntent({
      clerkUserId,
      staffUserId: userId,
      periodStartRaw: period_start,
      periodEndRaw: period_end,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/payroll/staff/pay/confirm
 * Body: { payroll_run_id }
 */
async function confirmStaffPayrollPaymentHandler(req, res) {
  try {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
      return sendError(res, createHttpError(401, "Unauthorized"));
    }

    const { payroll_run_id } = req.body || {};
    if (!payroll_run_id) {
      return sendError(res, createHttpError(400, "payroll_run_id is required"));
    }

    const result = await confirmStaffPayrollPayment({
      clerkUserId,
      payrollRunId: payroll_run_id,
    });

    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getStaffRates,
  updateStaffRate,
  generatePayroll,
  approvePayroll,
  getPayrollRuns,
  getPayrollRunDetails,
  getPayrollPreview,
  issueAndDownloadStaffPayroll,
  createStaffPayrollPayment,
  confirmStaffPayrollPaymentHandler,
};
