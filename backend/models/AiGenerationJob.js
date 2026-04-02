// models/AiGenerationJob.js
const mongoose = require("mongoose");
const uuid = require("../utils/uuid");

const AiGenerationJobSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },

  workspace_id: {
    type: String,
    ref: "SellerWorkspace",
  },

  user_id: {
    type: String,
    ref: "User",
  },

  job_type: {
    type: String,
    enum: [
      "title_generator",
      "description_generator",
      "thumbnail_suggestions",
      "script_builder",
      "show_notes_recap",
    ],
  },

  input_json: Object,
  output_json: Object,

  status: {
    type: String,
    enum: ["queued", "running", "success", "failed"],
  },

  created_at: Date,
  updated_at: Date,
});

module.exports = mongoose.model(
  "AiGenerationJob",
  AiGenerationJobSchema
);