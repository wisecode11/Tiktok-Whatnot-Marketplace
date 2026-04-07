const express = require("express");

const {
  getMyAvailability,
  getMyModeratorProfile,
  getPublicModeratorProfile,
  getPublicModeratorProfileByUser,
  listPublicModeratorProfiles,
  publishMyModeratorProfile,
  updateMyAvailability,
  updateMyModeratorProfile,
} = require("../controllers/moderatorProfileController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.get("/me", authenticateRequest, getMyModeratorProfile);
router.put("/me", authenticateRequest, updateMyModeratorProfile);
router.post("/me/publish", authenticateRequest, publishMyModeratorProfile);
router.get("/me/availability", authenticateRequest, getMyAvailability);
router.put("/me/availability", authenticateRequest, updateMyAvailability);
router.get("/public", listPublicModeratorProfiles);
router.get("/public/user/:userId", getPublicModeratorProfileByUser);
router.get("/public/:slug", getPublicModeratorProfile);

module.exports = router;
