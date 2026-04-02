// models/LiveStream.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const LiveStreamSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  platform: {
    type: String,
    enum: ["tiktok", "whatnot", "both"],
  },

  external_stream_id: String,

  title: String,
  description: String,

  scheduled_start_at: Date,
  started_at: Date,
  ended_at: Date,

  status: {
    type: String,
    enum: ["scheduled", "live", "ended", "cancelled"],
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "LiveStream",
  LiveStreamSchema
);