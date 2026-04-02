// models/ModeratorService.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorServiceSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  moderator_profile_id: {
    type: String,
    ref: "ModeratorProfile",
  },

  service_type: {
    type: String,
    enum: [
      "live_chat_moderation",
      "stream_engagement",
      "comment_management",
      "multi_platform_moderation",
    ],
  },

  title: String,
  description: String,

  price_type: {
    type: String,
    enum: ["hourly", "fixed", "custom"],
  },

  price_cents: Number,
  currency: String,

  is_active: Boolean,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "ModeratorService",
  ModeratorServiceSchema
);