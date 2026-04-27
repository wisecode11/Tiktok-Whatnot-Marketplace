const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const AttendanceSegmentSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    required: true,
    index: true,
  },

  user_id: {
    type: String,
    ref: "User",
    required: true,
    index: true,
  },

  clock_in_at: { type: Date, required: true },
  clock_out_at: { type: Date, default: null },

  notes: { type: String, default: null },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

AttendanceSegmentSchema.index({ workspace_id: 1, user_id: 1, clock_in_at: -1 });

module.exports = mongoose.model("AttendanceSegment", AttendanceSegmentSchema);
