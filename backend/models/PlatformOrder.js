// models/PlatformOrder.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PlatformOrderSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  platform: {
    type: String,
    enum: ["tiktok", "whatnot"],
  },

  external_order_id: String,

  customer_name: String,

  customer_email: {
    type: String,
    default: null,
  },

  order_number: String,

  order_status: {
    type: String,
    enum: [
      "pending",
      "paid",
      "fulfilled",
      "cancelled",
      "refunded",
      "partial_refund",
    ],
  },

  currency: String,

  subtotal_cents: Number,
  shipping_cents: Number,
  tax_cents: Number,
  discount_cents: Number,
  platform_fee_cents: Number,
  payment_processing_fee_cents: Number,
  refund_cents: Number,
  total_cents: Number,
  net_profit_cents: Number,

  order_placed_at: Date,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "PlatformOrder",
  PlatformOrderSchema
);