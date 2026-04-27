const express = require("express");

const { createStaff, listStaff } = require("../controllers/staffController");
const { listPermissions, updatePermissions, listMyPermissions } = require("../controllers/permissionsController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.use(authenticateRequest);

router.get("/members", listStaff);
router.post("/members", createStaff);
router.get("/members/:staffId/permissions", listPermissions);
router.put("/members/:staffId/permissions", updatePermissions);

router.get("/my-permissions", listMyPermissions);
module.exports = router;