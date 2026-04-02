// models/ModeratorTimeOff.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorTimeOffSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  moderator_profile_id: {
    type: String,
    ref: "ModeratorProfile",
  },

  start_at: Date,
  end_at: Date,

  reason: String,

  created_at: Date,
});

module.exports = mongoose.model(
  "ModeratorTimeOff",
  ModeratorTimeOffSchema
);