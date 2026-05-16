const express = require("express");
const { authenticateRequest } = require("../middleware/authenticate");
const {
  generateTitleHandler,
  generateDescriptionHandler,
  generateThumbnailSuggestionsHandler,
  generateThumbnailImageHandler,
  generateScriptHandler,
  generateInventoryListingHandler,
  generateInventoryThumbnailHandler,
} = require("../controllers/aiController");

const router = express.Router();

// All AI routes require authentication
router.use(authenticateRequest);

// Title Generator
router.post("/generate-title", generateTitleHandler);

// Description Generator
router.post("/generate-description", generateDescriptionHandler);

// Thumbnail Suggestions (text only — fast)
router.post("/generate-thumbnails", generateThumbnailSuggestionsHandler);

// Single Thumbnail Image (one at a time — called per card)
router.post("/generate-thumbnail-image", generateThumbnailImageHandler);

// Script Builder
router.post("/generate-script", generateScriptHandler);

// Inventory listing (title + short description from category)
router.post("/generate-inventory-listing", generateInventoryListingHandler);

// Fast inventory thumbnail (single image, optimized for speed)
router.post("/generate-inventory-thumbnail", generateInventoryThumbnailHandler);

module.exports = router;
