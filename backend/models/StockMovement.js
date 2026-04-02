// models/StockMovement.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const StockMovementSchema = new mongoose.Schema({
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

  movement_type: {
    type: String,
    enum: ["in", "out", "reserve", "release", "adjust", "transfer"],
  },

  quantity: Number,

  reference_type: String,
  reference_id: String,

  note: String,

  created_at: Date,
});

module.exports = mongoose.model(
  "StockMovement",
  StockMovementSchema
);