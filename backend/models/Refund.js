// models/Refund.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const RefundSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  order_id: {
    type: String,
    ref: "PlatformOrder",
    default: null,
  },

  booking_id: {
    type: String,
    ref: "ModeratorBooking",
    default: null,
  },

  stripe_refund_id: String,

  amount_cents: Number,

  reason: String,

  status: {
    type: String,
    enum: ["pending", "succeeded", "failed", "reversed"],
  },

  processed_by_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  created_at: Date,
});

module.exports = mongoose.model("Refund", RefundSchema);