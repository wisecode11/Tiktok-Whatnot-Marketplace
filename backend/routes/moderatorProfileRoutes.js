const express = require("express");

const {
  getMyModeratorProfile,
  getPublicModeratorProfile,
  publishMyModeratorProfile,
  updateMyModeratorProfile,
} = require("../controllers/moderatorProfileController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.get("/me", authenticateRequest, getMyModeratorProfile);
router.put("/me", authenticateRequest, updateMyModeratorProfile);
router.post("/me/publish", authenticateRequest, publishMyModeratorProfile);
router.get("/public/:slug", getPublicModeratorProfile);

module.exports = router;
