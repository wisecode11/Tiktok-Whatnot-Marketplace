// routes/bookingPaymentRoutes.js

const express = require("express");

const { createIntent, getStatus } = require("../controllers/bookingPaymentController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

// POST /api/booking-payments/create-intent
router.post("/create-intent", authenticateRequest, createIntent);

// GET /api/booking-payments/:bookingId/status
router.get("/:bookingId/status", authenticateRequest, getStatus);

module.exports = router;
