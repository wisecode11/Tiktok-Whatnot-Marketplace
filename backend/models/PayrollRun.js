const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PayrollLineSchema = new mongoose.Schema(
  {
    user_id: { type: String, ref: "User", required: true },
    minutes_worked: { type: Number, required: true },
    regular_minutes: { type: Number, required: true },
    overtime_minutes: { type: Number, required: true },
    hourly_rate_cents: { type: Number, required: true },
    gross_cents: { type: Number, required: true },
    deduction_cents: { type: Number, required: true },
    net_cents: { type: Number, required: true },
  },
  { _id: false },
);

const PayrollRunSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    required: true,
    index: true,
  },

  // Per-staff run: when seller clicks "Download Payroll" for one staff,
  // we create a run scoped to that user. Null = legacy multi-staff run.
  target_user_id: {
    type: String,
    ref: "User",
    default: null,
    index: true,
  },

  period_start: { type: Date, required: true },
  period_end: { type: Date, required: true },

  status: {
    type: String,
    enum: ["draft", "finalized"],
    default: "draft",
  },

  lines: { type: [PayrollLineSchema], default: [] },

  quickbooks_sync: {
    synced_at: { type: Date, default: null },
    realm_id: { type: String, default: null },
    journal_entry_id: { type: String, default: null },
    error: { type: String, default: null },
  },

  stripe_payment: {
    status: { type: String, default: null },
    payment_intent_id: { type: String, default: null },
    invoice_id: { type: String, default: null },
    hosted_invoice_url: { type: String, default: null },
    invoice_pdf_url: { type: String, default: null },
    amount_cents: { type: Number, default: null },
    staff_stripe_account_id: { type: String, default: null },
    paid_at: { type: Date, default: null },
    error: { type: String, default: null },
  },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

PayrollRunSchema.index({ workspace_id: 1, period_end: -1 });
PayrollRunSchema.index(
  { workspace_id: 1, target_user_id: 1, period_start: 1, period_end: 1 },
  { name: "workspace_user_period_idx" },
);

module.exports = mongoose.model("PayrollRun", PayrollRunSchema);
