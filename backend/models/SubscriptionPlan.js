// models/SubscriptionPlan.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const SubscriptionPlanSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  name: String,
  price: Number,

  billing_interval: {
    type: String,
    enum: ["monthly", "yearly"],
  },

  stripe_price_id: String,

  features_json: Object,

  is_active: Boolean,

  created_at: Date,
});

module.exports = mongoose.model(
  "SubscriptionPlan",
  SubscriptionPlanSchema
);