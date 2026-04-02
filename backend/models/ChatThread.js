// models/ChatThread.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ChatThreadSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  thread_type: {
    type: String,
    enum: ["seller_moderator", "workspace_internal", "support"],
  },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    default: null,
  },

  booking_id: {
    type: String,
    ref: "ModeratorBooking",
    default: null,
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "ChatThread",
  ChatThreadSchema
);