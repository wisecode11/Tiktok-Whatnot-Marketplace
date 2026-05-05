const express = require("express");

const {
	activateSellerOrganizationEntry,
	createSellerOrganizationEntry,
	getSellerOrganizations,
	login,
	me,
	syncSellerActiveOrganizationEntry,
	syncUser,
} = require("../controllers/authController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.post("/sync-user", authenticateRequest, syncUser);
router.post("/login", authenticateRequest, login);
router.get("/me", authenticateRequest, me);
router.get("/seller-organizations", authenticateRequest, getSellerOrganizations);
router.post("/seller-organizations", authenticateRequest, createSellerOrganizationEntry);
router.post("/seller-organizations/activate", authenticateRequest, activateSellerOrganizationEntry);
router.post("/seller-organizations/sync-active", authenticateRequest, syncSellerActiveOrganizationEntry);

module.exports = router;
