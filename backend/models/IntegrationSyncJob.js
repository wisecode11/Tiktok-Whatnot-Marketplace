// models/IntegrationSyncJob.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const IntegrationSyncJobSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    default: null,
  },

  platform: {
    type: String,
    enum: ["tiktok", "whatnot", "stripe", "quickbooks"],
  },

  entity_type: String,
  entity_id: String,

  sync_type: {
    type: String,
    enum: ["import", "export", "webhook", "backfill"],
  },

  status: {
    type: String,
    enum: ["queued", "running", "success", "failed"],
  },

  started_at: Date,
  finished_at: Date,

  error_message: String,

  payload_json: Object,

  created_at: Date,
});

module.exports = mongoose.model(
  "IntegrationSyncJob",
  IntegrationSyncJobSchema
);