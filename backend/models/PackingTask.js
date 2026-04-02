// models/PackingTask.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PackingTaskSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  order_id: {
    type: String,
    ref: "PlatformOrder",
  },

  assigned_to_user_id: {
    type: String,
    ref: "User",
    default: null,
  },

  status: {
    type: String,
    enum: [
      "pending",
      "picked",
      "packed",
      "labeled",
      "shipped",
      "cancelled",
    ],
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "PackingTask",
  PackingTaskSchema
);