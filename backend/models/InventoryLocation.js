// models/InventoryLocation.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const InventoryLocationSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  name: String,

  location_type: {
    type: String,
    enum: ["warehouse", "store", "home", "3pl"],
  },

  address_json: Object,

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "InventoryLocation",
  InventoryLocationSchema
);