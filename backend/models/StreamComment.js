// models/StreamComment.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const StreamCommentSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  live_stream_id: {
    type: String,
    ref: "LiveStream",
  },

  platform: {
    type: String,
    enum: ["tiktok", "whatnot"],
  },

  external_comment_id: String,

  author_name: String,
  author_handle: String,

  comment_text: String,

  posted_at: Date,

  sentiment_score: {
    type: Number,
    default: null,
  },

  created_at: Date,
});

module.exports = mongoose.model(
  "StreamComment",
  StreamCommentSchema
);