// models/SubscriptionInvoice.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const SubscriptionInvoiceSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_subscription_id: {
    type: String,
    ref: "WorkspaceSubscription",
  },

  stripe_invoice_id: String,
  stripe_subscription_id: String,
  stripe_payment_intent_id: String,

  amount_due_cents: Number,
  amount_paid_cents: Number,
  currency: String,

  status: String,

  hosted_invoice_url: String,
  invoice_pdf_url: String,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "SubscriptionInvoice",
  SubscriptionInvoiceSchema
);