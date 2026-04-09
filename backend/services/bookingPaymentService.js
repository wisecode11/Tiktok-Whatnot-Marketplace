// services/bookingPaymentService.js
// Handles moderator booking payments via Stripe Connect.
// Platform takes a 15% application fee; remaining 85% flows to the moderator's
// connected Stripe Express account via transfer_data.destination.

const { createClerkClient } = require("@clerk/backend");
const Stripe = require("stripe");

const ModeratorBooking = require("../models/ModeratorBooking");
const ModeratorPayout = require("../models/ModeratorPayout");
const StripeConnectAccount = require("../models/StripeConnectAccount");
const ModeratorProfile = require("../models/ModeratorProfile");
const User = require("../models/Users");

const PLATFORM_FEE_PERCENT = 0.15; // 15%
const MIN_AMOUNT_CENTS = 100; // $1.00 minimum

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw createHttpError(500, "Stripe is not configured on the server.");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });
}

function getClerkClient() {
  if (!process.env.CLERK_SECRET_KEY) {
    return null;
  }

  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

async function getPrimaryEmailFromClerk(clerkUserId) {
  if (!clerkUserId) {
    return null;
  }

  const clerkClient = getClerkClient();
  if (!clerkClient) {
    return null;
  }

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    );
    const email = (primaryEmail || clerkUser.emailAddresses[0] || {}).emailAddress || null;
    return email ? email.toLowerCase() : null;
  } catch (error) {
    console.error("Failed to read Clerk email for booking payment:", error);
    return null;
  }
}

async function getRequesterContactDetails(requester) {
  const clerkEmail = await getPrimaryEmailFromClerk(requester.clerk_user_id);
  const email = (clerkEmail || requester.email || "").trim().toLowerCase() || null;
  const name = `${requester.first_name || ""} ${requester.last_name || ""}`.trim() || undefined;

  return { email, name };
}

async function getOrCreateStripeCustomerForRequester({ stripe, requester }) {
  const { email, name } = await getRequesterContactDetails(requester);

  let customerId = requester.stripe_customer_id || null;
  let stripeCustomer = null;

  if (customerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(customerId);
      stripeCustomer = existingCustomer && !existingCustomer.deleted ? existingCustomer : null;
    } catch (error) {
      if (!(error && error.code === "resource_missing")) {
        throw error;
      }
    }
  }

  if (!stripeCustomer) {
    stripeCustomer = await stripe.customers.create({
      email: email || undefined,
      name,
      description: `Requester for moderator bookings (clerk_id: ${requester.clerk_user_id})`,
      metadata: {
        user_id: requester._id,
        user_type: "requester",
      },
    });
  } else if (stripeCustomer.email !== email || stripeCustomer.name !== name) {
    stripeCustomer = await stripe.customers.update(stripeCustomer.id, {
      email: email || undefined,
      name,
      metadata: {
        ...(stripeCustomer.metadata || {}),
        user_id: requester._id,
        user_type: "requester",
      },
    });
  }

  requester.stripe_customer_id = stripeCustomer.id;
  if (email && requester.email !== email) {
    requester.email = email;
  }
  requester.updated_at = new Date();
  await requester.save();

  return {
    customerId: stripeCustomer.id,
    customerEmail: email,
  };
}

async function findLocalUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });
  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }
  return user;
}

/**
 * Look up the moderator's Stripe Connect account.
 * Returns the StripeConnectAccount document.
 */
async function getModeratorConnectAccount(moderatorUserId) {
  const account = await StripeConnectAccount.findOne({
    user_id: moderatorUserId,
    account_type: "moderator",
  });

  if (!account || !account.stripe_account_id) {
    throw createHttpError(422, "This moderator has not connected a Stripe payout account yet.");
  }

  if (!account.charges_enabled) {
    throw createHttpError(422, "This moderator's Stripe account is not yet enabled to receive payments. They need to complete onboarding.");
  }

  return account;
}

/**
 * Calculate fee split.
 * Returns { platformFeeCents, moderatorPayoutCents }
 */
function calculateFees(grossAmountCents) {
  const platformFeeCents = Math.round(grossAmountCents * PLATFORM_FEE_PERCENT);
  const moderatorPayoutCents = grossAmountCents - platformFeeCents;
  return { platformFeeCents, moderatorPayoutCents };
}

function normalizeScheduledWindow({ scheduledStartAt, scheduledEndAt }) {
  const hasStart = Boolean(scheduledStartAt);
  const hasEnd = Boolean(scheduledEndAt);

  if (hasStart !== hasEnd) {
    throw createHttpError(400, "Both scheduledStartAt and scheduledEndAt are required together.");
  }

  if (!hasStart && !hasEnd) {
    return {
      startAt: null,
      endAt: null,
    };
  }

  const startAt = new Date(scheduledStartAt);
  const endAt = new Date(scheduledEndAt);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw createHttpError(400, "Invalid scheduledStartAt or scheduledEndAt value.");
  }

  if (endAt <= startAt) {
    throw createHttpError(400, "scheduledEndAt must be after scheduledStartAt.");
  }

  return {
    startAt,
    endAt,
  };
}

async function ensureModeratorSlotIsAvailable({ moderatorUserId, slotStartAt, slotEndAt }) {
  if (!slotStartAt || !slotEndAt) return;

  const overlappingBooking = await ModeratorBooking.findOne({
    moderator_user_id: moderatorUserId,
    status: { $nin: ["cancelled", "refunded"] },
    payment_status: { $nin: ["failed", "refunded"] },
    scheduled_start_at: { $lt: slotEndAt },
    scheduled_end_at: { $gt: slotStartAt },
  }).select("_id");

  if (overlappingBooking) {
    throw createHttpError(409, "This moderator is already booked for the selected time slot.");
  }
}

/**
 * Create or retrieve a ModeratorBooking record.
 * If bookingId is provided, validates ownership. Otherwise creates a new booking.
 */
async function upsertBooking({
  bookingId,
  requesterUserId,
  moderatorUserId,
  workspaceId,
  amountCents,
  notes,
  scheduledStartAt,
  scheduledEndAt,
}) {
  const { platformFeeCents, moderatorPayoutCents } = calculateFees(amountCents);
  const now = new Date();

  if (bookingId) {
    const existing = await ModeratorBooking.findById(bookingId);
    if (!existing) {
      throw createHttpError(404, "Booking not found.");
    }
    if (existing.requester_user_id !== requesterUserId) {
      throw createHttpError(403, "You do not have permission to pay for this booking.");
    }
    if (existing.payment_status === "paid") {
      throw createHttpError(409, "This booking has already been paid.");
    }
    return existing;
  }

  const booking = new ModeratorBooking({
    moderator_user_id: moderatorUserId,
    workspace_id: workspaceId || null,
    requester_user_id: requesterUserId,
    booking_type: "live_session",
    status: "requested",
    agreed_price_cents: amountCents,
    platform_fee_cents: platformFeeCents,
    moderator_payout_cents: moderatorPayoutCents,
    payment_status: "unpaid",
    notes: notes || null,
    scheduled_start_at: scheduledStartAt ? new Date(scheduledStartAt) : null,
    scheduled_end_at: scheduledEndAt ? new Date(scheduledEndAt) : null,
    created_at: now,
    updated_at: now,
  });

  await booking.save();
  return booking;
}

/**
 * POST /api/booking-payments/create-intent
 *
 * Creates a Stripe PaymentIntent for hiring a moderator.
 * Uses destination charges so 15% stays with the platform and
 * 85% is transferred to the moderator's connected account.
 *
 * Returns { clientSecret, bookingId, amountCents, platformFeeCents, moderatorPayoutCents }
 */
async function createBookingPaymentIntent({
  clerkUserId,
  moderatorUserId,
  amountCents,
  notes,
  scheduledStartAt,
  scheduledEndAt,
  workspaceId,
}) {
  if (!moderatorUserId) {
    throw createHttpError(400, "moderatorUserId is required.");
  }

  const totalCents = Number(amountCents);
  if (!Number.isInteger(totalCents) || totalCents < MIN_AMOUNT_CENTS) {
    throw createHttpError(400, `Amount must be at least $${(MIN_AMOUNT_CENTS / 100).toFixed(2)}.`);
  }

  const [requester, connectAccount] = await Promise.all([
    findLocalUser(clerkUserId),
    getModeratorConnectAccount(moderatorUserId),
  ]);

  if (requester._id === moderatorUserId) {
    throw createHttpError(400, "You cannot hire yourself as a moderator.");
  }

  const scheduledWindow = normalizeScheduledWindow({
    scheduledStartAt,
    scheduledEndAt,
  });

  if (!scheduledWindow.startAt || !scheduledWindow.endAt) {
    throw createHttpError(400, "scheduledStartAt and scheduledEndAt are required.");
  }

  await ensureModeratorSlotIsAvailable({
    moderatorUserId,
    slotStartAt: scheduledWindow.startAt,
    slotEndAt: scheduledWindow.endAt,
  });

  const { platformFeeCents, moderatorPayoutCents } = calculateFees(totalCents);

  // Create booking record first so we have its ID for metadata.
  const booking = await upsertBooking({
    bookingId: null,
    requesterUserId: requester._id,
    moderatorUserId,
    workspaceId,
    amountCents: totalCents,
    notes,
    scheduledStartAt: scheduledWindow.startAt,
    scheduledEndAt: scheduledWindow.endAt,
  });

  const stripe = getStripeClient();
  const { customerId, customerEmail } = await getOrCreateStripeCustomerForRequester({
    stripe,
    requester,
  });

  // Destination charge: application_fee_amount stays with platform,
  // transfer_data.destination sends remainder to moderator's connected account.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: "usd",
    customer: customerId,
    receipt_email: customerEmail || undefined,
    payment_method_types: ["card"],
    application_fee_amount: platformFeeCents,
    transfer_data: {
      destination: connectAccount.stripe_account_id,
    },
    metadata: {
      booking_id: booking._id,
      requester_user_id: requester._id,
      moderator_user_id: moderatorUserId,
      platform_fee_cents: String(platformFeeCents),
      moderator_payout_cents: String(moderatorPayoutCents),
      payment_purpose: "moderator_booking",
    },
    description: `Moderator booking – ${notes || "live session"}`,
  });

  // Persist the payment intent ID on the booking.
  booking.stripe_payment_intent_id = paymentIntent.id;
  booking.stripe_customer_id = customerId;
  booking.payment_status = "pending";
  booking.updated_at = new Date();
  await booking.save();

  return {
    clientSecret: paymentIntent.client_secret,
    bookingId: booking._id,
    paymentIntentId: paymentIntent.id,
    amountCents: totalCents,
    platformFeeCents,
    moderatorPayoutCents,
    currency: "usd",
  };
}

/**
 * Called by the webhook handler when payment_intent.succeeded fires
 * and the metadata.payment_purpose === "moderator_booking".
 */
async function handleBookingPaymentSucceeded(paymentIntent) {
  const bookingId = paymentIntent.metadata && paymentIntent.metadata.booking_id;
  if (!bookingId) return;

  const booking = await ModeratorBooking.findById(bookingId);
  if (!booking) return;

  // Idempotency: skip if already processed.
  if (booking.payment_status === "paid") return;

  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge && paymentIntent.latest_charge.id;

  const now = new Date();
  booking.payment_status = "paid";
  booking.stripe_charge_id = chargeId || booking.stripe_charge_id || null;
  booking.status = "accepted"; // auto-accept on payment
  booking.updated_at = now;
  await booking.save();

  // Create payout ledger record.
  const existing = await ModeratorPayout.findOne({ stripe_payment_intent_id: paymentIntent.id });
  if (!existing) {
    const gross = booking.agreed_price_cents || paymentIntent.amount || 0;
    const fee = booking.platform_fee_cents || Math.round(gross * PLATFORM_FEE_PERCENT);
    const net = booking.moderator_payout_cents || gross - fee;

    const payout = new ModeratorPayout({
      booking_id: booking._id,
      moderator_user_id: booking.moderator_user_id,
      stripe_payment_intent_id: paymentIntent.id,
      gross_amount_cents: gross,
      platform_fee_cents: fee,
      net_amount_cents: net,
      amount_cents: net,
      currency: paymentIntent.currency || "usd",
      status: "pending", // will become "paid" once Stripe actually pays out
      created_at: now,
      updated_at: now,
    });

    await payout.save();
  }

  // Create a one-time Stripe invoice record for this already-paid booking.
  if (booking.stripe_customer_id && !booking.stripe_invoice_id) {
    try {
      const stripe = getStripeClient();
      const gross = booking.agreed_price_cents || 0;
      const platformFee = booking.platform_fee_cents || 0;
      const moderatorPayout = booking.moderator_payout_cents || 0;
      const paymentIntentInvoiceId =
        typeof paymentIntent.invoice === "string"
          ? paymentIntent.invoice
          : paymentIntent.invoice && paymentIntent.invoice.id;

      if (paymentIntentInvoiceId) {
        booking.stripe_invoice_id = paymentIntentInvoiceId;
        booking.updated_at = new Date();
        await booking.save();
        return;
      }

      const invoice = await stripe.invoices.create({
        customer: booking.stripe_customer_id,
        auto_advance: false,
        collection_method: "send_invoice",
        days_until_due: 0,
        description: `Moderator booking - ${booking.notes || "Live Session"}`,
        metadata: {
          booking_id: booking._id,
          payment_intent_id: paymentIntent.id,
          booking_type: "moderator_booking",
        },
      });

      await stripe.invoiceItems.create({
        customer: booking.stripe_customer_id,
        invoice: invoice.id,
        amount: gross,
        currency: paymentIntent.currency || "usd",
        description: `Moderator Booking: ${booking.notes || "Live Session"} (Platform fee $${(platformFee / 100).toFixed(2)}, moderator payout $${(moderatorPayout / 100).toFixed(2)})`,
        metadata: {
          booking_id: booking._id,
          breakdown: `Platform Fee: $${(platformFee / 100).toFixed(2)} | Moderator: $${(moderatorPayout / 100).toFixed(2)}`,
        },
      });

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id, {
        paid_out_of_band: true,
      });

      booking.stripe_invoice_id = paidInvoice.id;
      booking.updated_at = new Date();
      await booking.save();
    } catch (invoiceError) {
      console.error("Failed to create invoice for booking:", invoiceError);
      // Don't fail the entire webhook if invoice creation fails
    }
  }
}

/**
 * Called by the webhook handler when payment_intent.payment_failed fires
 * and the metadata.payment_purpose === "moderator_booking".
 */
async function handleBookingPaymentFailed(paymentIntent) {
  const bookingId = paymentIntent.metadata && paymentIntent.metadata.booking_id;
  if (!bookingId) return;

  const booking = await ModeratorBooking.findById(bookingId);
  if (!booking) return;
  if (booking.payment_status === "paid") return;

  booking.payment_status = "failed";
  booking.updated_at = new Date();
  await booking.save();
}

/**
 * Get booking + payout status for the frontend after payment.
 */
async function getBookingPaymentStatus({ clerkUserId, bookingId }) {
  const user = await findLocalUser(clerkUserId);
  const booking = await ModeratorBooking.findById(bookingId);

  if (!booking) {
    throw createHttpError(404, "Booking not found.");
  }

  if (booking.requester_user_id !== user._id && booking.moderator_user_id !== user._id) {
    throw createHttpError(403, "You do not have access to this booking.");
  }

  return {
    bookingId: booking._id,
    status: booking.status,
    paymentStatus: booking.payment_status,
    amountCents: booking.agreed_price_cents,
    platformFeeCents: booking.platform_fee_cents,
    moderatorPayoutCents: booking.moderator_payout_cents,
    stripePaymentIntentId: booking.stripe_payment_intent_id || null,
    scheduledStartAt: booking.scheduled_start_at ? booking.scheduled_start_at.toISOString() : null,
    scheduledEndAt: booking.scheduled_end_at ? booking.scheduled_end_at.toISOString() : null,
    notes: booking.notes || null,
    createdAt: booking.created_at ? booking.created_at.toISOString() : null,
  };
}

/**
 * List all moderator bookings created by the currently authenticated streamer.
 */
async function listHiredModerators({ clerkUserId }) {
  const requester = await findLocalUser(clerkUserId);

  const bookings = await ModeratorBooking.find({ requester_user_id: requester._id })
    .sort({ created_at: -1 })
    .limit(500);

  const moderatorUserIds = Array.from(
    new Set(bookings.map((booking) => String(booking.moderator_user_id)).filter(Boolean)),
  );

  const [moderators, moderatorProfiles] = await Promise.all([
    User.find({ _id: { $in: moderatorUserIds } }).select("_id first_name last_name email"),
    ModeratorProfile.find({ user_id: { $in: moderatorUserIds } }).select("user_id public_slug"),
  ]);

  const moderatorById = new Map(moderators.map((moderator) => [String(moderator._id), moderator]));
  const moderatorProfileByUserId = new Map(
    moderatorProfiles.map((profile) => [String(profile.user_id), profile]),
  );

  const rows = bookings.map((booking) => {
    const moderator = moderatorById.get(String(booking.moderator_user_id));
    const profile = moderatorProfileByUserId.get(String(booking.moderator_user_id));

    const moderatorName = moderator
      ? [moderator.first_name, moderator.last_name].filter(Boolean).join(" ").trim()
        || (moderator.email ? String(moderator.email).split("@")[0] : "Moderator")
      : "Moderator";

    return {
      bookingId: booking._id,
      moderatorUserId: booking.moderator_user_id || null,
      moderatorName,
      moderatorEmail: moderator && moderator.email ? String(moderator.email).toLowerCase() : null,
      moderatorPublicSlug: profile && profile.public_slug ? profile.public_slug : null,
      paymentStatus: booking.payment_status || "unpaid",
      bookingStatus: booking.status || "requested",
      scheduledStartAt: booking.scheduled_start_at ? booking.scheduled_start_at.toISOString() : null,
      scheduledEndAt: booking.scheduled_end_at ? booking.scheduled_end_at.toISOString() : null,
      createdAt: booking.created_at ? booking.created_at.toISOString() : null,
    };
  });

  return { bookings: rows };
}

module.exports = {
  createBookingPaymentIntent,
  handleBookingPaymentSucceeded,
  handleBookingPaymentFailed,
  getBookingPaymentStatus,
  listHiredModerators,
};
