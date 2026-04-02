// models/Notification.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const NotificationSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  user_id: {
    type: String,
    ref: "User",
  },

  notification_type: String,

  title: String,
  body: String,

  entity_type: String,
  entity_id: String,

  is_read: Boolean,

  created_at: Date,
});

module.exports = mongoose.model(
  "Notification",
  NotificationSchema
);