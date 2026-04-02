// models/Product.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ProductSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  sku: String, // unique per workspace

  name: String,
  description: String,

  brand: {
    type: String,
    default: null,
  },

  category: String,

  status: {
    type: String,
    enum: ["draft", "active", "archived"],
  },

  base_price_cents: Number,
  currency: String,

  weight_grams: {
    type: Number,
    default: null,
  },

  dimensions_json: {
    type: Object,
    default: null,
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model("Product", ProductSchema);