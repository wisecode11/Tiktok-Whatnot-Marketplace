const express = require("express");
const { clockIn, clockOut, getToday, getStaffMonthlyAttendance } = require("../controllers/attendanceController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.use(authenticateRequest);

// Staff routes
router.get("/today",      getToday);
router.post("/clock-in",  clockIn);
router.post("/clock-out", clockOut);

// Seller routes
router.get("/staff/:staffId/monthly", getStaffMonthlyAttendance);

module.exports = router;
