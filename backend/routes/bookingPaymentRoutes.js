// routes/bookingPaymentRoutes.js

const express = require("express");

const {
	completeTask,
	createIntent,
	decideOrder,
	getStatus,
	getHiredModerators,
	getModeratorBookings,
	submitReview,
} = require("../controllers/bookingPaymentController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

// POST /api/booking-payments/create-intent
router.post("/create-intent", authenticateRequest, createIntent);

// GET /api/booking-payments/hired-moderators
router.get("/hired-moderators", authenticateRequest, getHiredModerators);

// GET /api/booking-payments/moderator-bookings
router.get("/moderator-bookings", authenticateRequest, getModeratorBookings);

// GET /api/booking-payments/:bookingId/status
router.get("/:bookingId/status", authenticateRequest, getStatus);

// POST /api/booking-payments/:bookingId/complete
router.post("/:bookingId/complete", authenticateRequest, completeTask);

// POST /api/booking-payments/:bookingId/decision
router.post("/:bookingId/decision", authenticateRequest, decideOrder);

// POST /api/booking-payments/:bookingId/review
router.post("/:bookingId/review", authenticateRequest, submitReview);

module.exports = router;
