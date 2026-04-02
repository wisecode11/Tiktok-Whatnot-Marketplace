// models/ConnectedAccount.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ConnectedAccountSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    default: null,
  },

  platform: {
    type: String,
    enum: ["tiktok", "whatnot", "stripe", "quickbooks"],
  },

  account_external_id: String,
  account_name: String,

  access_token_encrypted: String,
  refresh_token_encrypted: String,

  token_expires_at: Date,

  scopes_json: Object,

  status: {
    type: String,
    enum: ["connected", "expired", "revoked", "error"],
  },

  metadata_json: Object,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "ConnectedAccount",
  ConnectedAccountSchema
);