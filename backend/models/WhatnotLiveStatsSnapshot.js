const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotLiveStatsSnapshotSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    clerk_user_id: { type: String, required: true, index: true },
    live_id: { type: String, required: true, index: true },
    source: { type: String, default: "whatnot-extension" },
    statistic_payload: { type: Object, default: {} },
    raw_payload: { type: Object, default: {} },
    extension_tab_id: { type: Number, default: null },
    synced_at: { type: Date, default: Date.now, index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_live_stats_snapshots",
  },
);

WhatnotLiveStatsSnapshotSchema.index(
  { platform: 1, clerk_user_id: 1, live_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clerk_user_id: { $type: "string" },
      live_id: { $type: "string" },
    },
    name: "uniq_whatnot_live_stats_snapshot",
  },
);

module.exports = mongoose.model("WhatnotLiveStatsSnapshot", WhatnotLiveStatsSnapshotSchema);
