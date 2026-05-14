const express = require("express");
const {
  getAllModeratorReviews,
  getReviewsForUser,
  getUserProfiles,
  getUserProfileById,
  updateUserStatus,
  getReviewStats,
} = require("../controllers/adminController");
const {
  listPlans,
  createPlan,
  updatePlan,
  listSubscriptions,
  getSubscriptionById,
  changeSubscriptionPlan,
  cancelSubscription,
  refundSubscription,
  getSubscriptionStats,
} = require("../controllers/adminSubscriptionController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

// Feedback Monitoring Routes
router.get("/reviews", authenticateRequest, getAllModeratorReviews);
router.get("/reviews/user/:userId", authenticateRequest, getReviewsForUser);
router.get("/reviews/stats", authenticateRequest, getReviewStats);

// User Profile Management Routes
router.get("/users", authenticateRequest, getUserProfiles);
router.get("/users/:userId", authenticateRequest, getUserProfileById);
router.patch("/users/:userId/status", authenticateRequest, updateUserStatus);

// Subscription Management – Plans
router.get("/subscriptions/plans", authenticateRequest, listPlans);
router.post("/subscriptions/plans", authenticateRequest, createPlan);
router.patch("/subscriptions/plans/:planId", authenticateRequest, updatePlan);

// Subscription Management – Subscriptions
router.get("/subscriptions/stats", authenticateRequest, getSubscriptionStats);
router.get("/subscriptions", authenticateRequest, listSubscriptions);
router.get("/subscriptions/:subscriptionId", authenticateRequest, getSubscriptionById);
router.patch("/subscriptions/:subscriptionId/plan", authenticateRequest, changeSubscriptionPlan);
router.post("/subscriptions/:subscriptionId/cancel", authenticateRequest, cancelSubscription);
router.post("/subscriptions/:subscriptionId/refund", authenticateRequest, refundSubscription);

module.exports = router;
