const express = require("express");

const {
  createSetupIntent,
  deletePaymentMethod,
  getSubscriptionOverview,
  saveDefaultPaymentMethod,
  upsertSubscription,
} = require("../controllers/billingController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.get("/subscription", authenticateRequest, getSubscriptionOverview);
router.post("/setup-intent", authenticateRequest, createSetupIntent);
router.post("/payment-methods/default", authenticateRequest, saveDefaultPaymentMethod);
router.delete("/payment-methods/:paymentMethodId", authenticateRequest, deletePaymentMethod);
router.post("/subscriptions", authenticateRequest, upsertSubscription);

module.exports = router;