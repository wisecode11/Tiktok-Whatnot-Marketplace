// models/ModeratorPayout.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorPayoutSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  booking_id: {
    type: String,
    ref: "ModeratorBooking",
  },

  moderator_user_id: {
    type: String,
    ref: "User",
  },

  stripe_payment_intent_id: String,
  stripe_transfer_id: String,
  stripe_payout_id: String,

  gross_amount_cents: Number,
  platform_fee_cents: Number,
  net_amount_cents: Number,

  // Keep legacy field as alias
  amount_cents: Number,
  currency: { type: String, default: "usd" },

  status: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending",
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "ModeratorPayout",
  ModeratorPayoutSchema
);