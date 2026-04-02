// models/SubscriptionPayment.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const SubscriptionPaymentSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_subscription_id: {
    type: String,
    ref: "WorkspaceSubscription",
  },

  stripe_payment_intent_id: String,

  amount_cents: Number,
  currency: String,

  status: {
    type: String,
    enum: [
      "requires_payment_method",
      "processing",
      "succeeded",
      "failed",
    ],
  },

  failure_reason: String,

  created_at: Date,
});

module.exports = mongoose.model(
  "SubscriptionPayment",
  SubscriptionPaymentSchema
);