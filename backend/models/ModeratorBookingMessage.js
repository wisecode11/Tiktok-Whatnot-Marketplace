// models/ModeratorBookingMessage.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ModeratorBookingMessageSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  booking_id: {
    type: String,
    ref: "ModeratorBooking",
  },

  sender_user_id: {
    type: String,
    ref: "User",
  },

  message_text: String,

  attachment_url: {
    type: String,
    default: null,
  },

  created_at: Date,
});

module.exports = mongoose.model(
  "ModeratorBookingMessage",
  ModeratorBookingMessageSchema
);