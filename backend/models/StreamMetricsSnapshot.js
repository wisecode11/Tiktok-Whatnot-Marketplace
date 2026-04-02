// models/StreamMetricsSnapshot.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const StreamMetricsSnapshotSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  live_stream_id: {
    type: String,
    ref: "LiveStream",
  },

  captured_at: Date,

  views_count: Number,
  likes_count: Number,
  comments_count: Number,
  followers_count: Number,
  engagement_count: Number,

  revenue_cents: Number,
  orders_count: Number,

  viewer_breakdown_json: Object,
  platform_metrics_json: Object,

  created_at: Date,
});

module.exports = mongoose.model(
  "StreamMetricsSnapshot",
  StreamMetricsSnapshotSchema
);