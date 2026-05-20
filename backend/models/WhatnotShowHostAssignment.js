const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const WhatnotShowHostAssignmentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    workspace_id: { type: String, ref: "SellerWorkspace", required: true, index: true },
    seller_user_id: { type: String, ref: "User", required: true, index: true },
    platform: { type: String, default: "whatnot" },
    show_id: { type: String, required: true, index: true },
    show_title: { type: String, default: null },
    show_link: { type: String, default: null },
    scheduled_start_at: { type: Date, default: null },
    scheduled_end_at: { type: Date, default: null },
    host_staff_user_id: { type: String, ref: "User", required: true, index: true },
    assigned_at: { type: Date, default: Date.now },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_show_host_assignments",
  },
);

WhatnotShowHostAssignmentSchema.index(
  { workspace_id: 1, platform: 1, show_id: 1 },
  {
    unique: true,
    name: "uniq_show_host_assignment",
  },
);

module.exports = mongoose.model("WhatnotShowHostAssignment", WhatnotShowHostAssignmentSchema);
