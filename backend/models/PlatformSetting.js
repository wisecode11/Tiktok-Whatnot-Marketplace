// models/PlatformSetting.js
// Single-document collection that stores global platform configuration such as
// the platform fee percent applied to moderator bookings and the connected
// Stripe Express account that should receive that fee.
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PlatformSettingSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  // Singleton row identifier so we can always upsert one row.
  scope: {
    type: String,
    default: "global",
    unique: true,
  },

  // Platform commission percent applied to moderator bookings (0-100).
  platform_fee_percent: {
    type: Number,
    default: 15,
    min: 0,
    max: 100,
  },

  // Same fee as integer basis points (1 bp = 0.01%). Example: 15% → 1500.
  // Use for integer-safe fee math later: platformFeeCents = round(grossCents * bps / 10000).
  platform_fee_basis_points: {
    type: Number,
    default: 1500,
    min: 0,
    max: 10000,
  },

  // Admin-owned Stripe Connect (Express) account that receives the platform fee.
  admin_stripe_account_id: {
    type: String,
    default: null,
  },
  admin_stripe_charges_enabled: {
    type: Boolean,
    default: false,
  },
  admin_stripe_payouts_enabled: {
    type: Boolean,
    default: false,
  },
  admin_stripe_details_submitted: {
    type: Boolean,
    default: false,
  },
  admin_stripe_onboarding_status: {
    type: String,
    default: null,
  },
  admin_stripe_connected_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model("PlatformSetting", PlatformSettingSchema);
