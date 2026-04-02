// models/Report.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ReportSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  reporter_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  reported_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  reported_booking_id: {
    type: String,
    ref: "ModeratorBooking",
    default: null,
  },

  reported_order_id: {
    type: String,
    ref: "PlatformOrder",
    default: null,
  },

  report_type: String,
  reason: String,
  details: String,

  status: {
    type: String,
    enum: ["pending", "under_review", "resolved", "rejected"],
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model("Report", ReportSchema);