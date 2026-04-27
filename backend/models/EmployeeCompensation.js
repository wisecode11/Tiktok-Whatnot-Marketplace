const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const EmployeeCompensationSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    required: true,
    index: true,
  },

  user_id: {
    type: String,
    ref: "User",
    required: true,
  },

  hourly_rate_cents: { type: Number, default: 1500 },
  deduction_fixed_cents: { type: Number, default: 0 },
  deduction_percent: { type: Number, default: 0 },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

EmployeeCompensationSchema.index({ workspace_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model("EmployeeCompensation", EmployeeCompensationSchema);
