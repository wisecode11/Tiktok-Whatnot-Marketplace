// models/Settlement.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const SettlementSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  platform: {
    type: String,
    enum: ["tiktok", "whatnot"],
  },

  settlement_period_start: Date,
  settlement_period_end: Date,

  gross_sales_cents: Number,
  shipping_cents: Number,
  fees_cents: Number,
  refunds_cents: Number,
  net_settlement_cents: Number,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "Settlement",
  SettlementSchema
);