// models/ModeratorSchedule.js
//
// Stores the complete availability configuration for a single moderator as ONE
// document per moderator profile. This replaces the previous multi-row design
// (ModeratorAvailabilityRule + ModeratorTimeOff) where 7 rows were created per
// moderator for weekly days.
//
// Structure:
//   weekly_schedule  – one entry per day (0-6), with embedded breaks for that day
//   holidays         – array of YYYY-MM-DD date strings (full-day blackouts)
//   time_off_ranges  – array of { start_at, end_at, reason } sub-documents

const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const DayBreakSchema = new mongoose.Schema(
  {
    start_time: { type: String, required: true }, // HH:MM
    end_time: { type: String, required: true },   // HH:MM
  },
  { _id: false }
);

const DayScheduleSchema = new mongoose.Schema(
  {
    day_of_week: { type: Number, min: 0, max: 6, required: true }, // 0 = Sun … 6 = Sat
    is_available: { type: Boolean, default: false },
    start_time: { type: String, default: "09:00" }, // HH:MM
    end_time: { type: String, default: "17:00" },   // HH:MM
    breaks: { type: [DayBreakSchema], default: [] },
  },
  { _id: false }
);

const TimeOffRangeSchema = new mongoose.Schema(
  {
    start_at: { type: Date, required: true },
    end_at: { type: Date, required: true },
    reason: { type: String, default: "time-off" },
  },
  { _id: false }
);

const ModeratorScheduleSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  moderator_profile_id: {
    type: String,
    ref: "ModeratorProfile",
    unique: true, // one document per moderator profile
    required: true,
  },

  timezone: { type: String, default: "UTC" },

  // 7-element array, one entry per day of week (not required to be exactly 7)
  weekly_schedule: { type: [DayScheduleSchema], default: [] },

  // full-day blackouts stored as YYYY-MM-DD strings
  holidays: { type: [String], default: [] },

  // date ranges (vacation, sick leave, etc.)
  time_off_ranges: { type: [TimeOffRangeSchema], default: [] },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ModeratorSchedule", ModeratorScheduleSchema);
