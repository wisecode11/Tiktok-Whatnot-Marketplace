const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const GetSessionApiDataSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    platform: { type: String, default: "whatnot" },
    source: { type: String, default: "whatnot-extension" },
    csrf_token: { type: String, default: null },
    session_extension_token: { type: String, default: null },
    response_payload: { type: Object, default: {} },
    extension_tab_id: { type: Number, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "GET Session api data",
  },
);

module.exports = mongoose.model("GetSessionApiData", GetSessionApiDataSchema);
