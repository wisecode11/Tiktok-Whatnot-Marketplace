const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotShowSnapshotSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    clerk_user_id: { type: String, required: true, index: true },
    whatnot_seller_id: { type: String, default: null, index: true },
    source: { type: String, default: "whatnot-extension" },
    my_lives_payload: { type: Object, default: {} },
    shows_payload: { type: Array, default: [] },
    synced_at: { type: Date, default: Date.now, index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_show_snapshots",
  },
);

WhatnotShowSnapshotSchema.index(
  { platform: 1, clerk_user_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clerk_user_id: { $type: "string" },
    },
    name: "uniq_whatnot_show_snapshot",
  },
);

module.exports = mongoose.model("WhatnotShowSnapshot", WhatnotShowSnapshotSchema);
