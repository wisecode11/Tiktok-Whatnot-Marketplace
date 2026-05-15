// models/Attendance.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

/**
 * Attendance model - one record per user per calendar day.
 *
 * Design goals:
 *  - Single entry per (user_id, date) enforced via unique compound index.
 *  - Dedicated integer fields (day, month, year) for fast range queries and
 *    aggregation pipelines without expensive $dateToString / $year operators.
 *  - duration_minutes auto-populated on clock-out for instant reporting.
 *  - Separate indexes for every common query axis:
 *      employee, workspace, creator, daily, monthly, org-wide.
 */
const AttendanceSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },

    // The staff member who clocked in/out
    user_id: {
      type: String,
      ref: "User",
      required: true,
    },

    // The seller workspace this staff member belongs to
    workspace_id: {
      type: String,
      ref: "SellerWorkspace",
      required: true,
    },

    // The streamer / seller who owns / created this staff account
    creator_id: {
      type: String,
      ref: "User",
      required: true,
    },

    // --- Date decomposition for fast filtering & aggregation ---
    // ISO date string "YYYY-MM-DD" — used for the unique-per-day lookup
    date: { type: String, required: true }, // e.g. "2026-05-13"

    day:   { type: Number, required: true, min: 1,  max: 31 },
    month: { type: Number, required: true, min: 1,  max: 12 },
    year:  { type: Number, required: true, min: 2020 },

    // --- Attendance state ---
    status: {
      type: String,
      enum: ["clocked_in", "clocked_out"],
      default: "clocked_in",
    },

    clock_in_at:  { type: Date, required: true },
    clock_out_at: { type: Date, default: null },

    // Stored in minutes (fractional) for easy SUM/AVG aggregation
    duration_minutes: { type: Number, default: null },

    // Optional free-text note (e.g. "late due to traffic")
    notes: { type: String, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// ── Uniqueness constraint ──────────────────────────────────────────────────────
// One record per staff member per calendar day.
AttendanceSchema.index({ user_id: 1, date: 1 }, { unique: true });

// ── Query / reporting indexes ─────────────────────────────────────────────────
// Daily attendance for a workspace (e.g. "who is in today?")
AttendanceSchema.index({ workspace_id: 1, date: 1 });

// Monthly summary per employee
AttendanceSchema.index({ user_id: 1, year: 1, month: 1 });

// Org-wide monthly summary
AttendanceSchema.index({ workspace_id: 1, year: 1, month: 1 });

// Streamer / creator view (all staff for a creator in a month)
AttendanceSchema.index({ creator_id: 1, year: 1, month: 1 });

// Year-level rollup
AttendanceSchema.index({ workspace_id: 1, year: 1 });

// Status filtering (how many still clocked-in right now?)
AttendanceSchema.index({ workspace_id: 1, date: 1, status: 1 });

module.exports = mongoose.model("Attendance", AttendanceSchema);
