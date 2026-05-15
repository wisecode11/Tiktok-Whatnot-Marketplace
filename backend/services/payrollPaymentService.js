const Stripe = require("stripe");

const ConnectedAccount = require("../models/ConnectedAccount");
const PayrollRun = require("../models/PayrollRun");
const SellerWorkspace = require("../models/SellerWorkspace");
const User = require("../models/Users");
const WorkspaceMembership = require("../models/WorkspaceMembership");
const payrollService = require("./payrollService");

const MIN_AMOUNT_CENTS = 50;
const REUSABLE_PI_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw createHttpError(500, "Stripe is not configured on the server.");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });
}

function asIdString(value) {
  if (!value) return "";
  return typeof value === "string" ? value : String(value);
}

function parseInclusiveEnd(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

function readStripePayment(run) {
  return (run && run.stripe_payment) || {};
}

function isStaffPayrollPaymentIntent(paymentIntent) {
  return (
    paymentIntent &&
    paymentIntent.metadata &&
    paymentIntent.metadata.payment_purpose === "staff_payroll"
  );
}

function isStaffPayrollInvoice(invoice) {
  return (
    invoice &&
    invoice.metadata &&
    invoice.metadata.payment_purpose === "staff_payroll"
  );
}

function extractStripeId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

function buildStaffPayrollMetadata({
  payrollRun,
  workspace,
  seller,
  staffUserId,
  periodStart,
  periodEnd,
  amountCents,
}) {
  return {
    payment_purpose: "staff_payroll",
    payroll_run_id: String(payrollRun._id),
    workspace_id: String(workspace._id),
    staff_user_id: String(staffUserId),
    seller_user_id: String(seller._id),
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    net_cents: String(amountCents),
  };
}

function formatPayrollPeriodLabel(periodStart, periodEnd) {
  const start = periodStart.toISOString().slice(0, 10);
  const end = periodEnd.toISOString().slice(0, 10);
  return `${start} – ${end}`;
}

async function discardOpenPayrollInvoice(stripe, invoiceId) {
  if (!invoiceId) return;

  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status === "draft") {
      await stripe.invoices.del(invoice.id);
      return;
    }
    if (invoice.status === "open") {
      await stripe.invoices.voidInvoice(invoice.id);
    }
  } catch (error) {
    if (!(error && error.code === "resource_missing")) {
      throw error;
    }
  }
}

/** Clear stale Stripe invoice/PI refs on the payroll run (keeps amount + staff account). */
async function clearPendingPayrollStripeRefs(payrollRun) {
  const payment = readStripePayment(payrollRun);
  if (payment.status === "paid") {
    return;
  }

  payrollRun.stripe_payment = {
    ...payment,
    status: null,
    payment_intent_id: null,
    invoice_id: null,
    hosted_invoice_url: null,
    invoice_pdf_url: null,
    paid_at: null,
    error: null,
  };
  payrollRun.updated_at = new Date();
  await payrollRun.save();
}

async function resolveInvoicePaymentIntent(stripe, invoice) {
  if (!invoice || !invoice.id) {
    return null;
  }

  const expanded = await stripe.invoices.retrieve(invoice.id, {
    expand: ["payment_intent"],
  });

  let paymentIntentRef = expanded.payment_intent;
  if (typeof paymentIntentRef === "string") {
    return stripe.paymentIntents.retrieve(paymentIntentRef);
  }
  if (paymentIntentRef && typeof paymentIntentRef === "object") {
    return paymentIntentRef;
  }

  return null;
}

function canReusePayrollPaymentIntent(paymentIntent, amountCents, payrollRunId) {
  if (!paymentIntent || paymentIntent.amount !== amountCents) {
    return false;
  }

  if (!REUSABLE_PI_STATUSES.has(paymentIntent.status)) {
    return false;
  }

  return (
    paymentIntent.metadata &&
    paymentIntent.metadata.payroll_run_id === String(payrollRunId) &&
    paymentIntent.metadata.payment_purpose === "staff_payroll"
  );
}

/** Draft invoice for Stripe Dashboard; card payment uses a separate PaymentIntent. */
async function ensureDraftPayrollInvoice({
  stripe,
  customerId,
  stripeAccountId,
  metadata,
  staffName,
  periodLabel,
  amountCents,
}) {
  const createPayload = {
    customer: customerId,
    auto_advance: false,
    collection_method: "charge_automatically",
    transfer_data: {
      destination: stripeAccountId,
    },
    metadata,
    description: `Staff payroll — ${staffName} (${periodLabel})`,
  };

  let draftInvoice = await stripe.invoices.create(createPayload);

  if (draftInvoice.status !== "draft") {
    draftInvoice = await stripe.invoices.create(createPayload);
  }

  if (draftInvoice.status !== "draft") {
    throw createHttpError(
      500,
      "Could not create a new editable Stripe invoice. Clear the old payroll payment in Stripe or try again.",
    );
  }

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: draftInvoice.id,
    amount: amountCents,
    currency: "usd",
    description: `Staff net pay: ${staffName} (${periodLabel})`,
    metadata,
  });

  return stripe.invoices.retrieve(draftInvoice.id);
}

/**
 * PaymentIntent collects the card (reliable with Connect transfer_data).
 * Linked draft invoice is finalized as paid after success.
 */
async function resolveOrCreatePayrollPaymentIntent({
  stripe,
  payrollRun,
  amountCents,
  customerId,
  stripeAccountId,
  seller,
  workspace,
  staffUserId,
  periodStart,
  periodEnd,
  invoiceId,
  metadata,
}) {
  const existingPayment = readStripePayment(payrollRun);

  if (existingPayment.payment_intent_id) {
    try {
      const existingPi = await stripe.paymentIntents.retrieve(existingPayment.payment_intent_id);

      if (existingPi.status === "succeeded") {
        throw createHttpError(409, "This payroll period has already been paid via Stripe.");
      }

      if (canReusePayrollPaymentIntent(existingPi, amountCents, payrollRun._id)) {
        return existingPi;
      }

      if (existingPi.status !== "canceled") {
        await stripe.paymentIntents.cancel(existingPi.id);
      }
    } catch (error) {
      if (error.status === 409) {
        throw error;
      }
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    customer: customerId,
    payment_method_types: ["card"],
    transfer_data: {
      destination: stripeAccountId,
    },
    metadata: {
      ...metadata,
      stripe_invoice_id: invoiceId || "",
    },
    description: `Staff payroll ${periodStart.toISOString().slice(0, 10)} – ${periodEnd.toISOString().slice(0, 10)}`,
  });

  return paymentIntent;
}

/** After card payment succeeds, finalize the draft invoice and mark it paid in Stripe. */
async function finalizePayrollInvoiceAfterPayment(stripe, invoiceId) {
  if (!invoiceId) {
    return null;
  }

  let invoice = await stripe.invoices.retrieve(invoiceId);

  if (invoice.status === "paid") {
    return invoice;
  }

  if (invoice.status === "draft") {
    invoice = await stripe.invoices.finalizeInvoice(invoiceId);
  }

  if (invoice.status === "open") {
    invoice = await stripe.invoices.pay(invoice.id, {
      paid_out_of_band: true,
    });
  }

  return invoice;
}

async function getSellerContext(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });
  if (!user || user.user_type !== "seller") {
    throw createHttpError(403, "Only sellers can pay staff payroll.");
  }

  const workspace = await SellerWorkspace.findOne({ owner_user_id: user._id });
  if (!workspace) {
    throw createHttpError(404, "Seller workspace not found.");
  }

  return { user, workspace };
}

/**
 * One Stripe customer per seller — shared with workspace billing when possible.
 */
async function getOrCreateStripeCustomerForSeller({ stripe, seller, workspace }) {
  const email = (seller.email || "").trim().toLowerCase() || undefined;
  const name = `${seller.first_name || ""} ${seller.last_name || ""}`.trim() || undefined;

  let customerId =
    seller.stripe_customer_id ||
    (workspace && workspace.stripe_customer_id) ||
    null;

  let stripeCustomer = null;

  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId);
      stripeCustomer = existing && !existing.deleted ? existing : null;
    } catch (error) {
      if (!(error && error.code === "resource_missing")) {
        throw error;
      }
      customerId = null;
    }
  }

  if (!stripeCustomer) {
    stripeCustomer = await stripe.customers.create(
      {
        email,
        name,
        metadata: {
          user_id: String(seller._id),
          user_type: "seller",
          workspace_id: workspace ? String(workspace._id) : "",
        },
      },
      { idempotencyKey: `seller-stripe-customer-${seller._id}` },
    );
    customerId = stripeCustomer.id;
  } else if (stripeCustomer.email !== email || stripeCustomer.name !== name) {
    stripeCustomer = await stripe.customers.update(stripeCustomer.id, {
      email,
      name,
      metadata: {
        ...(stripeCustomer.metadata || {}),
        user_id: String(seller._id),
        user_type: "seller",
        workspace_id: workspace ? String(workspace._id) : "",
      },
    });
    customerId = stripeCustomer.id;
  }

  const now = new Date();
  if (seller.stripe_customer_id !== customerId) {
    seller.stripe_customer_id = customerId;
    seller.updated_at = now;
    await seller.save();
  }

  if (workspace && workspace.stripe_customer_id !== customerId) {
    workspace.stripe_customer_id = customerId;
    workspace.billing_email = email || workspace.billing_email;
    workspace.billing_name = name || workspace.billing_name;
    workspace.updated_at = now;
    await workspace.save();
  }

  return customerId;
}

async function getStaffStripeDestination(staffUserId) {
  const connected = await ConnectedAccount.findOne({
    user_id: staffUserId,
    platform: "stripe",
    status: "connected",
  });

  if (!connected || !connected.account_external_id) {
    throw createHttpError(
      422,
      "This staff member has not connected Stripe yet. Ask them to complete Launch Pad setup.",
    );
  }

  const stripe = getStripeClient();
  const stripeAccount = await stripe.accounts.retrieve(connected.account_external_id);

  if (!stripeAccount.charges_enabled || !stripeAccount.payouts_enabled) {
    throw createHttpError(
      422,
      "Staff Stripe account is not fully onboarded. They must finish Stripe setup before receiving pay.",
    );
  }

  return {
    stripeAccountId: connected.account_external_id,
    displayName: connected.account_name || stripeAccount.email || connected.account_external_id,
  };
}

async function assertStaffInWorkspace(workspaceId, staffUserId) {
  const membership = await WorkspaceMembership.findOne({
    workspace_id: workspaceId,
    user_id: staffUserId,
    role: "staff",
    status: "active",
  });

  if (!membership) {
    throw createHttpError(404, "Staff member not found in this workspace.");
  }
}

async function resolvePayrollLineForStaff({ workspaceId, staffUserId, periodStart, periodEnd }) {
  const { lines } = await payrollService.calculatePayrollForPeriod(
    workspaceId,
    [staffUserId],
    periodStart,
    periodEnd,
  );

  const line = lines.find((l) => asIdString(l.user_id) === asIdString(staffUserId));

  if (!line || line.minutes_worked === 0) {
    throw createHttpError(400, "Staff has no completed shifts in this period.");
  }

  if (line.net_cents <= 0) {
    throw createHttpError(400, "Net pay is zero. Nothing to pay for this period.");
  }

  if (line.net_cents < MIN_AMOUNT_CENTS) {
    throw createHttpError(
      400,
      `Net pay must be at least $${(MIN_AMOUNT_CENTS / 100).toFixed(2)} to pay via Stripe.`,
    );
  }

  return line;
}

async function findOrCreatePayrollRun({ workspaceId, staffUserId, periodStart, periodEnd, line }) {
  let payrollRun = await PayrollRun.findOne({
    workspace_id: workspaceId,
    target_user_id: staffUserId,
    period_start: periodStart,
    period_end: periodEnd,
  });

  if (!payrollRun) {
    payrollRun = new PayrollRun({
      workspace_id: workspaceId,
      target_user_id: staffUserId,
      period_start: periodStart,
      period_end: periodEnd,
      status: "finalized",
      lines: [line],
    });
    await payrollRun.save();
    return payrollRun;
  }

  payrollRun.lines = [line];
  payrollRun.status = "finalized";
  payrollRun.updated_at = new Date();
  await payrollRun.save();
  return payrollRun;
}

async function persistPendingPayment(payrollRun, paymentIntent, invoice, amountCents, stripeAccountId) {
  payrollRun.stripe_payment = {
    status: "pending",
    payment_intent_id: paymentIntent.id,
    invoice_id: invoice ? invoice.id : null,
    hosted_invoice_url: invoice && invoice.hosted_invoice_url ? invoice.hosted_invoice_url : null,
    invoice_pdf_url: invoice && invoice.invoice_pdf ? invoice.invoice_pdf : null,
    amount_cents: amountCents,
    staff_stripe_account_id: stripeAccountId,
    paid_at: null,
    error: null,
  };
  payrollRun.updated_at = new Date();
  await payrollRun.save();
}

/**
 * Create (or reuse) a Stripe Invoice + PaymentIntent for staff payroll.
 * Seller sees the invoice in Stripe Dashboard; card is confirmed via client_secret.
 */
async function resolveOrCreatePayrollInvoice({
  stripe,
  payrollRun,
  amountCents,
  customerId,
  stripeAccountId,
  seller,
  workspace,
  staffUserId,
  staffName,
  periodStart,
  periodEnd,
}) {
  const existingPayment = readStripePayment(payrollRun);
  const metadata = buildStaffPayrollMetadata({
    payrollRun,
    workspace,
    seller,
    staffUserId,
    periodStart,
    periodEnd,
    amountCents,
  });
  const periodLabel = formatPayrollPeriodLabel(periodStart, periodEnd);

  let draftInvoice = null;

  if (existingPayment.invoice_id) {
    try {
      const existingInvoice = await stripe.invoices.retrieve(existingPayment.invoice_id);

      if (existingInvoice.status === "paid") {
        throw createHttpError(409, "This payroll period has already been paid via Stripe.");
      }

      if (existingInvoice.status === "draft" && existingInvoice.total === amountCents) {
        draftInvoice = existingInvoice;
      } else if (existingInvoice.status === "open") {
        const openPi = await resolveInvoicePaymentIntent(stripe, existingInvoice);
        if (canReusePayrollPaymentIntent(openPi, amountCents, payrollRun._id)) {
          return { invoice: existingInvoice, paymentIntent: openPi };
        }
        await discardOpenPayrollInvoice(stripe, existingPayment.invoice_id);
        await clearPendingPayrollStripeRefs(payrollRun);
      } else {
        await discardOpenPayrollInvoice(stripe, existingPayment.invoice_id);
        await clearPendingPayrollStripeRefs(payrollRun);
      }
    } catch (error) {
      if (error.status === 409) {
        throw error;
      }
      await clearPendingPayrollStripeRefs(payrollRun);
    }
  }

  if (!draftInvoice) {
    draftInvoice = await ensureDraftPayrollInvoice({
      stripe,
      customerId,
      stripeAccountId,
      metadata,
      staffName,
      periodLabel,
      amountCents,
    });
  }

  const paymentIntent = await resolveOrCreatePayrollPaymentIntent({
    stripe,
    payrollRun,
    amountCents,
    customerId,
    stripeAccountId,
    seller,
    workspace,
    staffUserId,
    periodStart,
    periodEnd,
    invoiceId: draftInvoice.id,
    metadata,
  });

  return { invoice: draftInvoice, paymentIntent };
}

/**
 * If payment succeeded without a linked invoice (legacy PI-only), record a paid invoice in Stripe.
 */
async function ensurePayrollStripeInvoice({
  stripe,
  payrollRun,
  paymentIntent,
  customerId,
  staffName,
  periodStart,
  periodEnd,
}) {
  const payment = readStripePayment(payrollRun);
  if (payment.invoice_id) {
    return payment.invoice_id;
  }

  const existingInvoiceId = extractStripeId(paymentIntent.invoice);
  if (existingInvoiceId) {
    const linked = await stripe.invoices.retrieve(existingInvoiceId);
    payrollRun.stripe_payment = {
      ...payment,
      invoice_id: linked.id,
      hosted_invoice_url: linked.hosted_invoice_url || payment.hosted_invoice_url,
      invoice_pdf_url: linked.invoice_pdf || payment.invoice_pdf_url,
    };
    payrollRun.updated_at = new Date();
    await payrollRun.save();
    return linked.id;
  }

  const amountCents =
    paymentIntent.amount_received || paymentIntent.amount || payment.amount_cents;
  if (!customerId || !amountCents) {
    return null;
  }

  const periodLabel = formatPayrollPeriodLabel(periodStart, periodEnd);
  const metadata = {
    payment_purpose: "staff_payroll",
    payroll_run_id: String(payrollRun._id),
    payment_intent_id: paymentIntent.id,
  };

  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: false,
    collection_method: "send_invoice",
    days_until_due: 0,
    description: `Staff payroll — ${staffName} (${periodLabel})`,
    metadata,
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: amountCents,
    currency: paymentIntent.currency || "usd",
    description: `Staff net pay: ${staffName} (${periodLabel})`,
    metadata,
  });

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id, {
    paid_out_of_band: true,
  });

  payrollRun.stripe_payment = {
    ...readStripePayment(payrollRun),
    invoice_id: paidInvoice.id,
    hosted_invoice_url: paidInvoice.hosted_invoice_url || null,
    invoice_pdf_url: paidInvoice.invoice_pdf || null,
  };
  payrollRun.updated_at = new Date();
  await payrollRun.save();

  return paidInvoice.id;
}

async function markPayrollPaidFromPaymentIntent(paymentIntent) {
  if (!isStaffPayrollPaymentIntent(paymentIntent)) {
    return null;
  }

  const payrollRunId = paymentIntent.metadata.payroll_run_id;
  if (!payrollRunId) {
    return null;
  }

  const payrollRun = await PayrollRun.findById(payrollRunId);
  if (!payrollRun) {
    return null;
  }

  const payment = readStripePayment(payrollRun);
  if (payment.status === "paid") {
    return payrollRun;
  }

  const stripe = getStripeClient();
  let invoiceId =
    payment.invoice_id ||
    (paymentIntent.metadata && paymentIntent.metadata.stripe_invoice_id) ||
    null;
  let hostedInvoiceUrl = payment.hosted_invoice_url || null;
  let invoicePdfUrl = payment.invoice_pdf_url || null;

  if (invoiceId) {
    try {
      const paidInvoice = await finalizePayrollInvoiceAfterPayment(stripe, invoiceId);
      if (paidInvoice) {
        invoiceId = paidInvoice.id;
        hostedInvoiceUrl = paidInvoice.hosted_invoice_url || hostedInvoiceUrl;
        invoicePdfUrl = paidInvoice.invoice_pdf || invoicePdfUrl;
      }
    } catch (invoiceError) {
      console.error("Failed to finalize payroll Stripe invoice:", invoiceError);
    }
  }

  const paymentIntentInvoiceId = extractStripeId(paymentIntent.invoice);
  if (paymentIntentInvoiceId && paymentIntentInvoiceId !== invoiceId) {
    try {
      const linkedInvoice = await finalizePayrollInvoiceAfterPayment(
        stripe,
        paymentIntentInvoiceId,
      );
      if (linkedInvoice) {
        invoiceId = linkedInvoice.id;
        hostedInvoiceUrl = linkedInvoice.hosted_invoice_url || hostedInvoiceUrl;
        invoicePdfUrl = linkedInvoice.invoice_pdf || invoicePdfUrl;
      }
    } catch (error) {
      if (!(error && error.code === "resource_missing")) {
        throw error;
      }
    }
  }

  if (!invoiceId) {
    const customerId = extractStripeId(paymentIntent.customer);
    const staffUser = payrollRun.target_user_id
      ? await User.findById(payrollRun.target_user_id).lean()
      : null;
    const staffName = staffUser?.full_name || staffUser?.email || "Staff";

    try {
      await ensurePayrollStripeInvoice({
        stripe,
        payrollRun,
        paymentIntent,
        customerId,
        staffName,
        periodStart: payrollRun.period_start,
        periodEnd: payrollRun.period_end,
      });
      const refreshedPayment = readStripePayment(payrollRun);
      invoiceId = refreshedPayment.invoice_id || invoiceId;
      hostedInvoiceUrl = refreshedPayment.hosted_invoice_url || hostedInvoiceUrl;
      invoicePdfUrl = refreshedPayment.invoice_pdf_url || invoicePdfUrl;
    } catch (invoiceError) {
      console.error("Failed to create Stripe invoice for payroll:", invoiceError);
    }
  }

  const now = new Date();
  payrollRun.stripe_payment = {
    ...payment,
    status: "paid",
    payment_intent_id: paymentIntent.id,
    invoice_id: invoiceId,
    hosted_invoice_url: hostedInvoiceUrl,
    invoice_pdf_url: invoicePdfUrl,
    amount_cents: paymentIntent.amount_received || paymentIntent.amount || payment.amount_cents,
    paid_at: now,
    error: null,
  };
  payrollRun.updated_at = now;
  await payrollRun.save();

  return payrollRun;
}

/** Stripe webhook: invoice.paid */
async function handlePayrollInvoicePaid(invoice) {
  if (!isStaffPayrollInvoice(invoice)) {
    return { handled: false };
  }

  const payrollRunId = invoice.metadata && invoice.metadata.payroll_run_id;
  if (!payrollRunId) {
    return { handled: false };
  }

  const payrollRun = await PayrollRun.findById(payrollRunId);
  if (!payrollRun) {
    return { handled: false };
  }

  const payment = readStripePayment(payrollRun);
  if (payment.status === "paid") {
    return { handled: true, payrollRunId };
  }

  const paymentIntentId = extractStripeId(invoice.payment_intent);
  if (paymentIntentId) {
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === "succeeded") {
      await markPayrollPaidFromPaymentIntent(paymentIntent);
      return { handled: true, payrollRunId };
    }
  }

  const now = new Date();
  payrollRun.stripe_payment = {
    ...payment,
    status: "paid",
    invoice_id: invoice.id,
    payment_intent_id: paymentIntentId || payment.payment_intent_id,
    hosted_invoice_url: invoice.hosted_invoice_url || payment.hosted_invoice_url,
    invoice_pdf_url: invoice.invoice_pdf || payment.invoice_pdf_url,
    amount_cents: invoice.amount_paid || payment.amount_cents,
    paid_at: now,
    error: null,
  };
  payrollRun.updated_at = now;
  await payrollRun.save();

  return { handled: true, payrollRunId };
}

async function getStaffStripeReadiness(staffUserId) {
  try {
    await getStaffStripeDestination(staffUserId);
    return { ready: true, message: null };
  } catch (error) {
    return {
      ready: false,
      message: error.message || "Stripe not ready.",
    };
  }
}

async function createStaffPayrollPaymentIntent({
  clerkUserId,
  staffUserId,
  periodStartRaw,
  periodEndRaw,
}) {
  const { user: seller, workspace } = await getSellerContext(clerkUserId);
  await assertStaffInWorkspace(workspace._id, staffUserId);

  const periodStart = new Date(periodStartRaw);
  const periodEnd = parseInclusiveEnd(periodEndRaw);

  if (Number.isNaN(periodStart.getTime()) || !periodEnd) {
    throw createHttpError(400, "Invalid period dates.");
  }

  const line = await resolvePayrollLineForStaff({
    workspaceId: workspace._id,
    staffUserId,
    periodStart,
    periodEnd,
  });

  const payrollRun = await findOrCreatePayrollRun({
    workspaceId: workspace._id,
    staffUserId,
    periodStart,
    periodEnd,
    line,
  });

  const existingPayment = readStripePayment(payrollRun);
  if (existingPayment.status === "paid") {
    throw createHttpError(409, "This payroll period has already been paid via Stripe.");
  }

  const { stripeAccountId, displayName } = await getStaffStripeDestination(staffUserId);
  const amountCents = line.net_cents;

  const stripe = getStripeClient();
  const customerId = await getOrCreateStripeCustomerForSeller({ stripe, seller, workspace });
  const staffUser = await User.findById(staffUserId).lean();

  const staffName = staffUser?.full_name || staffUser?.email || displayName || "Staff";

  const { invoice, paymentIntent } = await resolveOrCreatePayrollInvoice({
    stripe,
    payrollRun,
    amountCents,
    customerId,
    stripeAccountId,
    seller,
    workspace,
    staffUserId,
    staffName,
    periodStart,
    periodEnd,
  });

  await persistPendingPayment(payrollRun, paymentIntent, invoice, amountCents, stripeAccountId);

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    invoiceId: invoice.id,
    hostedInvoiceUrl: invoice.hosted_invoice_url || null,
    invoicePdfUrl: invoice.invoice_pdf || null,
    payrollRunId: payrollRun._id,
    amountCents,
    currency: "usd",
    staffUserId,
    staffName,
    staffStripeAccountId: stripeAccountId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    netPay: (amountCents / 100).toFixed(2),
    grossPay: (line.gross_cents / 100).toFixed(2),
    deductions: (line.deduction_cents / 100).toFixed(2),
  };
}

async function confirmStaffPayrollPayment({ clerkUserId, payrollRunId }) {
  const { workspace } = await getSellerContext(clerkUserId);

  const payrollRun = await PayrollRun.findById(payrollRunId);
  if (!payrollRun || asIdString(payrollRun.workspace_id) !== asIdString(workspace._id)) {
    throw createHttpError(404, "Payroll run not found.");
  }

  const payment = readStripePayment(payrollRun);
  if (!payment.payment_intent_id) {
    throw createHttpError(400, "No Stripe payment was started for this payroll run.");
  }

  if (payment.status === "paid") {
    return {
      success: true,
      alreadyPaid: true,
      payrollRunId: payrollRun._id,
      paymentStatus: "paid",
      paidAt: payment.paid_at,
    };
  }

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(payment.payment_intent_id);

  if (paymentIntent.status === "succeeded") {
    await markPayrollPaidFromPaymentIntent(paymentIntent);
    const refreshed = await PayrollRun.findById(payrollRun._id);
    const refreshedPayment = readStripePayment(refreshed);
    return {
      success: true,
      alreadyPaid: false,
      payrollRunId: refreshed._id,
      paymentStatus: "paid",
      paidAt: refreshedPayment.paid_at.toISOString(),
      amountCents: refreshedPayment.amount_cents,
      invoiceId: refreshedPayment.invoice_id || null,
      hostedInvoiceUrl: refreshedPayment.hosted_invoice_url || null,
      invoicePdfUrl: refreshedPayment.invoice_pdf_url || null,
    };
  }

  throw createHttpError(
    400,
    `Payment is not complete yet (status: ${paymentIntent.status}).`,
  );
}

/** Stripe webhook: payment_intent.succeeded */
async function handlePayrollPaymentSucceeded(paymentIntent) {
  const payrollRun = await markPayrollPaidFromPaymentIntent(paymentIntent);
  return { handled: Boolean(payrollRun), payrollRunId: payrollRun && payrollRun._id };
}

/** Stripe webhook: payment_intent.payment_failed */
async function handlePayrollPaymentFailed(paymentIntent) {
  if (!isStaffPayrollPaymentIntent(paymentIntent)) {
    return { handled: false };
  }

  const payrollRunId = paymentIntent.metadata.payroll_run_id;
  if (!payrollRunId) {
    return { handled: false };
  }

  const payrollRun = await PayrollRun.findById(payrollRunId);
  if (!payrollRun) {
    return { handled: false };
  }

  const payment = readStripePayment(payrollRun);
  if (payment.status === "paid") {
    return { handled: true };
  }

  payrollRun.stripe_payment = {
    ...payment,
    status: "failed",
    payment_intent_id: paymentIntent.id,
    error:
      (paymentIntent.last_payment_error && paymentIntent.last_payment_error.message) ||
      "Payment failed.",
  };
  payrollRun.updated_at = new Date();
  await payrollRun.save();

  return { handled: true, payrollRunId };
}

/** Stripe webhook: payment_intent.canceled */
async function handlePayrollPaymentCanceled(paymentIntent) {
  if (!isStaffPayrollPaymentIntent(paymentIntent)) {
    return { handled: false };
  }

  const payrollRunId = paymentIntent.metadata.payroll_run_id;
  if (!payrollRunId) {
    return { handled: false };
  }

  const payrollRun = await PayrollRun.findById(payrollRunId);
  if (!payrollRun) {
    return { handled: false };
  }

  const payment = readStripePayment(payrollRun);
  if (payment.status === "paid") {
    return { handled: true };
  }

  payrollRun.stripe_payment = {
    status: null,
    payment_intent_id: null,
    invoice_id: null,
    hosted_invoice_url: null,
    invoice_pdf_url: null,
    amount_cents: payment.amount_cents,
    staff_stripe_account_id: payment.staff_stripe_account_id,
    paid_at: null,
    error: null,
  };
  payrollRun.updated_at = new Date();
  await payrollRun.save();

  return { handled: true, payrollRunId };
}

module.exports = {
  getStaffStripeReadiness,
  createStaffPayrollPaymentIntent,
  confirmStaffPayrollPayment,
  handlePayrollPaymentSucceeded,
  handlePayrollPaymentFailed,
  handlePayrollPaymentCanceled,
  handlePayrollInvoicePaid,
  isStaffPayrollPaymentIntent,
  isStaffPayrollInvoice,
  MIN_AMOUNT_CENTS,
};
