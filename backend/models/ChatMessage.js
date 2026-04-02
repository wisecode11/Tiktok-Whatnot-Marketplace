// models/ChatMessage.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ChatMessageSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  thread_id: {
    type: String,
    ref: "ChatThread",
  },

  sender_user_id: {
    type: String,
    ref: "User",
  },

  message_text: String,

  attachment_url: {
    type: String,
    default: null,
  },

  read_at: {
    type: Date,
    default: null,
  },

  created_at: Date,
});

module.exports = mongoose.model(
  "ChatMessage",
  ChatMessageSchema
);