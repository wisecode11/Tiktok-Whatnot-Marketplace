const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotHazmatTypeSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    hazmat_type: { type: String, required: true },
    source: { type: String, default: "whatnot-extension" },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_hazmat_types",
  },
);

WhatnotHazmatTypeSchema.index(
  { platform: 1, hazmat_type: 1 },
  {
    unique: true,
    partialFilterExpression: { hazmat_type: { $exists: true, $type: "string" } },
    name: "uniq_whatnot_hazmat_type",
  },
);

module.exports = mongoose.model("WhatnotHazmatType", WhatnotHazmatTypeSchema);
