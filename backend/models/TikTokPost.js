const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const TikTokPostSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  user_id: {
    type: String,
    ref: "User",
    required: true,
  },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
    default: null,
  },

  connected_account_id: {
    type: String,
    ref: "ConnectedAccount",
    default: null,
  },

  publish_id: {
    type: String,
    required: true,
    unique: true,
  },

  media_type: {
    type: String,
    enum: ["VIDEO", "PHOTO"],
    required: true,
  },

  post_mode: {
    type: String,
    enum: ["DIRECT_POST", "MEDIA_UPLOAD"],
    required: true,
  },

  source_type: {
    type: String,
    enum: ["PULL_FROM_URL", "FILE_UPLOAD"],
    required: true,
  },

  status: {
    type: String,
    default: "INIT_ACCEPTED",
  },

  fail_reason: {
    type: String,
    default: null,
  },

  publicly_available_post_ids: {
    type: [String],
    default: [],
  },

  media_urls: {
    type: [String],
    default: [],
  },

  title: {
    type: String,
    default: null,
  },

  description: {
    type: String,
    default: null,
  },

  privacy_level: {
    type: String,
    default: null,
  },

  creator_username: {
    type: String,
    default: null,
  },

  creator_nickname: {
    type: String,
    default: null,
  },

  requested_at: {
    type: Date,
    default: null,
  },

  completed_at: {
    type: Date,
    default: null,
  },

  last_status_checked_at: {
    type: Date,
    default: null,
  },

  request_json: {
    type: Object,
    default: null,
  },

  response_json: {
    type: Object,
    default: null,
  },

  metadata_json: {
    type: Object,
    default: null,
  },

  created_at: Date,
  updated_at: Date,
});

TikTokPostSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model("TikTokPost", TikTokPostSchema);