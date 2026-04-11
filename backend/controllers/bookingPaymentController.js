// controllers/bookingPaymentController.js

const {
  createBookingPaymentIntent,
  getBookingPaymentStatus,
  listHiredModerators,
  listModeratorBookings,
  markBookingTaskCompleted,
  submitBookingReview,
  updateBookingOrderDecision,
} = require("../services/bookingPaymentService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };
  if (error.details) payload.details = error.details;
  return res.status(status).json(payload);
}

/**
 * POST /api/booking-payments/create-intent
 * Body: { moderatorUserId, amountCents, notes?, scheduledStartAt?, scheduledEndAt?, workspaceId? }
 */
async function createIntent(req, res) {
  try {
    const body = req.body || {};
    const result = await createBookingPaymentIntent({
      clerkUserId: req.auth.userId,
      moderatorUserId: body.moderatorUserId,
      amountCents: body.amountCents,
      notes: body.notes,
      scheduledStartAt: body.scheduledStartAt,
      scheduledEndAt: body.scheduledEndAt,
      workspaceId: body.workspaceId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/booking-payments/:bookingId/status
 */
async function getStatus(req, res) {
  try {
    const result = await getBookingPaymentStatus({
      clerkUserId: req.auth.userId,
      bookingId: req.params.bookingId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/booking-payments/hired-moderators
 */
async function getHiredModerators(req, res) {
  try {
    const result = await listHiredModerators({
      clerkUserId: req.auth.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/booking-payments/moderator-bookings
 */
async function getModeratorBookings(req, res) {
  try {
    const result = await listModeratorBookings({
      clerkUserId: req.auth.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/booking-payments/:bookingId/complete
 */
async function completeTask(req, res) {
  try {
    const result = await markBookingTaskCompleted({
      clerkUserId: req.auth.userId,
      bookingId: req.params.bookingId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/booking-payments/:bookingId/decision
 * Body: { decision: "accepted" | "rejected", note?: string }
 */
async function decideOrder(req, res) {
  try {
    const result = await updateBookingOrderDecision({
      clerkUserId: req.auth.userId,
      bookingId: req.params.bookingId,
      decision: req.body && req.body.decision,
      note: req.body && req.body.note,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/booking-payments/:bookingId/review
 * Body: { rating: number, reviewText?: string }
 */
async function submitReview(req, res) {
  try {
    const result = await submitBookingReview({
      clerkUserId: req.auth.userId,
      bookingId: req.params.bookingId,
      rating: req.body && req.body.rating,
      reviewText: req.body && req.body.reviewText,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  completeTask,
  createIntent,
  decideOrder,
  getStatus,
  getHiredModerators,
  getModeratorBookings,
  submitReview,
};
