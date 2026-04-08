// models/User.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const UserSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  clerk_user_id: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true },
  password_hash: String,
  first_name: String,
  last_name: String,

  user_type: {
    type: String,
    enum: ["seller", "moderator", "admin"],
  },

  status: {
    type: String,
    enum: ["active", "pending", "blocked", "deleted"],
    default: "active",
  },

  stripe_customer_id: String,

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);