const mongoose = require("mongoose");
const WhatnotLivestreamMainCategorySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, default: null },
    label: { type: String, default: null },
    can_schedule_live: { type: Boolean, default: false },
    application_link: { type: String, default: null },
    quiz_link: { type: String, default: null },
    image_id: { type: String, default: null },
    image_url: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "whatnot_livestream_main_categories",
  },
);

WhatnotLivestreamMainCategorySchema.index({ name: 1 });
WhatnotLivestreamMainCategorySchema.index({ label: 1 });

module.exports = mongoose.model("WhatnotLivestreamMainCategory", WhatnotLivestreamMainCategorySchema);
