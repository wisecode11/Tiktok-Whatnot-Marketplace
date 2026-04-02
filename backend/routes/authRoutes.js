const express = require("express");

const { login, me, syncUser } = require("../controllers/authController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.post("/sync-user", authenticateRequest, syncUser);
router.post("/login", authenticateRequest, login);
router.get("/me", authenticateRequest, me);

module.exports = router;
