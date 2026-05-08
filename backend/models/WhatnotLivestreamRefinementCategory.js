const mongoose = require("mongoose");
const WhatnotLivestreamRefinementCategorySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    main_category_id: {
      type: String,
      required: true,
      index: true,
      ref: "WhatnotLivestreamMainCategory",
    },
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
    collection: "whatnot_livestream_refinement_categories",
  },
);

WhatnotLivestreamRefinementCategorySchema.index({ main_category_id: 1, name: 1 });
WhatnotLivestreamRefinementCategorySchema.index({ main_category_id: 1, label: 1 });

module.exports = mongoose.model("WhatnotLivestreamRefinementCategory", WhatnotLivestreamRefinementCategorySchema);
