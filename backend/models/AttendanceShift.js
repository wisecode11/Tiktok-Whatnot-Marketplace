// models/AttendanceShift.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const AttendanceShiftSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  user_id: {
    type: String,
    ref: "User",
  },

  role_at_shift: {
    type: String,
    enum: ["host", "inventory_manager", "admin"],
  },

  clock_in_at: Date,
  clock_out_at: Date,

  break_minutes: Number,

  source: {
    type: String,
    enum: ["manual", "mobile", "web"],
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "AttendanceShift",
  AttendanceShiftSchema
);