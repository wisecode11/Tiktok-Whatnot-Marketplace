const express = require("express");
const {
  getStaffRates,
  updateStaffRate,
  generatePayroll,
  approvePayroll,
  getPayrollRuns,
  getPayrollRunDetails,
  getPayrollPreview,
  issueAndDownloadStaffPayroll,
  createStaffPayrollPayment,
  confirmStaffPayrollPaymentHandler,
} = require("../controllers/payrollController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.use(authenticateRequest);

// Staff rates (seller-managed hourly rate + deductions per staff)
router.get("/staff-rates", getStaffRates);
router.post("/staff-rates", updateStaffRate);

// Simple per-staff flow: preview + one-click issue + QuickBooks PDF download
router.get("/preview", getPayrollPreview);
router.post("/staff/:userId/issue-and-download", issueAndDownloadStaffPayroll);
router.post("/staff/:userId/pay/create-intent", createStaffPayrollPayment);
router.post("/staff/pay/confirm", confirmStaffPayrollPaymentHandler);

// Legacy multi-staff flow (kept for backwards compatibility)
router.post("/generate", generatePayroll);
router.post("/approve", approvePayroll);
router.get("/runs", getPayrollRuns);
router.get("/runs/:payroll_run_id", getPayrollRunDetails);

module.exports = router;
