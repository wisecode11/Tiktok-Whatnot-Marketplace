// models/RiskFlag.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const RiskFlagSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    default: null,
  },

  booking_id: {
    type: String,
    ref: "ModeratorBooking",
    default: null,
  },

  order_id: {
    type: String,
    ref: "PlatformOrder",
    default: null,
  },

  risk_type: String,

  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
  },

  details: String,

  status: {
    type: String,
    enum: ["open", "investigating", "closed"],
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model("RiskFlag", RiskFlagSchema);