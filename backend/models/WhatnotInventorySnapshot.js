const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotInventorySnapshotSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    clerk_user_id: { type: String, required: true, index: true },
    status_filter: { type: String, required: true, index: true },
    inventory_id: { type: String, required: true },
    source: { type: String, default: "whatnot-extension" },
    request_payload: { type: Object, default: {} },
    response_payload: { type: Object, default: {} },
    extension_tab_id: { type: Number, default: null },
    synced_at: { type: Date, default: Date.now, index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_inventory_snapshots",
  },
);

WhatnotInventorySnapshotSchema.index(
  { platform: 1, clerk_user_id: 1, status_filter: 1, inventory_id: 1 },
  {
    unique: true,
    partialFilterExpression: { inventory_id: { $exists: true, $type: "string" } },
    name: "uniq_whatnot_inventory_snapshot_item",
  },
);

module.exports = mongoose.model("WhatnotInventorySnapshot", WhatnotInventorySnapshotSchema);
