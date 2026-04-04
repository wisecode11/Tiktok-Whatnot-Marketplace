const {
  createSetupIntentForSeller,
  createOrUpdateSubscriptionForSeller,
  getSellerBillingOverview,
  handleStripeWebhookEvent,
  removePaymentMethodForSeller,
  setDefaultPaymentMethodForSeller,
} = require("../services/billingService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

async function getSubscriptionOverview(req, res) {
  try {
    const result = await getSellerBillingOverview({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createSetupIntent(req, res) {
  try {
    const result = await createSetupIntentForSeller({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveDefaultPaymentMethod(req, res) {
  try {
    const result = await setDefaultPaymentMethodForSeller({
      clerkUserId: req.auth.userId,
      paymentMethodId: req.body && req.body.paymentMethodId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function deletePaymentMethod(req, res) {
  try {
    const result = await removePaymentMethodForSeller({
      clerkUserId: req.auth.userId,
      paymentMethodId: req.params.paymentMethodId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function upsertSubscription(req, res) {
  try {
    const result = await createOrUpdateSubscriptionForSeller({
      clerkUserId: req.auth.userId,
      planId: req.body && req.body.planId,
      paymentMethodId: req.body && req.body.paymentMethodId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function stripeWebhook(req, res) {
  try {
    const signature = req.headers["stripe-signature"];
    await handleStripeWebhookEvent({
      signature,
      payload: req.body,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ error: error.message || "Webhook processing failed." });
  }
}

module.exports = {
  createSetupIntent,
  deletePaymentMethod,
  getSubscriptionOverview,
  saveDefaultPaymentMethod,
  stripeWebhook,
  upsertSubscription,
};