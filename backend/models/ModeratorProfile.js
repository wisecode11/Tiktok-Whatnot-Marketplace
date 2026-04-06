// models/ModeratorProfile.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorProfileSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  user_id: {
    type: String,
    ref: "User",
    unique: true,
  },

  display_name: String,
  bio: String,
  headline: String,

  skills: {
    type: [String],
    default: [],
  },

  availability_summary: {
    type: String,
    default: "",
  },

  years_experience: Number,

  hourly_rate_cents: {
    type: Number,
    default: null,
  },

  average_rating: Number,
  rating_count: Number,

  response_time_minutes: {
    type: Number,
    default: null,
  },

  profile_status: {
    type: String,
    enum: ["draft", "pending_kyc", "published", "suspended"],
  },

  public_slug: {
    type: String,
    unique: true,
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "ModeratorProfile",
  ModeratorProfileSchema
);