// models/AccountBlock.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const AccountBlockSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  user_id: {
    type: String,
    ref: "User",
  },

  block_type: {
    type: String,
    enum: ["temporary", "permanent"],
  },

  reason: String,

  blocked_by_user_id: {
    type: String,
    ref: "User",
  },

  blocked_at: Date,

  unblocked_at: {
    type: Date,
    default: null,
  },

  unblock_reason: {
    type: String,
    default: null,
  },

  created_at: Date,
});

module.exports = mongoose.model(
  "AccountBlock",
  AccountBlockSchema
);