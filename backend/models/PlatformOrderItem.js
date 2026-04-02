// models/PlatformOrderItem.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PlatformOrderItemSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  order_id: {
    type: String,
    ref: "PlatformOrder",
  },

  product_id: {
    type: String,
    ref: "Product",
  },

  variant_id: {
    type: String,
    ref: "ProductVariant",
    default: null,
  },

  quantity: Number,
  unit_price_cents: Number,
  discount_cents: Number,
  tax_cents: Number,
  total_cents: Number,

  created_at: Date,
});

module.exports = mongoose.model(
  "PlatformOrderItem",
  PlatformOrderItemSchema
);