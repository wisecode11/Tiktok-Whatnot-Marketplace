// models/WorkspaceMembership.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WorkspaceMembershipSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  user_id: {
    type: String,
    ref: "User",
  },

  role: {
    type: String,
    enum: ["admin", "host", "inventory_manager"],
  },

  permissions_json: {
    type: Object,
    default: null,
  },

  status: {
    type: String,
    enum: ["invited", "active", "revoked"],
  },

  joined_at: Date,
  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "WorkspaceMembership",
  WorkspaceMembershipSchema
);