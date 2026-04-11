const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorOrderReviewSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  booking_id: {
    type: String,
    ref: "ModeratorBooking",
    required: true,
    unique: true,
  },

  streamer_user_id: {
    type: String,
    ref: "User",
    required: true,
  },

  moderator_user_id: {
    type: String,
    ref: "User",
    required: true,
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },

  review_text: {
    type: String,
    default: "",
  },

  is_public: {
    type: Boolean,
    default: true,
  },

  created_at: {
    type: Date,
    default: Date.now,
  },

  updated_at: {
    type: Date,
    default: Date.now,
  },
});

ModeratorOrderReviewSchema.index({ moderator_user_id: 1, created_at: -1 });
ModeratorOrderReviewSchema.index({ streamer_user_id: 1, created_at: -1 });

module.exports = mongoose.model("ModeratorOrderReview", ModeratorOrderReviewSchema);
