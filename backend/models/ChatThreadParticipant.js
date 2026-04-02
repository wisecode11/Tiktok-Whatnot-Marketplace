// models/ChatThreadParticipant.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ChatThreadParticipantSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  thread_id: {
    type: String,
    ref: "ChatThread",
  },

  user_id: {
    type: String,
    ref: "User",
  },

  role_in_thread: String,

  joined_at: Date,
});

module.exports = mongoose.model(
  "ChatThreadParticipant",
  ChatThreadParticipantSchema
);