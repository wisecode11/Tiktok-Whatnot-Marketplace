const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const NotificationSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  recipient_user_id: {
    type: String,
    ref: "User",
    required: true,
    index: true,
  },

  sender_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  type: {
    type: String,
    enum: ["chat_message"],
    required: true,
  },

  title: {
    type: String,
    required: true,
  },

  body: {
    type: String,
    default: "",
  },

  href: {
    type: String,
    default: null,
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  read_at: {
    type: Date,
    default: null,
  },

  created_at: {
    type: Date,
    default: Date.now,
  },
});

NotificationSchema.index({ recipient_user_id: 1, created_at: -1 });
NotificationSchema.index({ recipient_user_id: 1, read_at: 1, created_at: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
