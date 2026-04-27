const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const SellerSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    clerk_user_id: { type: String, default: null },
    whatnot_user_id: { type: String, default: null },
    whatnot_username: { type: String, default: null },
    csrf_token: { type: String, default: null },
    session_extension_token: { type: String, default: null },
    access_token: { type: String, default: null },
    cookies_present: { type: Object, default: {} },
    session_payload: { type: Object, default: {} },
    source: { type: String, default: "whatnot-extension" },
    extension_tab_id: { type: Number, default: null },
    connected_at: { type: Date, default: Date.now },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "seller-sesssions",
  },
);

module.exports = mongoose.model("SellerSession", SellerSessionSchema);
