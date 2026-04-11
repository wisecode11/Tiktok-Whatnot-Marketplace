const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ChatMessageSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  thread_id: {
    type: String,
    ref: "ChatThread",
    required: true,
  },

  sender_user_id: {
    type: String,
    ref: "User",
    required: true,
  },

  body: {
    type: String,
    required: true,
  },

  created_at: {
    type: Date,
    default: Date.now,
  },
});

ChatMessageSchema.index({ thread_id: 1, created_at: -1 });

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
