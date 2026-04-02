// models/QuickbooksSyncLog.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const QuickbooksSyncLogSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  entity_type: {
    type: String,
    enum: ["timesheet", "payroll_run", "user", "invoice", "expense"],
  },

  entity_id: String,

  sync_status: {
    type: String,
    enum: ["queued", "success", "failed"],
  },

  quickbooks_object_id: String,

  error_message: String,

  synced_at: Date,

  created_at: Date,
});

module.exports = mongoose.model(
  "QuickbooksSyncLog",
  QuickbooksSyncLogSchema
);