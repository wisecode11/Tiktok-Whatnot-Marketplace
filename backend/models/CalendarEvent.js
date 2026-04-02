// models/CalendarEvent.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const CalendarEventSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    default: null,
  },

  event_type: {
    type: String,
    enum: [
      "live_stream",
      "moderator_booking",
      "payroll_deadline",
      "reminder",
      "task",
    ],
  },

  title: String,
  description: String,

  start_at: Date,
  end_at: Date,

  platform: {
    type: String,
    default: null,
  },

  related_entity_type: String,
  related_entity_id: String,

  reminder_minutes_before: Number,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "CalendarEvent",
  CalendarEventSchema
);