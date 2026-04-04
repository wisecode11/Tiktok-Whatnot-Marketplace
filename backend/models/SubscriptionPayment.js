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
  stripe_invoice_id: String,
  stripe_charge_id: String,
  stripe_payment_method_id: String,

  amount_cents: Number,
  currency: String,

  status: String,

  failure_reason: String,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "SubscriptionPayment",
  SubscriptionPaymentSchema
);