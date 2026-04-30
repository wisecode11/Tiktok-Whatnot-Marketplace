const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotOrderSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    clerk_user_id: { type: String, default: null, index: true },
    whatnot_order_id: { type: String, default: null },
    order_number: { type: String, default: null },
    status: { type: String, default: null },
    buyer_username: { type: String, default: null },
    buyer_name: { type: String, default: null },
    listing_title: { type: String, default: null },
    price_amount: { type: Number, default: null },
    price_currency: { type: String, default: null },
    ordered_at: { type: Date, default: null },
    extension_tab_id: { type: Number, default: null },
    source: { type: String, default: "whatnot-extension" },
    raw_payload: { type: Object, default: {} },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot-orders",
  },
);

WhatnotOrderSchema.index(
  { clerk_user_id: 1, whatnot_order_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clerk_user_id: { $type: "string" },
      whatnot_order_id: { $type: "string" },
    },
  },
);

module.exports = mongoose.model("WhatnotOrder", WhatnotOrderSchema);
