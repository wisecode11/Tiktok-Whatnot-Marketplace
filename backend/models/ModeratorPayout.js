// models/ModeratorPayout.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorPayoutSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  booking_id: {
    type: String,
    ref: "ModeratorBooking",
  },

  stripe_transfer_id: String,
  stripe_payout_id: String,

  amount_cents: Number,
  currency: String,

  status: {
    type: String,
    enum: ["pending", "paid", "failed"],
  },

  created_at: Date,
});

module.exports = mongoose.model(
  "ModeratorPayout",
  ModeratorPayoutSchema
);