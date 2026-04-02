// models/PlatformListing.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PlatformListingSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  product_id: {
    type: String,
    ref: "Product",
  },

  variant_id: {
    type: String,
    ref: "ProductVariant",
    default: null,
  },

  platform: {
    type: String,
    enum: ["tiktok", "whatnot"],
  },

  external_listing_id: String,

  title: String,
  description: String,

  price_cents: Number,

  status: {
    type: String,
    enum: ["draft", "published", "hidden", "ended", "error"],
  },

  sync_status: {
    type: String,
    enum: ["pending", "synced", "failed"],
  },

  published_at: Date,
  last_synced_at: Date,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "PlatformListing",
  PlatformListingSchema
);