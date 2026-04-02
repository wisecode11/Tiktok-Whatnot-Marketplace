// models/StockLevel.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const StockLevelSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  product_variant_id: {
    type: String,
    ref: "ProductVariant",
  },

  location_id: {
    type: String,
    ref: "InventoryLocation",
  },

  on_hand_qty: Number,
  reserved_qty: Number,
  available_qty: Number,

  low_stock_threshold: Number,

  updated_at: Date,
});

module.exports = mongoose.model(
  "StockLevel",
  StockLevelSchema
);