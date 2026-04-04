require("dotenv").config();

const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const definitions = [
  {
    key: "seller-monthly-300",
    name: "Seller Subscription",
    description: "Dedicated monthly seller subscription with full platform access.",
    amount: 30000,
    interval: "month",
    order: "1",
    features: JSON.stringify([
      "Full seller workspace access",
      "Unlimited products and catalog management",
      "Advanced analytics and reporting",
      "Moderator marketplace access",
      "Priority support",
      "Real-time billing and invoicing in Stripe",
    ]),
  },
];

async function upsertDefinition(definition, existingProducts, existingPrices) {
  let product = existingProducts.find(
    (item) => item.metadata && item.metadata.app_plan_key === definition.key,
  );

  if (!product) {
    product = await stripe.products.create({
      name: definition.name,
      description: definition.description,
      metadata: {
        app_plan_key: definition.key,
        role: "seller",
        features: definition.features,
      },
    });
  } else {
    product = await stripe.products.update(product.id, {
      name: definition.name,
      description: definition.description,
      metadata: {
        ...(product.metadata || {}),
        app_plan_key: definition.key,
        role: "seller",
        features: definition.features,
      },
    });
  }

  let price = existingPrices.find(
    (item) =>
      item.active &&
      item.product === product.id &&
      item.unit_amount === definition.amount &&
      item.recurring &&
      item.recurring.interval === definition.interval &&
      item.metadata &&
      item.metadata.app_plan_key === definition.key,
  );

  if (!price) {
    price = await stripe.prices.create({
      unit_amount: definition.amount,
      currency: "usd",
      recurring: { interval: definition.interval },
      product: product.id,
      metadata: {
        app_plan_key: definition.key,
        role: "seller",
        display_order: definition.order,
      },
    });
  }

  return {
    productId: product.id,
    productName: product.name,
    priceId: price.id,
    amount: price.unit_amount,
    interval: price.recurring && price.recurring.interval,
  };
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required.");
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  const prices = await stripe.prices.list({ active: true, limit: 100, type: "recurring" });
  const results = [];

  for (const definition of definitions) {
    const result = await upsertDefinition(definition, products.data, prices.data);
    results.push(result);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
