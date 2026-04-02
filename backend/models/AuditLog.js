// models/AuditLog.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const AuditLogSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  actor_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  action_type: String,

  entity_type: String,
  entity_id: String,

  before_json: Object,
  after_json: Object,

  ip_address: String,
  user_agent: String,

  created_at: Date,
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);