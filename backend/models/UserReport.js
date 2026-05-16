// models/UserReport.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const UserReportSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  reported_user_id: {
    type: String,
    ref: "User",
    required: true,
  },

  reported_by_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  report_type: {
    type: String,
    enum: ["content", "behavior", "fraud", "spam", "other"],
    default: "other",
  },

  reason: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    default: "",
  },

  status: {
    type: String,
    enum: ["open", "under_review", "resolved", "dismissed"],
    default: "open",
  },

  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },

  resolved_by_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  resolved_at: {
    type: Date,
    default: null,
  },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

UserReportSchema.index({ reported_user_id: 1 });
UserReportSchema.index({ status: 1 });
UserReportSchema.index({ priority: 1 });
UserReportSchema.index({ created_at: -1 });

module.exports = mongoose.model("UserReport", UserReportSchema);
