const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ChatThreadSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  seller_user_id: {
    type: String,
    ref: "User",
    required: true,
  },

  moderator_user_id: {
    type: String,
    ref: "User",
    required: true,
  },

  last_message_preview: {
    type: String,
    default: "",
  },

  last_message_at: {
    type: Date,
    default: Date.now,
  },

  seller_last_read_at: {
    type: Date,
    default: null,
  },

  moderator_last_read_at: {
    type: Date,
    default: null,
  },

  created_at: {
    type: Date,
    default: Date.now,
  },

  updated_at: {
    type: Date,
    default: Date.now,
  },
});

ChatThreadSchema.index({ seller_user_id: 1, moderator_user_id: 1 }, { unique: true });
ChatThreadSchema.index({ seller_user_id: 1, last_message_at: -1 });
ChatThreadSchema.index({ moderator_user_id: 1, last_message_at: -1 });

module.exports = mongoose.model("ChatThread", ChatThreadSchema);
