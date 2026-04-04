// models/SubscriptionPlan.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const SubscriptionPlanSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  name: String,
  description: String,
  price: Number,
  currency: String,

  billing_interval: String,

  stripe_price_id: String,
  stripe_product_id: String,

  features_json: {
    type: [String],
    default: [],
  },

  metadata_json: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  display_order: {
    type: Number,
    default: 0,
  },

  is_active: Boolean,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "SubscriptionPlan",
  SubscriptionPlanSchema
);