/**
 * Payslip PDF generator.
 *
 * Generates a clean, single-page payslip PDF for one staff member's payroll
 * run using pdfkit. The PDF references the QuickBooks Journal Entry ID when
 * the run has been posted to QuickBooks so the document is audit-friendly,
 * but it does not depend on QuickBooks generating the file (QB Online does
 * not expose a PDF endpoint for JournalEntry — only for customer-facing
 * documents like Invoice / SalesReceipt / Bill / Estimate).
 */
const PDFDocument = require("pdfkit");

const COLOR_PRIMARY = "#1f2937"; // slate-800
const COLOR_MUTED = "#6b7280"; // slate-500
const COLOR_ACCENT = "#2563eb"; // blue-600
const COLOR_DIVIDER = "#e5e7eb"; // slate-200

function formatCurrency(cents) {
  const dollars = (Number(cents || 0) / 100).toFixed(2);
  return `$${dollars}`;
}

function formatHours(minutes) {
  return (Number(minutes || 0) / 60).toFixed(2);
}

function formatDateRange(start, end) {
  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(start)} \u2014 ${fmt(end)}`;
}

function drawSectionHeader(doc, label) {
  doc
    .moveDown(0.6)
    .fillColor(COLOR_ACCENT)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(label.toUpperCase(), { characterSpacing: 1 });
  const y = doc.y + 2;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(COLOR_DIVIDER)
    .lineWidth(0.75)
    .stroke();
  doc.moveDown(0.5).fillColor(COLOR_PRIMARY).font("Helvetica");
}

function drawKeyValueRow(doc, label, value, opts = {}) {
  const { bold = false, valueColor = COLOR_PRIMARY } = opts;
  const startY = doc.y;
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(11)
    .fillColor(COLOR_PRIMARY)
    .text(label, doc.page.margins.left, startY, {
      width: 320,
      continued: false,
    });
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fillColor(valueColor)
    .text(value, doc.page.margins.left + 320, startY, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 320,
      align: "right",
    });
  doc.fillColor(COLOR_PRIMARY);
}

/**
 * Build a payslip PDF and return it as a Node Buffer.
 *
 * @param {Object} args
 * @param {Object} args.payrollRun  Hydrated PayrollRun document
 * @param {Object} args.user        Staff user document (full_name, email)
 * @param {Object} args.workspace   SellerWorkspace document (business_name)
 */
async function buildStaffPayslipPdf({ payrollRun, user, workspace }) {
  if (!payrollRun || !Array.isArray(payrollRun.lines) || payrollRun.lines.length === 0) {
    throw new Error("Payroll run has no lines.");
  }

  const line = payrollRun.lines[0];

  const staffName = (user && (user.full_name || user.email)) || "Staff member";
  const staffEmail = (user && user.email) || "";
  const businessName = (workspace && workspace.business_name) || "Your business";

  const qb = payrollRun.quickbooks_sync || null;
  const qbJournalId = qb && qb.journal_entry_id && qb.journal_entry_id !== "unknown" ? qb.journal_entry_id : null;
  const qbRealm = qb && qb.realm_id ? qb.realm_id : null;
  const qbSyncedAt = qb && qb.synced_at ? new Date(qb.synced_at) : null;

  const regularRateCents = line.hourly_rate_cents || 0;
  const overtimeRateCents = Math.round(regularRateCents * 1.5);

  const regularPayCents = Math.round((line.regular_minutes / 60) * regularRateCents);
  const overtimePayCents = Math.round((line.overtime_minutes / 60) * overtimeRateCents);

  return await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Payslip — ${staffName} — ${new Date(payrollRun.period_start).toISOString().slice(0, 10)}`,
          Author: businessName,
          Subject: "Staff Payroll Payslip",
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc
        .fillColor(COLOR_PRIMARY)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("Payslip", { continued: false });

      doc
        .moveDown(0.1)
        .fillColor(COLOR_MUTED)
        .font("Helvetica")
        .fontSize(11)
        .text(businessName);

      doc
        .fillColor(COLOR_MUTED)
        .fontSize(10)
        .text(`Pay period: ${formatDateRange(payrollRun.period_start, payrollRun.period_end)}`);

      doc.moveDown(0.8);

      drawSectionHeader(doc, "Employee");
      drawKeyValueRow(doc, "Name", staffName);
      if (staffEmail) drawKeyValueRow(doc, "Email", staffEmail);
      drawKeyValueRow(
        doc,
        "Issued",
        new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
      );

      drawSectionHeader(doc, "Hours worked");
      drawKeyValueRow(doc, `Regular hours @ ${formatCurrency(regularRateCents)}/hr`, formatHours(line.regular_minutes));
      drawKeyValueRow(
        doc,
        `Overtime hours @ ${formatCurrency(overtimeRateCents)}/hr (1.5x)`,
        formatHours(line.overtime_minutes),
      );
      drawKeyValueRow(doc, "Total hours", formatHours(line.minutes_worked), { bold: true });

      drawSectionHeader(doc, "Earnings");
      drawKeyValueRow(doc, "Regular pay", formatCurrency(regularPayCents));
      drawKeyValueRow(doc, "Overtime pay", formatCurrency(overtimePayCents));
      drawKeyValueRow(doc, "Gross pay", formatCurrency(line.gross_cents), { bold: true });

      drawSectionHeader(doc, "Deductions");
      drawKeyValueRow(doc, "Total deductions", formatCurrency(line.deduction_cents));

      doc.moveDown(0.8);
      const summaryTop = doc.y + 4;
      doc
        .rect(
          doc.page.margins.left,
          summaryTop,
          doc.page.width - doc.page.margins.left - doc.page.margins.right,
          48,
        )
        .fillAndStroke("#f0f9ff", COLOR_ACCENT);
      doc
        .fillColor(COLOR_PRIMARY)
        .font("Helvetica-Bold")
        .fontSize(13)
        .text("NET PAY", doc.page.margins.left + 16, summaryTop + 15);
      doc
        .fillColor(COLOR_ACCENT)
        .font("Helvetica-Bold")
        .fontSize(18)
        .text(formatCurrency(line.net_cents), doc.page.margins.left, summaryTop + 12, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 16,
          align: "right",
        });

      doc.y = summaryTop + 60;
      doc.fillColor(COLOR_PRIMARY).font("Helvetica");

      drawSectionHeader(doc, "Accounting reference");
      if (qbJournalId) {
        drawKeyValueRow(doc, "QuickBooks Journal Entry", `#${qbJournalId}`);
        if (qbRealm) drawKeyValueRow(doc, "QuickBooks Company (realm)", qbRealm);
        if (qbSyncedAt) {
          drawKeyValueRow(
            doc,
            "Posted on",
            qbSyncedAt.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
          );
        }
      } else {
        drawKeyValueRow(doc, "QuickBooks Journal Entry", "Not posted yet");
      }
      drawKeyValueRow(doc, "Payroll Run ID", String(payrollRun._id));

      const footerY = doc.page.height - doc.page.margins.bottom - 20;
      doc
        .fillColor(COLOR_MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(
          `Generated by ${businessName} on ${new Date().toISOString()} \u2014 Overtime is calculated per ISO week (40h / 1.5x default).`,
          doc.page.margins.left,
          footerY,
          {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: "center",
          },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  buildStaffPayslipPdf,
};
