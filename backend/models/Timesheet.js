// models/Timesheet.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const TimesheetSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  user_id: {
    type: String,
    ref: "User",
  },

  period_start: Date,
  period_end: Date,

  total_hours: Number,
  overtime_hours: Number,

  regular_pay_cents: Number,
  overtime_pay_cents: Number,
  deductions_cents: Number,

  gross_pay_cents: Number,
  net_pay_cents: Number,

  status: {
    type: String,
    enum: ["draft", "approved", "exported", "paid"],
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model("Timesheet", TimesheetSchema);