// models/StripeConnectAccount.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const StripeConnectAccountSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  user_id: {
    type: String,
    ref: "User",
  },

  account_type: {
    type: String,
    enum: ["moderator", "seller_payouts", "platform"],
  },

  stripe_account_id: String,

  charges_enabled: Boolean,
  payouts_enabled: Boolean,
  details_submitted: Boolean,

  onboarding_status: String,

  country: String,
  currency: String,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "StripeConnectAccount",
  StripeConnectAccountSchema
);