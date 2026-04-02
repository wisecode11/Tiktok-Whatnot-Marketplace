// models/PayrollItem.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PayrollItemSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  payroll_run_id: {
    type: String,
    ref: "PayrollRun",
  },

  user_id: {
    type: String,
    ref: "User",
  },

  timesheet_id: {
    type: String,
    ref: "Timesheet",
  },

  gross_pay_cents: Number,
  deductions_cents: Number,
  net_pay_cents: Number,

  quickbooks_sync_status: String,

  created_at: Date,
});

module.exports = mongoose.model(
  "PayrollItem",
  PayrollItemSchema
);