const { SubscriptionPlan } = require("../models");

/**
 * GET /api/subscriptions/plans
 * Public list of active subscription plans for the pricing page.
 */
async function listPublicPlans(req, res) {
  try {
    const plans = await SubscriptionPlan.find({ is_active: true })
      .sort({ display_order: 1, created_at: -1 })
      .lean();

    return res.status(200).json({ plans });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load subscription plans." });
  }
}

module.exports = {
  listPublicPlans,
};
