// models/ModeratorBooking.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorBookingSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  moderator_user_id: {
    type: String,
    ref: "User",
  },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  requester_user_id: {
    type: String,
    ref: "User",
  },

  service_id: {
    type: String,
    ref: "ModeratorService",
  },

  booking_type: {
    type: String,
    enum: ["appointment", "live_session", "async_task"],
  },

  scheduled_start_at: Date,
  scheduled_end_at: Date,

  status: {
    type: String,
    enum: [
      "requested",
      "accepted",
      "in_progress",
      "completed",
      "cancelled",
      "disputed",
      "refunded",
    ],
  },

  agreed_price_cents: Number,
  platform_fee_cents: Number,
  moderator_payout_cents: Number,

  // Stripe payment tracking
  stripe_payment_intent_id: String,
  stripe_charge_id: String,
  payment_status: {
    type: String,
    enum: ["unpaid", "pending", "paid", "failed", "refunded"],
    default: "unpaid",
  },

  notes: String,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "ModeratorBooking",
  ModeratorBookingSchema
);