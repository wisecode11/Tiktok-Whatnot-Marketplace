// models/SellerWorkspace.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const SellerWorkspaceSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  owner_user_id: {
    type: String,
    ref: "User",
  },

  clerk_organization_id: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
  },

  slug: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
  },

  business_name: String,
  description: String,
  country: String,
  billing_email: String,
  billing_name: String,
  stripe_customer_id: String,
  stripe_default_payment_method_id: String,

  status: {
    type: String,
    enum: ["trial", "active", "suspended", "cancelled"],
  },

  created_at: Date,
  updated_at: Date,
});

SellerWorkspaceSchema.index({ owner_user_id: 1, created_at: -1 });

module.exports = mongoose.model("SellerWorkspace", SellerWorkspaceSchema);