// controllers/bookingPaymentController.js

const {
  createBookingPaymentIntent,
  getBookingPaymentStatus,
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

module.exports = {
  createIntent,
  getStatus,
};
