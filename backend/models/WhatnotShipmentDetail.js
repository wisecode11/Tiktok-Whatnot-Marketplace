const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotShipmentDetailSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    clerk_user_id: { type: String, required: true, index: true },
    shipment_key: { type: String, required: true, index: true },
    shipment_id_input: { type: String, default: null },
    shipment_global_id: { type: String, default: null },
    source: { type: String, default: "whatnot-extension" },
    shipment_payload: { type: Object, default: {} },
    synced_at: { type: Date, default: Date.now, index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_shipment_details",
  },
);

WhatnotShipmentDetailSchema.index(
  { platform: 1, clerk_user_id: 1, shipment_key: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clerk_user_id: { $type: "string" },
      shipment_key: { $type: "string" },
    },
    name: "uniq_whatnot_shipment_detail",
  },
);

module.exports = mongoose.model("WhatnotShipmentDetail", WhatnotShipmentDetailSchema);
