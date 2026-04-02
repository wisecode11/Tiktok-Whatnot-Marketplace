// models/ProductVariant.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ProductVariantSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  product_id: {
    type: String,
    ref: "Product",
  },

  variant_sku: String,

  option_name_1: String,
  option_value_1: String,

  option_name_2: String,
  option_value_2: String,

  price_cents: Number,

  barcode: {
    type: String,
    default: null,
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "ProductVariant",
  ProductVariantSchema
);