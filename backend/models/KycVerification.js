// models/KycVerification.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const KycVerificationSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  user_id: {
    type: String,
    ref: "User",
  },

  provider: {
    type: String,
    enum: ["stripe"],
  },

  provider_reference_id: String,

  status: {
    type: String,
    enum: ["not_started", "pending", "verified", "rejected", "review"],
  },

  submitted_at: Date,
  verified_at: Date,

  rejection_reason: String,

  metadata_json: Object,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "KycVerification",
  KycVerificationSchema
);