// models/ModeratorAvailabilityRule.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorAvailabilityRuleSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  moderator_profile_id: {
    type: String,
    ref: "ModeratorProfile",
  },

  day_of_week: Number, // 0-6

  start_time: String,
  end_time: String,

  timezone: String,

  is_available: Boolean,

  created_at: Date,
});

module.exports = mongoose.model(
  "ModeratorAvailabilityRule",
  ModeratorAvailabilityRuleSchema
);