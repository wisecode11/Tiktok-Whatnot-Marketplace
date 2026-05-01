const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotProfileShippingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    WhatnotProfileShipping_id: { type: String, required: true },
    name: { type: String, default: null },
    weight_amount: { type: Number, default: null },
    weight_scale: { type: String, default: null },
    weight_name: { type: String, default: null },
    length: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    dimension_scale: { type: String, default: null },
    category_id: { type: String, default: null },
    source: { type: String, default: "whatnot-extension" },
    extension_tab_id: { type: Number, default: null },
    raw_payload: { type: Object, default: {} },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_profile_shipping",
  },
);

WhatnotProfileShippingSchema.index(
  { platform: 1, WhatnotProfileShipping_id: 1 },
  {
    unique: true,
    partialFilterExpression: { WhatnotProfileShipping_id: { $exists: true, $type: "string" } },
    name: "uniq_whatnot_profile_shipping",
  },
);

module.exports = mongoose.model("WhatnotProfileShipping", WhatnotProfileShippingSchema);
