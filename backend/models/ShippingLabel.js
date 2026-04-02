// models/ShippingLabel.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const ShippingLabelSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  packing_task_id: {
    type: String,
    ref: "PackingTask",
  },

  carrier: String,
  service_level: String,
  tracking_number: String,
  label_url: String,

  created_at: Date,
});

module.exports = mongoose.model(
  "ShippingLabel",
  ShippingLabelSchema
);