const Stripe = require("stripe");
const {
  WorkspaceSubscription,
  SubscriptionPlan,
  SubscriptionInvoice,
  SubscriptionPayment,
  SellerWorkspace,
  User,
} = require("../models");
const {
  createStripeProductAndPrice,
  updateStripeProduct,
  replaceStripeRecurringPrice,
} = require("../services/subscriptionPlanStripeAdminService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };
  if (error.details) {
    payload.details = error.details;
  }
  return res.status(status).json(payload);
}

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw createHttpError(500, "Stripe is not configured on the server.");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// ─── Plans ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/subscriptions/plans
 * List all subscription plans (active and inactive).
 */
async function listPlans(req, res) {
  try {
    const plans = await SubscriptionPlan.find({}).sort({ display_order: 1, created_at: -1 }).lean();
    return res.status(200).json({ plans });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/admin/subscriptions/plans
 * Creates a SubscriptionPlan and, when Stripe is configured and price > 0, a Stripe Product + recurring Price
 * so sellers can subscribe to the same price in checkout.
 */
async function createPlan(req, res) {
  try {
    const {
      name,
      description,
      price,
      currency = "usd",
      billing_interval = "month",
      features,
      display_order = 0,
      is_active = true,
    } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      throw createHttpError(400, "Plan name is required.");
    }
    if (typeof price !== "number" || price < 0) {
      throw createHttpError(400, "A valid price (number >= 0) is required.");
    }

    const now = new Date();
    const features_json = Array.isArray(features)
      ? features.map((f) => String(f).trim()).filter(Boolean)
      : [];

    let stripe_product_id = null;
    let stripe_price_id = null;
    let metadata_json = null;

    if (process.env.STRIPE_SECRET_KEY && price > 0) {
      const stripeResult = await createStripeProductAndPrice({
        name: name.trim(),
        description: description || "",
        amountDollars: price,
        currency,
        billingInterval: billing_interval,
        features: features_json,
        displayOrder: Number(display_order) || 0,
        activatePrice: Boolean(is_active),
      });
      stripe_product_id = stripeResult.stripe_product_id;
      stripe_price_id = stripeResult.stripe_price_id;
      metadata_json = stripeResult.metadata_json;
    }

    const plan = new SubscriptionPlan({
      name: name.trim(),
      description: description || "",
      price,
      currency,
      billing_interval,
      features_json,
      display_order: Number(display_order) || 0,
      is_active: Boolean(is_active),
      stripe_product_id,
      stripe_price_id,
      metadata_json,
      created_at: now,
      updated_at: now,
    });

    await plan.save();
    return res.status(201).json({ plan });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * PATCH /api/admin/subscriptions/plans/:planId
 * Updates plan fields; syncs name/description to Stripe Product when linked.
 * If amount, currency, or billing interval changes, creates a new Stripe Price and archives the old one.
 * If the plan had no Stripe linkage and Stripe is configured with a positive price, creates Product + Price.
 */
async function updatePlan(req, res) {
  try {
    const { planId } = req.params;
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      throw createHttpError(404, "Subscription plan not found.");
    }

    const {
      name,
      description,
      price,
      currency,
      billing_interval,
      features,
      display_order,
      is_active,
    } = req.body || {};

    const prevPrice = Number(plan.price);
    const prevCurrency = String(plan.currency || "usd").toLowerCase();
    const prevInterval = plan.billing_interval || "month";

    if (name !== undefined) plan.name = String(name).trim();
    if (description !== undefined) plan.description = description;
    if (price !== undefined) plan.price = Number(price);
    if (currency !== undefined) plan.currency = currency;
    if (billing_interval !== undefined) plan.billing_interval = billing_interval;
    if (Array.isArray(features)) {
      plan.features_json = features.map((f) => String(f).trim()).filter(Boolean);
    }
    if (display_order !== undefined) plan.display_order = Number(display_order) || 0;
    if (is_active !== undefined) plan.is_active = Boolean(is_active);
    plan.updated_at = new Date();

    const nextPrice = Number(plan.price);
    const nextCurrency = String(plan.currency || "usd").toLowerCase();
    const nextInterval = plan.billing_interval || "month";

    const pricingChanged =
      nextPrice !== prevPrice ||
      nextCurrency !== prevCurrency ||
      nextInterval !== prevInterval;

    if (process.env.STRIPE_SECRET_KEY) {
      if (plan.stripe_product_id && plan.stripe_price_id && pricingChanged && nextPrice > 0) {
        const meta =
          plan.metadata_json && typeof plan.metadata_json === "object" ? plan.metadata_json : {};
        const app_plan_key = meta.app_plan_key || undefined;

        const { stripe_price_id: newPriceId } = await replaceStripeRecurringPrice({
          stripe_product_id: plan.stripe_product_id,
          previous_price_id: plan.stripe_price_id,
          amountDollars: nextPrice,
          currency: nextCurrency,
          billingInterval: nextInterval,
          app_plan_key,
          displayOrder: plan.display_order,
          activatePrice: Boolean(plan.is_active),
        });
        plan.stripe_price_id = newPriceId;
      } else if (!plan.stripe_price_id && nextPrice > 0) {
        const stripeResult = await createStripeProductAndPrice({
          name: plan.name,
          description: plan.description || "",
          amountDollars: nextPrice,
          currency: nextCurrency,
          billingInterval: nextInterval,
          features: plan.features_json || [],
          displayOrder: plan.display_order,
          activatePrice: Boolean(plan.is_active),
        });
        plan.stripe_product_id = stripeResult.stripe_product_id;
        plan.stripe_price_id = stripeResult.stripe_price_id;
        plan.metadata_json = { ...(plan.metadata_json || {}), ...stripeResult.metadata_json };
      }

      if (plan.stripe_product_id && (name !== undefined || description !== undefined)) {
        await updateStripeProduct(plan.stripe_product_id, {
          name: plan.name,
          description: plan.description,
        });
      }

      if (plan.stripe_product_id && (Array.isArray(features) || display_order !== undefined)) {
        const stripe = getStripeClient();
        const existing = await stripe.products.retrieve(plan.stripe_product_id);
        const prevMeta = (existing && existing.metadata) || {};
        await stripe.products.update(plan.stripe_product_id, {
          metadata: {
            ...prevMeta,
            features: JSON.stringify(plan.features_json || []),
            display_order: String(plan.display_order ?? 0),
          },
        });
      }
      if (is_active !== undefined && plan.stripe_price_id) {
        const stripe = getStripeClient();
        await stripe.prices.update(plan.stripe_price_id, { active: Boolean(plan.is_active) });
      }
    }

    await plan.save();
    return res.status(200).json({ plan });
  } catch (error) {
    return sendError(res, error);
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/subscriptions
 * List all workspace subscriptions with workspace + owner details.
 * Query params: page, limit, status
 */
async function listSubscriptions(req, res) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const [subscriptions, total] = await Promise.all([
      WorkspaceSubscription.find(query)
        .sort({ updated_at: -1, created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      WorkspaceSubscription.countDocuments(query),
    ]);

    // Enrich with workspace, owner user, and plan data
    const enriched = await Promise.all(
      subscriptions.map(async (sub) => {
        const [workspace, plan] = await Promise.all([
          sub.workspace_id
            ? SellerWorkspace.findById(sub.workspace_id).lean()
            : null,
          sub.plan_id
            ? SubscriptionPlan.findById(sub.plan_id).lean()
            : null,
        ]);

        const owner = workspace
          ? await User.findById(workspace.owner_user_id)
              .select("first_name last_name email user_type")
              .lean()
          : null;

        return {
          ...sub,
          workspace: workspace
            ? {
                _id: workspace._id,
                business_name: workspace.business_name,
                billing_email: workspace.billing_email,
                status: workspace.status,
              }
            : null,
          owner: owner
            ? {
                _id: owner._id,
                first_name: owner.first_name,
                last_name: owner.last_name,
                email: owner.email,
                user_type: owner.user_type,
              }
            : null,
          plan: plan
            ? {
                _id: plan._id,
                name: plan.name,
                price: plan.price,
                currency: plan.currency,
                billing_interval: plan.billing_interval,
              }
            : null,
        };
      }),
    );

    return res.status(200).json({
      data: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/admin/subscriptions/:subscriptionId
 * Get full details for a single subscription, including invoice and payment history.
 */
async function getSubscriptionById(req, res) {
  try {
    const { subscriptionId } = req.params;
    const sub = await WorkspaceSubscription.findById(subscriptionId).lean();

    if (!sub) {
      throw createHttpError(404, "Subscription not found.");
    }

    const [workspace, plan, invoices, payments] = await Promise.all([
      sub.workspace_id ? SellerWorkspace.findById(sub.workspace_id).lean() : null,
      sub.plan_id ? SubscriptionPlan.findById(sub.plan_id).lean() : null,
      SubscriptionInvoice.find({ workspace_subscription_id: sub._id })
        .sort({ created_at: -1 })
        .limit(50)
        .lean(),
      SubscriptionPayment.find({ workspace_subscription_id: sub._id })
        .sort({ created_at: -1 })
        .limit(50)
        .lean(),
    ]);

    const owner = workspace
      ? await User.findById(workspace.owner_user_id)
          .select("first_name last_name email user_type clerk_user_id")
          .lean()
      : null;

    const allPlans = await SubscriptionPlan.find({ is_active: true }).sort({ display_order: 1 }).lean();

    return res.status(200).json({
      subscription: sub,
      workspace,
      owner,
      plan,
      invoices,
      payments,
      availablePlans: allPlans,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * PATCH /api/admin/subscriptions/:subscriptionId/plan
 * Admin changes the plan on a subscription (upgrade / downgrade).
 * This updates the local DB record only – if Stripe is wired, use Stripe upgrade separately.
 */
async function changeSubscriptionPlan(req, res) {
  try {
    const { subscriptionId } = req.params;
    const { planId } = req.body || {};

    if (!planId) {
      throw createHttpError(400, "planId is required.");
    }

    const [sub, plan] = await Promise.all([
      WorkspaceSubscription.findById(subscriptionId),
      SubscriptionPlan.findById(planId).lean(),
    ]);

    if (!sub) throw createHttpError(404, "Subscription not found.");
    if (!plan) throw createHttpError(404, "Subscription plan not found.");

    sub.plan_id = plan._id;
    sub.updated_at = new Date();
    await sub.save();

    return res.status(200).json({ subscription: sub, plan });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/admin/subscriptions/:subscriptionId/cancel
 * Admin cancels a subscription immediately.
 * If Stripe is configured and a stripe_subscription_id exists, cancels on Stripe too.
 */
async function cancelSubscription(req, res) {
  try {
    const { subscriptionId } = req.params;
    const sub = await WorkspaceSubscription.findById(subscriptionId);

    if (!sub) throw createHttpError(404, "Subscription not found.");
    if (sub.status === "cancelled") {
      throw createHttpError(400, "Subscription is already cancelled.");
    }

    const now = new Date();

    // Cancel on Stripe if possible
    if (sub.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch (stripeError) {
        // Log but don't block local cancel
        console.error(
          "Stripe cancel error (local cancel will proceed):",
          stripeError.message || stripeError,
        );
      }
    }

    sub.status = "cancelled";
    sub.cancelled_at = now;
    sub.cancel_at_period_end = false;
    sub.updated_at = now;
    await sub.save();

    // Sync workspace status
    if (sub.workspace_id) {
      const workspace = await SellerWorkspace.findById(sub.workspace_id);
      if (workspace) {
        workspace.status = "cancelled";
        workspace.updated_at = now;
        await workspace.save();
      }
    }

    return res.status(200).json({ subscription: sub, message: "Subscription cancelled successfully." });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/admin/subscriptions/:subscriptionId/refund
 * Admin issues a refund for the latest paid invoice on the subscription via Stripe.
 * Body: { amount_cents } — optional, defaults to full refund of latest paid invoice.
 */
async function refundSubscription(req, res) {
  try {
    const { subscriptionId } = req.params;
    const { amount_cents } = req.body || {};

    const sub = await WorkspaceSubscription.findById(subscriptionId).lean();
    if (!sub) throw createHttpError(404, "Subscription not found.");

    if (!process.env.STRIPE_SECRET_KEY) {
      throw createHttpError(500, "Stripe is not configured. Cannot process refund.");
    }

    // Find the latest paid invoice
    const latestPaidInvoice = await SubscriptionInvoice.findOne({
      workspace_subscription_id: sub._id,
      status: "paid",
    })
      .sort({ created_at: -1 })
      .lean();

    if (!latestPaidInvoice) {
      throw createHttpError(400, "No paid invoice found for this subscription.");
    }
    if (!latestPaidInvoice.stripe_payment_intent_id) {
      throw createHttpError(400, "Invoice has no payment intent. Cannot refund.");
    }

    const stripe = getStripeClient();
    const refundAmount = amount_cents
      ? Number(amount_cents)
      : latestPaidInvoice.amount_paid_cents;

    const refund = await stripe.refunds.create({
      payment_intent: latestPaidInvoice.stripe_payment_intent_id,
      amount: refundAmount,
    });

    return res.status(200).json({
      message: "Refund processed successfully.",
      refundId: refund.id,
      amount_cents: refund.amount,
      currency: refund.currency,
      status: refund.status,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/admin/subscriptions/stats
 * High-level subscription stats for admin dashboard.
 */
async function getSubscriptionStats(req, res) {
  try {
    const [total, active, cancelled, trialing] = await Promise.all([
      WorkspaceSubscription.countDocuments({}),
      WorkspaceSubscription.countDocuments({ status: "active" }),
      WorkspaceSubscription.countDocuments({ status: "cancelled" }),
      WorkspaceSubscription.countDocuments({ status: "trialing" }),
    ]);

    // MRR estimate: sum of plan prices for active subscriptions
    const activeSubscriptions = await WorkspaceSubscription.find({
      status: "active",
      plan_id: { $nin: [null, ""] },
    })
      .select("plan_id")
      .lean();

    const planIds = activeSubscriptions.map((s) => s.plan_id).filter(Boolean);
    const plans = await SubscriptionPlan.find({ _id: { $in: planIds } })
      .select("_id price billing_interval")
      .lean();

    const planMap = {};
    for (const p of plans) {
      planMap[p._id] = p;
    }

    let estimatedMrr = 0;
    for (const sub of activeSubscriptions) {
      const plan = planMap[sub.plan_id];
      if (!plan) continue;
      if (plan.billing_interval === "year") {
        estimatedMrr += (plan.price || 0) / 12;
      } else {
        estimatedMrr += plan.price || 0;
      }
    }

    return res.status(200).json({
      total,
      active,
      cancelled,
      trialing,
      estimatedMrr: Math.round(estimatedMrr * 100) / 100,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  listPlans,
  createPlan,
  updatePlan,
  listSubscriptions,
  getSubscriptionById,
  changeSubscriptionPlan,
  cancelSubscription,
  refundSubscription,
  getSubscriptionStats,
};
