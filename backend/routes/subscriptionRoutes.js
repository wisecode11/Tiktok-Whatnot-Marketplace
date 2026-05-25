const express = require("express");
const { listPublicPlans } = require("../controllers/subscriptionController");

const router = express.Router();

router.get("/plans", listPublicPlans);

module.exports = router;
