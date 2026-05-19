const express = require("express");

const {
  createStaff,
  getStaffOrderManagementData,
  listStaff,
} = require("../controllers/staffController");
const {
  createPendingInventoryEntry,
  listPendingInventoryForSellerEntry,
  syncPendingInventoryForSellerEntry,
} = require("../controllers/pendingInventoryController");
const { listPermissions, updatePermissions, listMyPermissions } = require("../controllers/permissionsController");
const {
  assignShowHostHandler,
  listMyShowAssignmentsHandler,
  listShowHostAssignmentsHandler,
} = require("../controllers/showHostController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.use(authenticateRequest);

router.get("/members", listStaff);
router.post("/members", createStaff);
router.get("/show-host-assignments", listShowHostAssignmentsHandler);
router.get("/my-show-assignments", listMyShowAssignmentsHandler);
router.put("/show-host-assignments/:showId", assignShowHostHandler);
router.get("/members/:staffId/permissions", listPermissions);
router.put("/members/:staffId/permissions", updatePermissions);

router.get("/my-permissions", listMyPermissions);
router.get("/order-management", getStaffOrderManagementData);
router.post("/pending-inventory", createPendingInventoryEntry);
router.get("/pending-inventory", listPendingInventoryForSellerEntry);
router.post("/pending-inventory/:pendingInventoryId/sync", syncPendingInventoryForSellerEntry);
module.exports = router;