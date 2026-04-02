// models/AiGeneratedAsset.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const AiGeneratedAssetSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  job_id: {
    type: String,
    ref: "AiGenerationJob",
  },

  asset_type: {
    type: String,
    enum: ["title", "description", "thumbnail", "script", "recap"],
  },

  content_text: {
    type: String,
    default: null,
  },

  asset_url: {
    type: String,
    default: null,
  },

  version_number: Number,

  approved_by_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  created_at: Date,
});

module.exports = mongoose.model(
  "AiGeneratedAsset",
  AiGeneratedAssetSchema
);