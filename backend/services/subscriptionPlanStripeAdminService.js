const crypto = require("crypto");
const Stripe = require("stripe");

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

function newAppPlanKey() {
  return `plan_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function featuresToStripeMetadata(features) {
  if (!Array.isArray(features) || !features.length) {
    return "[]";
  }
  try {
    return JSON.stringify(features.map((f) => String(f).trim()).filter(Boolean));
  } catch {
    return "[]";
  }
}

function normalizeInterval(billingInterval) {
  const v = String(billingInterval || "month").toLowerCase();
  if (v === "year" || v === "yearly") return "year";
  return "month";
}

/**
 * Creates Stripe Product + recurring Price for a seller subscription plan managed from admin.
 */
async function createStripeProductAndPrice({
  name,
  description,
  amountDollars,
  currency,
  billingInterval,
  features,
  displayOrder,
  activatePrice = true,
}) {
  const stripe = getStripeClient();
  const app_plan_key = newAppPlanKey();
  const featuresSerialized = featuresToStripeMetadata(features);
  const orderStr = String(displayOrder ?? 0);

  const productMetadata = {
    app_plan_key,
    role: "seller",
    seller_subscription: "true",
    source: "admin_ui",
    features: featuresSerialized,
    display_order: orderStr,
  };

  const product = await stripe.products.create({
    name: String(name).trim(),
    description: description ? String(description).trim() : undefined,
    metadata: productMetadata,
    active: Boolean(activatePrice),
  });

  const interval = normalizeInterval(billingInterval);
  const unitAmount = Math.round(Number(amountDollars) * 100);
  if (!Number.isFinite(unitAmount) || unitAmount < 1) {
    await stripe.products.update(product.id, { active: false }).catch(() => undefined);
    throw createHttpError(400, "Price must be at least $0.01 to create a Stripe subscription plan.");
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: unitAmount,
    currency: String(currency || "usd").toLowerCase(),
    recurring: { interval },
    active: Boolean(activatePrice),
    metadata: {
      app_plan_key,
      role: "seller",
      seller_subscription: "true",
      source: "admin_ui",
      display_order: orderStr,
    },
  });

  return {
    stripe_product_id: product.id,
    stripe_price_id: price.id,
    app_plan_key,
    metadata_json: {
      app_plan_key,
      role: "seller",
      seller_subscription: true,
      source: "admin_ui",
    },
  };
}

async function updateStripeProduct(productId, { name, description }) {
  if (!productId) return;
  const stripe = getStripeClient();
  await stripe.products.update(productId, {
    name: name !== undefined ? String(name).trim() : undefined,
    description: description !== undefined ? String(description || "").trim() || undefined : undefined,
  });
}

/**
 * Stripe does not allow changing unit_amount on a Price. Create a new price and archive the old one.
 */
async function replaceStripeRecurringPrice({
  stripe_product_id,
  previous_price_id,
  amountDollars,
  currency,
  billingInterval,
  app_plan_key,
  displayOrder,
  activatePrice = true,
}) {
  const stripe = getStripeClient();
  const interval = normalizeInterval(billingInterval);
  const unitAmount = Math.round(Number(amountDollars) * 100);
  if (!Number.isFinite(unitAmount) || unitAmount < 1) {
    throw createHttpError(400, "Price must be at least $0.01 for a paid Stripe plan.");
  }

  const orderStr = String(displayOrder ?? 0);
  const key = app_plan_key || newAppPlanKey();

  const price = await stripe.prices.create({
    product: stripe_product_id,
    unit_amount: unitAmount,
    currency: String(currency || "usd").toLowerCase(),
    recurring: { interval },
    active: Boolean(activatePrice),
    metadata: {
      app_plan_key: key,
      role: "seller",
      seller_subscription: "true",
      source: "admin_ui",
      display_order: orderStr,
    },
  });

  if (previous_price_id) {
    await stripe.prices.update(previous_price_id, { active: false }).catch(() => undefined);
  }

  return { stripe_price_id: price.id };
}

module.exports = {
  createStripeProductAndPrice,
  updateStripeProduct,
  replaceStripeRecurringPrice,
  createHttpError,
};
