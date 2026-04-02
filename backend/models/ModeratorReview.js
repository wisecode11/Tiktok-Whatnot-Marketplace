// models/ModeratorReview.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorReviewSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  booking_id: {
    type: String,
    ref: "ModeratorBooking",
    unique: true,
  },

  reviewer_user_id: {
    type: String,
    ref: "User",
  },

  reviewed_user_id: {
    type: String,
    ref: "User",
  },

  rating: Number, // 1-5

  review_text: String,

  is_public: Boolean,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "ModeratorReview",
  ModeratorReviewSchema
);