// models/SellerWorkspace.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const SellerWorkspaceSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  owner_user_id: {
    type: String,
    ref: "User",
  },

  business_name: String,
  description: String,
  country: String,

  status: {
    type: String,
    enum: ["trial", "active", "suspended", "cancelled"],
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model("SellerWorkspace", SellerWorkspaceSchema);