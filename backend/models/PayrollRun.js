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

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

PayrollRunSchema.index({ workspace_id: 1, period_end: -1 });

module.exports = mongoose.model("PayrollRun", PayrollRunSchema);
