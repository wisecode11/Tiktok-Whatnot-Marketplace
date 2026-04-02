// models/WorkspaceSubscription.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WorkspaceSubscriptionSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  plan_id: {
    type: String,
    ref: "SubscriptionPlan",
  },

  stripe_subscription_id: String,

  status: {
    type: String,
    enum: ["trial", "active", "past_due", "cancelled", "incomplete"],
  },

  current_period_start: Date,
  current_period_end: Date,

  cancel_at_period_end: Boolean,
  cancelled_at: Date,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "WorkspaceSubscription",
  WorkspaceSubscriptionSchema
);