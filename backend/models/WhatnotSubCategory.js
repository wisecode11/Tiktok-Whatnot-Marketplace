const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotSubCategorySchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    whatnot_category_id: { type: String, required: true, index: true },
    subcategory_id: { type: String, required: true },
    parent_subcategory_id: { type: String, default: null },
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
    collection: "whatnot_subcategories",
  },
);

WhatnotSubCategorySchema.index(
  { platform: 1, whatnot_category_id: 1, subcategory_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      whatnot_category_id: { $exists: true, $type: "string" },
      subcategory_id: { $exists: true, $type: "string" },
    },
    name: "uniq_whatnot_subcategory",
  },
);

module.exports = mongoose.model("WhatnotSubCategory", WhatnotSubCategorySchema);
