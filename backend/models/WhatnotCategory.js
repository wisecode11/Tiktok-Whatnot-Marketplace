const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotCategorySchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    whatnot_category_id: { type: String, required: true },
    label: { type: String, default: null },
    type: { type: String, default: null },
    position: { type: Number, default: null },
    hazmat_type: { type: String, default: null },
    source: { type: String, default: "whatnot-extension" },
    extension_tab_id: { type: Number, default: null },
    raw_payload: { type: Object, default: {} },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_categories",
  },
);

WhatnotCategorySchema.index(
  { platform: 1, whatnot_category_id: 1 },
  {
    unique: true,
    partialFilterExpression: { whatnot_category_id: { $exists: true, $type: "string" } },
    name: "uniq_whatnot_category",
  },
);

module.exports = mongoose.model("WhatnotCategory", WhatnotCategorySchema);
