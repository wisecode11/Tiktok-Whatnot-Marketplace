const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const PendingInventorySchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    owner_seller_user_id: { type: String, required: true, index: true },
    created_by_user_id: { type: String, required: true, index: true },
    created_by_clerk_user_id: { type: String, required: true, index: true },
    subcategory_id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    price_usd: { type: Number, required: true },
    shipping_profile_id: { type: String, required: true },
    hazmat_type: { type: String, required: true },
    image_id: { type: String, default: "" },
    image_payload: { type: Object, default: {} },
    status: { type: String, default: "PENDING" },
    synced_listing_id: { type: String, default: null },
    synced_listing_uuid: { type: String, default: null },
    synced_at: { type: Date, default: null },
    sync_error: { type: String, default: null },
    sync_response: { type: Object, default: null },
    source: { type: String, default: "staff-dashboard" },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "pending_inventory",
  },
);

PendingInventorySchema.index(
  { owner_seller_user_id: 1, status: 1, created_at: -1 },
  { name: "pending_inventory_owner_status_created_at_idx" },
);

module.exports = mongoose.model("PendingInventory", PendingInventorySchema);
