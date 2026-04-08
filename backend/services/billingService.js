const Stripe = require("stripe");

const {
  SellerWorkspace,
  SubscriptionInvoice,
  SubscriptionPayment,
  SubscriptionPlan,
  User,
  WorkspaceSubscription,
} = require("../models");

const SINGLE_SELLER_PLAN_KEY = "seller-monthly-300";

let stripeClient;

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw createHttpError(500, "Stripe is not configured on the server.");
  }

  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

function getWebhookSecret() {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw createHttpError(500, "STRIPE_WEBHOOK_SECRET is not configured.");
  }

  return process.env.STRIPE_WEBHOOK_SECRET;
}

function normalizeStripeStatus(status) {
  if (status === "canceled") {
    return "cancelled";
  }

  return status || "inactive";
}

function normalizeInterval(interval) {
  if (!interval) {
    return "month";
  }

  if (interval === "monthly") {
    return "month";
  }

  if (interval === "yearly") {
    return "year";
  }

  return interval;
}

function extractStripeId(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value.id) {
    return value.id;
  }

  return null;
}

function parseFeatures(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (error) {
      // Fall back to delimiter parsing.
    }

    return trimmed
      .split(/\r?\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    return Object.values(value)
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return [];
}

function toDateFromUnix(value) {
  if (!value) {
    return null;
  }

  return new Date(Number(value) * 1000);
}

function shouldIncludeSellerPlan(price, product) {
  if (!price || !price.active || price.type !== "recurring") {
    return false;
  }

  const metadata = {
    ...((product && product.metadata) || {}),
    ...(price.metadata || {}),
  };

  if (metadata.app_plan_key !== SINGLE_SELLER_PLAN_KEY) {
    return false;
  }

  const hasExplicitRoleMetadata = Boolean(metadata.role || metadata.roles);

  if (!hasExplicitRoleMetadata) {
    return false;
  }

  const roleValue = String(metadata.role || metadata.roles).toLowerCase();
  const roles = roleValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return roles.includes("seller") || roles.includes("streamer") || roles.includes("all");
}

async function getExpandedProduct(price) {
  const stripe = getStripeClient();

  if (!price || !price.product) {
    return null;
  }

  if (typeof price.product === "object" && price.product.name) {
    return price.product;
  }

  return stripe.products.retrieve(price.product);
}

async function upsertPlanFromStripePrice(price) {
  if (!price || !price.id) {
    return null;
  }

  const product = await getExpandedProduct(price);

  if (!shouldIncludeSellerPlan(price, product)) {
    return null;
  }

  const metadata = {
    ...((product && product.metadata) || {}),
    ...(price.metadata || {}),
  };
  const features = parseFeatures(metadata.features);
  const name = price.nickname || (product && product.name) || "Subscription plan";
  const description = (product && product.description) || metadata.description || "";
  const existingPlans = await SubscriptionPlan.find({ stripe_price_id: price.id }).sort({ created_at: 1, _id: 1 });
  const now = new Date();
  const plan = existingPlans[0] || new SubscriptionPlan({ created_at: now });

  plan.name = name;
  plan.description = description;
  plan.price = Number((price.unit_amount || 0) / 100);
  plan.currency = price.currency || "usd";
  plan.billing_interval = normalizeInterval(price.recurring && price.recurring.interval);
  plan.stripe_price_id = price.id;
  plan.stripe_product_id = typeof price.product === "string" ? price.product : price.product && price.product.id;
  plan.features_json = features;
  plan.metadata_json = metadata;
  plan.display_order = Number(metadata.display_order || metadata.order || plan.display_order || 0);
  plan.is_active = Boolean(price.active);
  plan.updated_at = now;

  await plan.save();

  const duplicateIds = existingPlans
    .slice(1)
    .map((item) => item._id)
    .filter((id) => String(id) !== String(plan._id));

  if (duplicateIds.length) {
    await SubscriptionPlan.deleteMany({ _id: { $in: duplicateIds } });
  }

  return plan;
}

async function syncPlansFromStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return [];
  }

  const stripe = getStripeClient();
  const prices = await stripe.prices.list({
    active: true,
    expand: ["data.product"],
    limit: 100,
    type: "recurring",
  });

  const includedStripePriceIds = [];

  for (const price of prices.data) {
    const syncedPlan = await upsertPlanFromStripePrice(price);

    if (syncedPlan && syncedPlan.stripe_price_id) {
      includedStripePriceIds.push(syncedPlan.stripe_price_id);
    }
  }

  await SubscriptionPlan.updateMany(
    includedStripePriceIds.length
      ? {
          $and: [
            { stripe_price_id: { $nin: [null, ""] } },
            { stripe_price_id: { $nin: includedStripePriceIds } },
          ],
        }
      : { stripe_price_id: { $nin: [null, ""] } },
    {
      $set: {
        is_active: false,
        updated_at: new Date(),
      },
    },
  );

  return SubscriptionPlan.find({
    is_active: true,
    stripe_price_id: { $nin: [null, ""] },
    "metadata_json.app_plan_key": SINGLE_SELLER_PLAN_KEY,
  }).sort({ display_order: 1, price: 1, name: 1 });
}

async function findSellerUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  if (user.user_type !== "seller") {
    throw createHttpError(403, "Billing is only available for seller accounts.");
  }

  return user;
}

async function ensureWorkspaceForSeller(user) {
  const existing = await SellerWorkspace.findOne({ owner_user_id: user._id });

  if (existing) {
    return existing;
  }

  const now = new Date();
  const workspace = new SellerWorkspace({
    owner_user_id: user._id,
    business_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
    billing_email: user.email,
    billing_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
    status: "trial",
    created_at: now,
    updated_at: now,
  });

  await workspace.save();
  return workspace;
}

async function ensureStripeCustomer({ workspace, user }) {
  const stripe = getStripeClient();
  let customer = null;

  if (workspace.stripe_customer_id) {
    try {
      customer = await stripe.customers.retrieve(workspace.stripe_customer_id);
      if (customer && customer.deleted) {
        customer = null;
      }
    } catch (error) {
      customer = null;
    }
  }

  if (!customer) {
    customer = await stripe.customers.create({
      email: workspace.billing_email || user.email,
      name: workspace.billing_name || workspace.business_name || user.email,
      metadata: {
        workspace_id: workspace._id,
        owner_user_id: user._id,
        clerk_user_id: user.clerk_user_id,
        role: "seller",
      },
    });
  } else {
    customer = await stripe.customers.update(customer.id, {
      email: workspace.billing_email || user.email,
      name: workspace.billing_name || workspace.business_name || user.email,
      metadata: {
        ...(customer.metadata || {}),
        workspace_id: workspace._id,
        owner_user_id: user._id,
        clerk_user_id: user.clerk_user_id,
        role: "seller",
      },
    });
  }

  workspace.stripe_customer_id = customer.id;
  workspace.updated_at = new Date();
  await workspace.save();

  return customer;
}

async function getCustomerDefaultPaymentMethodId(workspace) {
  if (!workspace.stripe_customer_id || !process.env.STRIPE_SECRET_KEY) {
    return workspace.stripe_default_payment_method_id || null;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(workspace.stripe_customer_id);
  const defaultId = extractStripeId(customer.invoice_settings && customer.invoice_settings.default_payment_method);

  if (defaultId && workspace.stripe_default_payment_method_id !== defaultId) {
    workspace.stripe_default_payment_method_id = defaultId;
    workspace.updated_at = new Date();
    await workspace.save();
  }

  return defaultId || workspace.stripe_default_payment_method_id || null;
}

async function listPaymentMethodsForWorkspace(workspace) {
  if (!workspace.stripe_customer_id || !process.env.STRIPE_SECRET_KEY) {
    return [];
  }

  const stripe = getStripeClient();
  const paymentMethods = await stripe.paymentMethods.list({
    customer: workspace.stripe_customer_id,
    type: "card",
    limit: 20,
  });
  const defaultPaymentMethodId = await getCustomerDefaultPaymentMethodId(workspace);

  return paymentMethods.data.map((paymentMethod) => ({
    id: paymentMethod.id,
    brand: (paymentMethod.card && paymentMethod.card.brand) || "card",
    last4: paymentMethod.card && paymentMethod.card.last4,
    expMonth: paymentMethod.card && paymentMethod.card.exp_month,
    expYear: paymentMethod.card && paymentMethod.card.exp_year,
    funding: paymentMethod.card && paymentMethod.card.funding,
    isDefault: paymentMethod.id === defaultPaymentMethodId,
  }));
}

async function resolveWorkspaceSubscriptionReference({
  stripeSubscriptionId,
  stripeCustomerId,
  workspaceId,
}) {
  if (stripeSubscriptionId) {
    const bySubscription = await WorkspaceSubscription.findOne({
      stripe_subscription_id: stripeSubscriptionId,
    });

    if (bySubscription) {
      return bySubscription;
    }
  }

  if (workspaceId) {
    const byWorkspace = await WorkspaceSubscription.findOne({
      workspace_id: workspaceId,
    }).sort({ updated_at: -1, created_at: -1 });

    if (byWorkspace) {
      return byWorkspace;
    }
  }

  if (stripeCustomerId) {
    const byCustomer = await WorkspaceSubscription.findOne({
      stripe_customer_id: stripeCustomerId,
    }).sort({ updated_at: -1, created_at: -1 });

    if (byCustomer) {
      return byCustomer;
    }

    const workspace = await SellerWorkspace.findOne({ stripe_customer_id: stripeCustomerId });
    if (workspace) {
      return WorkspaceSubscription.findOne({ workspace_id: workspace._id }).sort({ updated_at: -1, created_at: -1 });
    }
  }

  return null;
}

async function syncPaymentIntentFromStripe(paymentIntent, workspaceSubscriptionId) {
  if (!paymentIntent || !paymentIntent.id) {
    return null;
  }

  const existing = await SubscriptionPayment.findOne({
    stripe_payment_intent_id: paymentIntent.id,
  });
  const payment = existing || new SubscriptionPayment({});

  payment.workspace_subscription_id = workspaceSubscriptionId || payment.workspace_subscription_id || null;
  payment.stripe_payment_intent_id = paymentIntent.id;
  payment.stripe_invoice_id = extractStripeId(paymentIntent.invoice);
  payment.stripe_charge_id = extractStripeId(paymentIntent.latest_charge);
  payment.stripe_payment_method_id = extractStripeId(paymentIntent.payment_method);
  payment.amount_cents = paymentIntent.amount || 0;
  payment.currency = paymentIntent.currency || "usd";
  payment.status = paymentIntent.status || "processing";
  payment.failure_reason =
    (paymentIntent.last_payment_error && paymentIntent.last_payment_error.message) || null;
  payment.created_at = payment.created ? toDateFromUnix(paymentIntent.created) : payment.created_at || new Date();
  payment.updated_at = new Date();

  await payment.save();
  return payment;
}

async function syncInvoiceFromStripe(invoice, workspaceSubscriptionId) {
  if (!invoice || !invoice.id) {
    return null;
  }

  const existing = await SubscriptionInvoice.findOne({ stripe_invoice_id: invoice.id });
  const localInvoice = existing || new SubscriptionInvoice({});

  localInvoice.workspace_subscription_id = workspaceSubscriptionId || localInvoice.workspace_subscription_id || null;
  localInvoice.stripe_invoice_id = invoice.id;
  localInvoice.stripe_subscription_id = extractStripeId(invoice.subscription);
  localInvoice.stripe_payment_intent_id = extractStripeId(invoice.payment_intent);
  localInvoice.amount_due_cents = invoice.amount_due || 0;
  localInvoice.amount_paid_cents = invoice.amount_paid || 0;
  localInvoice.currency = invoice.currency || "usd";
  localInvoice.status = invoice.status || "draft";
  localInvoice.hosted_invoice_url = invoice.hosted_invoice_url || null;
  localInvoice.invoice_pdf_url = invoice.invoice_pdf || null;
  localInvoice.created_at = invoice.created ? toDateFromUnix(invoice.created) : localInvoice.created_at || new Date();
  localInvoice.updated_at = new Date();

  await localInvoice.save();

  if (invoice.payment_intent && typeof invoice.payment_intent === "object") {
    await syncPaymentIntentFromStripe(invoice.payment_intent, workspaceSubscriptionId);
  }

  return localInvoice;
}

async function syncWorkspaceStatus(workspaceId, subscriptionStatus) {
  const workspace = await SellerWorkspace.findById(workspaceId);
  if (!workspace) {
    return;
  }

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    workspace.status = "active";
  } else if (subscriptionStatus === "cancelled" || subscriptionStatus === "incomplete_expired") {
    workspace.status = "cancelled";
  } else if (!subscriptionStatus || subscriptionStatus === "free") {
    workspace.status = "trial";
  }

  workspace.updated_at = new Date();
  await workspace.save();
}

async function syncWorkspaceSubscriptionFromStripe(subscription, explicitPlanId) {
  if (!subscription || !subscription.id) {
    return null;
  }

  const workspaceId = subscription.metadata && subscription.metadata.workspace_id;
  const existing = await resolveWorkspaceSubscriptionReference({
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: extractStripeId(subscription.customer),
    workspaceId,
  });
  const price = subscription.items && subscription.items.data && subscription.items.data[0]
    ? subscription.items.data[0].price
    : null;
  const plan = explicitPlanId
    ? await SubscriptionPlan.findById(explicitPlanId)
    : await SubscriptionPlan.findOne({ stripe_price_id: price && price.id }) || (price ? await upsertPlanFromStripePrice(price) : null);
  const now = new Date();
  const localSubscription = existing || new WorkspaceSubscription({ created_at: now });

  localSubscription.workspace_id =
    localSubscription.workspace_id || workspaceId || (existing && existing.workspace_id) || null;
  localSubscription.plan_id = plan ? plan._id : localSubscription.plan_id || null;
  localSubscription.stripe_customer_id = extractStripeId(subscription.customer);
  localSubscription.stripe_subscription_id = subscription.id;
  localSubscription.stripe_price_id = price && price.id;
  localSubscription.stripe_latest_invoice_id = extractStripeId(subscription.latest_invoice);
  localSubscription.latest_payment_status =
    subscription.latest_invoice &&
    typeof subscription.latest_invoice === "object" &&
    subscription.latest_invoice.payment_intent &&
    typeof subscription.latest_invoice.payment_intent === "object"
      ? subscription.latest_invoice.payment_intent.status
      : localSubscription.latest_payment_status || null;
  localSubscription.status = normalizeStripeStatus(subscription.status);
  localSubscription.current_period_start = toDateFromUnix(subscription.current_period_start);
  localSubscription.current_period_end = toDateFromUnix(subscription.current_period_end);
  localSubscription.cancel_at_period_end = Boolean(subscription.cancel_at_period_end);
  localSubscription.cancelled_at = toDateFromUnix(subscription.canceled_at);
  localSubscription.updated_at = now;

  await localSubscription.save();

  if (subscription.latest_invoice && typeof subscription.latest_invoice === "object") {
    await syncInvoiceFromStripe(subscription.latest_invoice, localSubscription._id);
  }

  if (
    subscription.latest_invoice &&
    typeof subscription.latest_invoice === "object" &&
    subscription.latest_invoice.payment_intent &&
    typeof subscription.latest_invoice.payment_intent === "object"
  ) {
    await syncPaymentIntentFromStripe(subscription.latest_invoice.payment_intent, localSubscription._id);
  }

  if (localSubscription.workspace_id) {
    await syncWorkspaceStatus(localSubscription.workspace_id, localSubscription.status);
  }

  return localSubscription;
}

async function collectSubscriptionInvoiceIfNeeded({ subscriptionId, paymentMethodId, planId }) {
  const stripe = getStripeClient();
  let subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice.payment_intent", "items.data.price.product", "pending_setup_intent"],
  });

  const latestInvoice =
    subscription.latest_invoice && typeof subscription.latest_invoice === "object"
      ? subscription.latest_invoice
      : null;

  if (
    paymentMethodId &&
    subscription.status === "incomplete" &&
    latestInvoice &&
    latestInvoice.status !== "paid"
  ) {
    try {
      await stripe.subscriptions.update(subscription.id, {
        default_payment_method: paymentMethodId,
      });

      await stripe.invoices.pay(latestInvoice.id, {
        payment_method: paymentMethodId,
      });
    } catch (error) {
      // Leave the subscription in its current state so the frontend can surface the Stripe failure.
    }

    subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice.payment_intent", "items.data.price.product", "pending_setup_intent"],
    });
  }

  await syncWorkspaceSubscriptionFromStripe(subscription, planId);
  return subscription;
}

function serializePlan(plan) {
  return {
    id: plan._id,
    name: plan.name,
    description: plan.description || "",
    price: plan.price || 0,
    currency: plan.currency || "usd",
    billingInterval: normalizeInterval(plan.billing_interval),
    features: parseFeatures(plan.features_json),
    stripePriceId: plan.stripe_price_id || null,
    isFree: Number(plan.price || 0) === 0,
  };
}

async function loadCurrentWorkspaceSubscription(workspace) {
  const current = await WorkspaceSubscription.findOne({ workspace_id: workspace._id })
    .sort({ updated_at: -1, created_at: -1 })
    .populate("plan_id");

  if (!current) {
    return null;
  }

  if (current.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripeClient();
      const refreshed = await stripe.subscriptions.retrieve(current.stripe_subscription_id, {
        expand: ["latest_invoice.payment_intent", "items.data.price.product"],
      });
      await syncWorkspaceSubscriptionFromStripe(refreshed, current.plan_id && current.plan_id._id);
      return WorkspaceSubscription.findById(current._id).populate("plan_id");
    } catch (error) {
      return current;
    }
  }

  return current;
}

function serializeSubscription(subscription, fallbackPlan) {
  if (!subscription && !fallbackPlan) {
    return null;
  }

  const plan = subscription && subscription.plan_id ? subscription.plan_id : fallbackPlan;
  const normalizedStatus = subscription ? normalizeStripeStatus(subscription.status) : "inactive";

  return {
    id: subscription ? subscription._id : "free-plan",
    status: normalizedStatus,
    cancelAtPeriodEnd: subscription ? Boolean(subscription.cancel_at_period_end) : false,
    currentPeriodStart: subscription && subscription.current_period_start ? subscription.current_period_start.toISOString() : null,
    currentPeriodEnd: subscription && subscription.current_period_end ? subscription.current_period_end.toISOString() : null,
    latestPaymentStatus: subscription ? subscription.latest_payment_status || null : null,
    stripeSubscriptionId: subscription ? subscription.stripe_subscription_id || null : null,
    plan: plan ? serializePlan(plan) : null,
  };
}

function serializeInvoice(invoice) {
  return {
    id: invoice._id,
    stripeInvoiceId: invoice.stripe_invoice_id,
    amountDueCents: invoice.amount_due_cents || 0,
    amountPaidCents: invoice.amount_paid_cents || 0,
    currency: invoice.currency || "usd",
    status: invoice.status || "draft",
    hostedInvoiceUrl: invoice.hosted_invoice_url || null,
    invoicePdfUrl: invoice.invoice_pdf_url || null,
    createdAt: invoice.created_at ? invoice.created_at.toISOString() : null,
  };
}

async function getSellerBillingOverview({ clerkUserId }) {
  const user = await findSellerUser(clerkUserId);
  const workspace = await ensureWorkspaceForSeller(user);
  const plans = await syncPlansFromStripe();
  const currentSubscription = await loadCurrentWorkspaceSubscription(workspace);
  const defaultPaymentMethodId = await getCustomerDefaultPaymentMethodId(workspace).catch(() => workspace.stripe_default_payment_method_id || null);
  const paymentMethods = await listPaymentMethodsForWorkspace(workspace).catch(() => []);
  const subscriptionId = currentSubscription ? currentSubscription._id : null;
  const invoices = subscriptionId
    ? await SubscriptionInvoice.find({ workspace_subscription_id: subscriptionId })
        .sort({ created_at: -1 })
        .limit(12)
    : [];

  return {
    workspace: {
      id: workspace._id,
      businessName: workspace.business_name || "Seller workspace",
      billingEmail: workspace.billing_email || user.email,
      billingName: workspace.billing_name || workspace.business_name || user.email,
      stripeCustomerId: workspace.stripe_customer_id || null,
    },
    plans: plans.map(serializePlan),
    currentSubscription: serializeSubscription(currentSubscription, null),
    paymentMethods,
    defaultPaymentMethodId,
    invoices: invoices.map(serializeInvoice),
  };
}

async function attachPaymentMethodToCustomer({ paymentMethodId, customerId }) {
  const stripe = getStripeClient();
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  if (paymentMethod.customer && extractStripeId(paymentMethod.customer) !== customerId) {
    throw createHttpError(400, "This payment method belongs to another customer.");
  }

  if (!paymentMethod.customer) {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  }

  return stripe.paymentMethods.retrieve(paymentMethodId);
}

async function setDefaultPaymentMethodForSeller({ clerkUserId, paymentMethodId }) {
  if (!paymentMethodId) {
    throw createHttpError(400, "A payment method is required.");
  }

  const user = await findSellerUser(clerkUserId);
  const workspace = await ensureWorkspaceForSeller(user);
  const customer = await ensureStripeCustomer({ workspace, user });
  await attachPaymentMethodToCustomer({ paymentMethodId, customerId: customer.id });

  const stripe = getStripeClient();
  await stripe.customers.update(customer.id, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  workspace.stripe_default_payment_method_id = paymentMethodId;
  workspace.updated_at = new Date();
  await workspace.save();

  return getSellerBillingOverview({ clerkUserId });
}

async function removePaymentMethodForSeller({ clerkUserId, paymentMethodId }) {
  if (!paymentMethodId) {
    throw createHttpError(400, "A payment method is required.");
  }

  const user = await findSellerUser(clerkUserId);
  const workspace = await ensureWorkspaceForSeller(user);

  if (!workspace.stripe_customer_id) {
    throw createHttpError(404, "No Stripe customer exists for this workspace.");
  }

  const stripe = getStripeClient();
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  const paymentMethodCustomerId = extractStripeId(paymentMethod.customer);

  if (!paymentMethodCustomerId || paymentMethodCustomerId !== workspace.stripe_customer_id) {
    throw createHttpError(404, "This payment method does not belong to the current workspace.");
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: workspace.stripe_customer_id,
    type: "card",
    limit: 20,
  });
  const replacementPaymentMethod = paymentMethods.data.find((item) => item.id !== paymentMethodId) || null;
  const replacementPaymentMethodId = replacementPaymentMethod ? replacementPaymentMethod.id : null;

  await stripe.customers.update(workspace.stripe_customer_id, {
    invoice_settings: {
      default_payment_method: replacementPaymentMethodId || "",
    },
  });

  const currentSubscription = await WorkspaceSubscription.findOne({
    workspace_id: workspace._id,
    stripe_subscription_id: { $nin: [null, ""] },
    status: { $nin: ["cancelled", "inactive"] },
  }).sort({ updated_at: -1, created_at: -1 });

  if (currentSubscription && currentSubscription.stripe_subscription_id) {
    await stripe.subscriptions.update(currentSubscription.stripe_subscription_id, {
      default_payment_method: replacementPaymentMethodId || "",
    });
  }

  await stripe.paymentMethods.detach(paymentMethodId);

  workspace.stripe_default_payment_method_id = replacementPaymentMethodId;
  workspace.updated_at = new Date();
  await workspace.save();

  return getSellerBillingOverview({ clerkUserId });
}

async function createSetupIntentForSeller({ clerkUserId }) {
  const user = await findSellerUser(clerkUserId);
  const workspace = await ensureWorkspaceForSeller(user);
  const customer = await ensureStripeCustomer({ workspace, user });
  const stripe = getStripeClient();
  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: {
      workspace_id: workspace._id,
      owner_user_id: user._id,
      role: "seller",
    },
  });

  return {
    clientSecret: setupIntent.client_secret,
    customerId: customer.id,
  };
}

async function upsertFreeWorkspaceSubscription({ workspace, plan }) {
  const now = new Date();
  const existing = await WorkspaceSubscription.findOne({ workspace_id: workspace._id }).sort({ updated_at: -1, created_at: -1 });
  const localSubscription = existing || new WorkspaceSubscription({ created_at: now });

  localSubscription.workspace_id = workspace._id;
  localSubscription.plan_id = plan._id;
  localSubscription.stripe_customer_id = workspace.stripe_customer_id || null;
  localSubscription.stripe_subscription_id = null;
  localSubscription.stripe_price_id = null;
  localSubscription.stripe_latest_invoice_id = null;
  localSubscription.latest_payment_status = null;
  localSubscription.status = "free";
  localSubscription.current_period_start = now;
  localSubscription.current_period_end = null;
  localSubscription.cancel_at_period_end = false;
  localSubscription.cancelled_at = null;
  localSubscription.updated_at = now;

  await localSubscription.save();
  await syncWorkspaceStatus(workspace._id, "free");

  return localSubscription;
}

async function createOrUpdateSubscriptionForSeller({ clerkUserId, planId, paymentMethodId }) {
  if (!planId) {
    throw createHttpError(400, "A subscription plan is required.");
  }

  const user = await findSellerUser(clerkUserId);
  const workspace = await ensureWorkspaceForSeller(user);
  const plan = await SubscriptionPlan.findOne({ _id: planId, is_active: true });

  if (!plan) {
    throw createHttpError(404, "The selected plan was not found.");
  }

  if (!plan.stripe_price_id || plan.metadata_json?.app_plan_key !== SINGLE_SELLER_PLAN_KEY) {
    throw createHttpError(400, "Only the configured $300 monthly seller subscription can be purchased.");
  }

  const customer = await ensureStripeCustomer({ workspace, user });
  const stripe = getStripeClient();
  const effectivePaymentMethodId = paymentMethodId || (await getCustomerDefaultPaymentMethodId(workspace));

  if (!effectivePaymentMethodId) {
    throw createHttpError(400, "A saved payment method is required for this plan.");
  }

  await attachPaymentMethodToCustomer({
    paymentMethodId: effectivePaymentMethodId,
    customerId: customer.id,
  });

  await stripe.customers.update(customer.id, {
    invoice_settings: {
      default_payment_method: effectivePaymentMethodId,
    },
  });

  workspace.stripe_default_payment_method_id = effectivePaymentMethodId;
  workspace.updated_at = new Date();
  await workspace.save();

  const existing = await WorkspaceSubscription.findOne({
    workspace_id: workspace._id,
    stripe_subscription_id: { $nin: [null, ""] },
    status: { $nin: ["cancelled", "free", "incomplete_expired"] },
  }).sort({ updated_at: -1, created_at: -1 });

  let subscription;

  if (existing && existing.stripe_subscription_id) {
    const currentSubscription = await stripe.subscriptions.retrieve(existing.stripe_subscription_id, {
      expand: ["latest_invoice.payment_intent", "items.data.price.product"],
    });
    const currentItem = currentSubscription.items.data[0];

    if (!currentItem) {
      throw createHttpError(500, "The existing Stripe subscription has no subscription items.");
    }

    subscription = await stripe.subscriptions.update(currentSubscription.id, {
      items: [
        {
          id: currentItem.id,
          price: plan.stripe_price_id,
        },
      ],
      default_payment_method: effectivePaymentMethodId,
      metadata: {
        workspace_id: workspace._id,
        owner_user_id: user._id,
        plan_id: plan._id,
        role: "seller",
      },
      payment_behavior: "pending_if_incomplete",
      proration_behavior: "create_prorations",
      expand: ["latest_invoice.payment_intent", "items.data.price.product"],
    });
  } else {
    subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.stripe_price_id }],
      default_payment_method: effectivePaymentMethodId,
      collection_method: "charge_automatically",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
      payment_behavior: "default_incomplete",
      metadata: {
        workspace_id: workspace._id,
        owner_user_id: user._id,
        plan_id: plan._id,
        role: "seller",
      },
      expand: ["latest_invoice.payment_intent", "items.data.price.product"],
    });
  }

  subscription = await collectSubscriptionInvoiceIfNeeded({
    subscriptionId: subscription.id,
    paymentMethodId: effectivePaymentMethodId,
    planId: plan._id,
  });

  const paymentIntent =
    subscription.latest_invoice &&
    typeof subscription.latest_invoice === "object" &&
    subscription.latest_invoice.payment_intent &&
    typeof subscription.latest_invoice.payment_intent === "object"
      ? subscription.latest_invoice.payment_intent
      : null;

  return {
    paymentIntentClientSecret: paymentIntent ? paymentIntent.client_secret || null : null,
    paymentIntentStatus: paymentIntent ? paymentIntent.status || null : null,
    requiresAction: Boolean(
      paymentIntent && ["requires_action", "requires_confirmation"].includes(paymentIntent.status),
    ),
    overview: await getSellerBillingOverview({ clerkUserId }),
  };
}

async function syncWorkspaceFromCustomer(customer) {
  if (!customer || !customer.id) {
    return null;
  }

  const workspaceId = customer.metadata && customer.metadata.workspace_id;
  let workspace = null;

  if (workspaceId) {
    workspace = await SellerWorkspace.findById(workspaceId);
  }

  if (!workspace) {
    workspace = await SellerWorkspace.findOne({ stripe_customer_id: customer.id });
  }

  if (!workspace) {
    return null;
  }

  workspace.stripe_customer_id = customer.id;
  workspace.billing_email = customer.email || workspace.billing_email;
  workspace.billing_name = customer.name || workspace.billing_name;
  workspace.stripe_default_payment_method_id =
    extractStripeId(customer.invoice_settings && customer.invoice_settings.default_payment_method) ||
    workspace.stripe_default_payment_method_id || null;
  workspace.updated_at = new Date();
  await workspace.save();

  return workspace;
}

async function handleStripeWebhookEvent({ signature, payload }) {
  const stripe = getStripeClient();
  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, getWebhookSecret());
  } catch (error) {
    throw createHttpError(400, `Webhook signature verification failed: ${error.message}`);
  }

  // Lazy-load to avoid circular dependencies.
  const bookingPaymentService = require("./bookingPaymentService");

  switch (event.type) {
    case "customer.created":
    case "customer.updated": {
      await syncWorkspaceFromCustomer(event.data.object);
      break;
    }

    case "payment_method.attached": {
      const paymentMethod = event.data.object;
      const customerId = extractStripeId(paymentMethod.customer);
      if (customerId) {
        const workspace = await SellerWorkspace.findOne({ stripe_customer_id: customerId });
        if (workspace && !workspace.stripe_default_payment_method_id) {
          workspace.stripe_default_payment_method_id = paymentMethod.id;
          workspace.updated_at = new Date();
          await workspace.save();
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncWorkspaceSubscriptionFromStripe(event.data.object);
      break;
    }

    case "invoice.created":
    case "invoice.finalized":
    case "invoice.updated":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided": {
      const invoice = event.data.object;
      const reference = await resolveWorkspaceSubscriptionReference({
        stripeSubscriptionId: extractStripeId(invoice.subscription),
        stripeCustomerId: extractStripeId(invoice.customer),
      });
      await syncInvoiceFromStripe(invoice, reference && reference._id);
      break;
    }

    case "payment_intent.processing":
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.requires_action":
    case "payment_intent.requires_payment_method": {
      const paymentIntent = event.data.object;
      const isBookingPayment =
        paymentIntent.metadata && paymentIntent.metadata.payment_purpose === "moderator_booking";

      if (isBookingPayment) {
        if (event.type === "payment_intent.succeeded") {
          await bookingPaymentService.handleBookingPaymentSucceeded(paymentIntent);
        } else if (event.type === "payment_intent.payment_failed") {
          await bookingPaymentService.handleBookingPaymentFailed(paymentIntent);
        }
      } else {
        const reference = await resolveWorkspaceSubscriptionReference({
          stripeSubscriptionId: null,
          stripeCustomerId: extractStripeId(paymentIntent.customer),
        });
        await syncPaymentIntentFromStripe(paymentIntent, reference && reference._id);
      }
      break;
    }

    default:
      break;
  }
}

module.exports = {
  createOrUpdateSubscriptionForSeller,
  createSetupIntentForSeller,
  getSellerBillingOverview,
  handleStripeWebhookEvent,
  SINGLE_SELLER_PLAN_KEY,
  syncPlansFromStripe,
  removePaymentMethodForSeller,
  setDefaultPaymentMethodForSeller,
};