// models/PlatformFeeRule.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PlatformFeeRuleSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  service_type: {
    type: String,
    enum: ["moderator", "subscription", "transaction"],
  },

  percentage_fee: Number,
  fixed_fee_cents: Number,

  applies_to: {
    type: String,
    enum: ["booking", "order", "subscription"],
  },

  is_active: Boolean,

  created_at: Date,
});

module.exports = mongoose.model(
  "PlatformFeeRule",
  PlatformFeeRuleSchema
);