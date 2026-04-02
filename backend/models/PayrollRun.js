// models/PayrollRun.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PayrollRunSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  period_start: Date,
  period_end: Date,

  run_date: Date,

  status: {
    type: String,
    enum: ["draft", "approved", "exported", "paid"],
  },

  total_gross_cents: Number,
  total_deductions_cents: Number,
  total_net_cents: Number,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model("PayrollRun", PayrollRunSchema);