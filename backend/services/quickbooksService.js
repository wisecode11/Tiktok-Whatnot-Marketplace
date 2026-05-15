const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const ConnectedAccount = require("../models/ConnectedAccount");
const SellerWorkspace = require("../models/SellerWorkspace");
const PayrollRun = require("../models/PayrollRun");
const User = require("../models/Users");
const { decryptText, encryptText } = require("../utils/crypto");

const attendanceService = require("./attendanceService");

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:3000";
}

function getBackendUrl() {
  return process.env.BACKEND_URL || "http://localhost:5000";
}

function getIntuitConfig() {
  const clientId =
    process.env.INTUIT_CLIENT_ID ||
    process.env.QUICKBOOKS_CLIENT_ID ||
    process.env.quickbookclinetkey;
  const clientSecret =
    process.env.INTUIT_CLIENT_SECRET ||
    process.env.QUICKBOOKS_CLIENT_SECRET ||
    process.env.quickbookClientsecret;
  const redirectUri =
    process.env.INTUIT_REDIRECT_URI ||
    process.env.QUICKBOOKS_REDIRECT_URI ||
    `${getBackendUrl()}/api/integrations/quickbooks/callback`;
  const environment =
    (process.env.INTUIT_ENVIRONMENT || process.env.QUICKBOOKS_ENVIRONMENT || "sandbox").toLowerCase();

  if (!clientId || !clientSecret) {
    throw createHttpError(
      500,
      "QuickBooks integration is not configured. Set INTUIT_CLIENT_ID/INTUIT_CLIENT_SECRET or QUICKBOOKS_CLIENT_ID/QUICKBOOKS_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret, redirectUri, environment };
}

function getQuickBooksApiBase(environment) {
  return environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

function getOAuthBase() {
  return "https://appcenter.intuit.com/connect/oauth2";
}

function getTokenUrl() {
  return "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? `${normalized}${"=".repeat(4 - padding)}` : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function signQuickBooksState(payload) {
  const secret = process.env.TIKTOK_STATE_SECRET || process.env.APP_ENCRYPTION_KEY;

  if (!secret) {
    throw createHttpError(500, "TIKTOK_STATE_SECRET or APP_ENCRYPTION_KEY is required for OAuth state.");
  }

  const body = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${signature}`;
}

function parseQuickBooksState(state) {
  const secret = process.env.TIKTOK_STATE_SECRET || process.env.APP_ENCRYPTION_KEY;

  if (!secret) {
    throw createHttpError(400, "OAuth state validation is not configured.");
  }

  const [body, signature] = String(state || "").split(".");

  if (!body || !signature) {
    throw createHttpError(400, "Invalid OAuth state.");
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  if (signature !== expectedSignature) {
    throw createHttpError(400, "OAuth state validation failed.");
  }

  const payload = JSON.parse(fromBase64Url(body));

  if (!payload || !payload.clerkUserId || !payload.timestamp) {
    throw createHttpError(400, "OAuth state is incomplete.");
  }

  if (Date.now() - Number(payload.timestamp) > 10 * 60 * 1000) {
    throw createHttpError(400, "OAuth state has expired. Please try again.");
  }

  return payload;
}

function buildFrontendRedirect({ status, message }) {
  const redirectUrl = new URL(`${getFrontendUrl()}/seller/manage-staff`);
  redirectUrl.searchParams.set("platform", "quickbooks");
  redirectUrl.searchParams.set("status", status);

  if (message) {
    redirectUrl.searchParams.set("message", message);
  }

  return redirectUrl.toString();
}

async function findLocalUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  return user;
}

async function createQuickBooksConnectionSession({ clerkUserId, role }) {
  getIntuitConfig();
  const user = await findLocalUser(clerkUserId);

  if (user.user_type !== "seller") {
    throw createHttpError(403, "Only sellers can connect QuickBooks.");
  }

  const workspace = await SellerWorkspace.findOne({ owner_user_id: user._id });

  if (!workspace) {
    throw createHttpError(404, "Workspace was not found.");
  }

  const { clientId, redirectUri } = getIntuitConfig();
  const state = signQuickBooksState({
    clerkUserId,
    role: role || "streamer",
    workspaceId: workspace._id,
    timestamp: Date.now(),
  });

  const scope = [
    "com.intuit.quickbooks.accounting",
    "openid",
    "profile",
    "email",
  ].join(" ");

  const authorizationUrl = new URL(getOAuthBase());
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", scope);
  authorizationUrl.searchParams.set("state", state);

  return { authorizationUrl: authorizationUrl.toString() };
}

async function exchangeCodeForTokens({ code, redirectUri }) {
  const { clientId, clientSecret } = getIntuitConfig();
  const tokenUrl = getTokenUrl();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createHttpError(
      response.status || 502,
      payload.error_description || payload.error || "QuickBooks token exchange failed.",
      payload,
    );
  }

  return payload;
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getIntuitConfig();
  const tokenUrl = getTokenUrl();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createHttpError(
      response.status || 502,
      payload.error_description || payload.error || "QuickBooks token refresh failed.",
      payload,
    );
  }

  return payload;
}

async function handleQuickBooksCallback({ code, state, realmId, error, errorDescription }) {
  let payload;

  try {
    payload = parseQuickBooksState(state);
  } catch (stateError) {
    return { redirectUrl: buildFrontendRedirect({ status: "error", message: stateError.message }) };
  }

  if (error) {
    return {
      redirectUrl: buildFrontendRedirect({
        status: "error",
        message: errorDescription || error,
      }),
    };
  }

  if (!code) {
    return {
      redirectUrl: buildFrontendRedirect({
        status: "error",
        message: "Missing QuickBooks authorization code.",
      }),
    };
  }

  try {
    const { redirectUri } = getIntuitConfig();
    const tokenPayload = await exchangeCodeForTokens({ code, redirectUri });
    const user = await findLocalUser(payload.clerkUserId);

    if (user.user_type !== "seller") {
      throw createHttpError(403, "Only sellers can connect QuickBooks.");
    }

    const workspace = await SellerWorkspace.findOne({ owner_user_id: user._id });

    if (!workspace) {
      throw createHttpError(404, "Workspace was not found.");
    }

    const now = new Date();
    const resolvedRealmId =
      realmId ||
      (tokenPayload && tokenPayload.realmId) ||
      (process.env.INTUIT_REALM_ID ? process.env.INTUIT_REALM_ID.trim() : null);

    if (!resolvedRealmId) {
      throw createHttpError(
        400,
        "Missing QuickBooks company (realm) ID. Ensure Intuit redirects with realmId or set INTUIT_REALM_ID.",
      );
    }

    let account =
      (await ConnectedAccount.findOne({
        user_id: user._id,
        platform: "quickbooks",
      })) ||
      new ConnectedAccount({
        user_id: user._id,
        platform: "quickbooks",
        workspace_id: workspace._id,
        created_at: now,
      });

    account.workspace_id = workspace._id;
    account.account_external_id = resolvedRealmId;
    account.account_name = `QuickBooks (${resolvedRealmId})`;
    account.access_token_encrypted = encryptText(tokenPayload.access_token);
    account.refresh_token_encrypted = encryptText(tokenPayload.refresh_token || "");
    account.token_expires_at = new Date(Date.now() + Number(tokenPayload.expires_in || 3600) * 1000);
    account.scopes_json = { scope: tokenPayload.scope, token_type: tokenPayload.token_type };
    account.status = "connected";
    account.metadata_json = {
      realm_id: resolvedRealmId,
      x_refresh_token_expires_in: tokenPayload.x_refresh_token_expires_in,
      connected_at: now.toISOString(),
    };
    account.updated_at = now;

    await account.save();

    return { redirectUrl: buildFrontendRedirect({ status: "connected" }) };
  } catch (callbackError) {
    return {
      redirectUrl: buildFrontendRedirect({
        status: "error",
        message: callbackError.message,
      }),
    };
  }
}

async function getValidQuickBooksAccessToken(account) {
  if (!account || !account.access_token_encrypted) {
    throw createHttpError(400, "QuickBooks is not connected.");
  }

  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  const bufferMs = 120 * 1000;

  if (expiresAt > Date.now() + bufferMs) {
    return decryptText(account.access_token_encrypted);
  }

  const refresh = account.refresh_token_encrypted ? decryptText(account.refresh_token_encrypted) : null;

  if (!refresh) {
    throw createHttpError(400, "QuickBooks refresh token is missing. Reconnect QuickBooks.");
  }

  const tokenPayload = await refreshAccessToken(refresh);
  const now = new Date();

  account.access_token_encrypted = encryptText(tokenPayload.access_token);

  if (tokenPayload.refresh_token) {
    account.refresh_token_encrypted = encryptText(tokenPayload.refresh_token);
  }

  account.token_expires_at = new Date(Date.now() + Number(tokenPayload.expires_in || 3600) * 1000);
  account.updated_at = now;
  await account.save();

  return decryptText(account.access_token_encrypted);
}

async function fetchQuickBooksAccounts({ apiBase, realmId, accessToken }) {
  const query = "select * from Account where Active = true";
  const url = `${apiBase}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg =
      (body.Fault && body.Fault.Error && body.Fault.Error[0] && body.Fault.Error[0].Message) ||
      body.error ||
      "Unable to fetch QuickBooks accounts for payroll mapping.";

    throw createHttpError(response.status || 502, msg, body);
  }

  const accounts =
    (body.QueryResponse && Array.isArray(body.QueryResponse.Account) && body.QueryResponse.Account) ||
    [];

  return accounts;
}

function pickAccount(accounts, predicate) {
  return accounts.find(predicate) || null;
}

function extractQuickBooksFaultMessage(body) {
  const firstError =
    body && body.Fault && Array.isArray(body.Fault.Error) ? body.Fault.Error[0] : null;

  return (
    (firstError && (firstError.Detail || firstError.Message)) ||
    body.error ||
    "QuickBooks journal entry failed."
  );
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
}

function formatIsoDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

async function buildJournalEntryFallbackPdf({ run, journalEntry, journalEntryId, realmId }) {
  return await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const lines = Array.isArray(journalEntry.Line) ? journalEntry.Line : [];
      const txDate = journalEntry.TxnDate || journalEntry.MetaData?.CreateTime || new Date().toISOString();

      doc.font("Helvetica-Bold").fontSize(20).text("QuickBooks Journal Entry");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Journal Entry ID: ${journalEntryId}`);
      doc.text(`Realm ID: ${realmId}`);
      doc.text(`Txn Date: ${formatIsoDate(txDate)}`);
      doc.text(`Period: ${formatIsoDate(run.period_start)} to ${formatIsoDate(run.period_end)}`);
      doc.moveDown(0.7);

      doc.font("Helvetica-Bold").fontSize(12).text("Lines");
      doc.moveDown(0.3);

      let debitTotal = 0;
      let creditTotal = 0;

      lines.forEach((line, idx) => {
        const detail = line.JournalEntryLineDetail || {};
        const posting = String(detail.PostingType || "").toLowerCase();
        const amount = Number(line.Amount || 0);
        const accountName =
          (detail.AccountRef && (detail.AccountRef.name || detail.AccountRef.value)) || "Unspecified account";
        const description = line.Description || "-";

        if (posting === "debit") debitTotal += amount;
        if (posting === "credit") creditTotal += amount;

        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(`${idx + 1}. ${posting ? posting.toUpperCase() : "LINE"} ${formatMoney(amount)}`);
        doc.font("Helvetica").fontSize(10).text(`Account: ${accountName}`);
        doc.text(`Description: ${description}`);
        doc.moveDown(0.35);
      });

      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").fontSize(11).text(`Total Debit: ${formatMoney(debitTotal)}`);
      doc.font("Helvetica-Bold").fontSize(11).text(`Total Credit: ${formatMoney(creditTotal)}`);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function resolveQuickBooksPayrollAccounts({ accounts, envExpenseId, envWagesPayableId, envDeductionsPayableId }) {
  const byId = new Map(accounts.map((a) => [String(a.Id), a]));

  const expenseFromEnv = envExpenseId ? byId.get(String(envExpenseId)) || { Id: String(envExpenseId) } : null;
  const wagesFromEnv = envWagesPayableId
    ? byId.get(String(envWagesPayableId)) || { Id: String(envWagesPayableId) }
    : null;
  const deductionsFromEnv = envDeductionsPayableId
    ? byId.get(String(envDeductionsPayableId)) || { Id: String(envDeductionsPayableId) }
    : null;

  const expenseCandidates = accounts.filter(
    (a) =>
      a &&
      (a.AccountType === "Expense" || a.Classification === "Expense" || a.AccountType === "Cost of Goods Sold")
  );
  const liabilityCandidates = accounts.filter(
    (a) =>
      a &&
      (a.AccountType === "Other Current Liability" ||
        a.AccountType === "Current Liability" ||
        a.AccountType === "Long Term Liability" ||
        (a.Classification === "Liability" && a.AccountType !== "Accounts Payable"))
  );

  const expenseAccount =
    expenseFromEnv ||
    pickAccount(
      expenseCandidates,
      (a) => /payroll|wage|salary/i.test(String(a.Name || ""))
    ) ||
    expenseCandidates[0] ||
    null;

  const wagesPayableAccount =
    wagesFromEnv ||
    pickAccount(
      liabilityCandidates,
      (a) => /wages? payable|payroll payable|payroll liabilities?/i.test(String(a.Name || ""))
    ) ||
    liabilityCandidates[0] ||
    null;

  const deductionsPayableAccount =
    deductionsFromEnv ||
    pickAccount(
      liabilityCandidates,
      (a) => /withholding|tax payable|deduction|benefit payable/i.test(String(a.Name || ""))
    ) ||
    null;

  return {
    expenseAccountId: expenseAccount ? String(expenseAccount.Id) : null,
    wagesPayableAccountId: wagesPayableAccount ? String(wagesPayableAccount.Id) : null,
    deductionsPayableAccountId: deductionsPayableAccount ? String(deductionsPayableAccount.Id) : null,
  };
}

async function syncPayrollRunToQuickBooks({ clerkUserId, payrollRunId, force = false }) {
  const ctx = await attendanceService.resolveWorkspaceContext(clerkUserId);
  await attendanceService.assertSeller(ctx.user);

  const run = await PayrollRun.findOne({
    _id: payrollRunId,
    workspace_id: ctx.workspace._id,
  });

  if (!run) {
    throw createHttpError(404, "Payroll run not found.");
  }

  if (!run.lines || run.lines.length === 0) {
    throw createHttpError(400, "Payroll run has no lines to sync.");
  }

  if (run.status !== "finalized") {
    throw createHttpError(
      400,
      "Payroll run must be approved before syncing to QuickBooks.",
    );
  }

  if (
    !force &&
    run.quickbooks_sync &&
    run.quickbooks_sync.synced_at &&
    run.quickbooks_sync.journal_entry_id &&
    run.quickbooks_sync.journal_entry_id !== "unknown"
  ) {
    return {
      success: true,
      alreadySynced: true,
      journalEntryId: run.quickbooks_sync.journal_entry_id,
      realmId: run.quickbooks_sync.realm_id,
      syncedAt: run.quickbooks_sync.synced_at,
      payrollRunId: run._id,
    };
  }

  const envExpenseAccountId = process.env.INTUIT_PAYROLL_EXPENSE_ACCOUNT_ID;
  const envWagesPayableAccountId = process.env.INTUIT_PAYROLL_WAGES_PAYABLE_ACCOUNT_ID;
  const envDeductionsPayableAccountId = process.env.INTUIT_PAYROLL_DEDUCTIONS_PAYABLE_ACCOUNT_ID;

  const account = await ConnectedAccount.findOne({
    user_id: ctx.user._id,
    platform: "quickbooks",
    status: "connected",
  });

  if (!account) {
    throw createHttpError(400, "Connect QuickBooks before syncing payroll.");
  }

  const realmId =
    (account.metadata_json && account.metadata_json.realm_id) || account.account_external_id;

  if (!realmId) {
    throw createHttpError(400, "QuickBooks realm ID is missing. Reconnect QuickBooks.");
  }

  const { environment } = getIntuitConfig();
  const apiBase = getQuickBooksApiBase(environment);
  const accessToken = await getValidQuickBooksAccessToken(account);
  const qbAccounts = await fetchQuickBooksAccounts({ apiBase, realmId, accessToken });
  const {
    expenseAccountId,
    wagesPayableAccountId,
    deductionsPayableAccountId,
  } = resolveQuickBooksPayrollAccounts({
    accounts: qbAccounts,
    envExpenseId: envExpenseAccountId,
    envWagesPayableId: envWagesPayableAccountId,
    envDeductionsPayableId: envDeductionsPayableAccountId,
  });

  if (!expenseAccountId || !wagesPayableAccountId) {
    throw createHttpError(
      500,
      "QuickBooks payroll mapping could not be resolved. Configure INTUIT_PAYROLL_EXPENSE_ACCOUNT_ID and INTUIT_PAYROLL_WAGES_PAYABLE_ACCOUNT_ID, or create one Expense account and one Liability account in QuickBooks.",
    );
  }

  const totalGross = run.lines.reduce((s, l) => s + l.gross_cents, 0);
  const totalNet = run.lines.reduce((s, l) => s + l.net_cents, 0);
  const totalDed = run.lines.reduce((s, l) => s + l.deduction_cents, 0);

  if (totalGross <= 0) {
    throw createHttpError(
      400,
      "Payroll gross amount is zero. Add attendance/rates first, then sync to QuickBooks.",
    );
  }

  const amountGross = totalGross / 100;
  const amountNet = totalNet / 100;
  const amountDed = totalDed / 100;

  const lineDetails = [];

  lineDetails.push({
    Id: "1",
    Description: `Payroll ${run.period_start.toISOString().slice(0, 10)} to ${run.period_end.toISOString().slice(0, 10)}`,
    Amount: amountGross,
    DetailType: "JournalEntryLineDetail",
    JournalEntryLineDetail: {
      PostingType: "Debit",
      AccountRef: { value: expenseAccountId },
    },
  });

  lineDetails.push({
    Id: "2",
    Description: "Net wages payable",
    Amount: amountNet,
    DetailType: "JournalEntryLineDetail",
    JournalEntryLineDetail: {
      PostingType: "Credit",
      AccountRef: { value: wagesPayableAccountId },
    },
  });

  if (amountDed > 0.0001 && deductionsPayableAccountId) {
    lineDetails.push({
      Id: "3",
      Description: "Withholdings / deductions payable",
      Amount: amountDed,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: {
        PostingType: "Credit",
        AccountRef: { value: deductionsPayableAccountId },
      },
    });
  } else if (amountDed > 0.0001 && !deductionsPayableAccountId) {
    const wagesLine = lineDetails.find((l) => l.Id === "2");
    if (wagesLine) {
      wagesLine.Amount = amountGross;
      wagesLine.Description = "Payroll wages & withholdings (combined)";
    }
  }

  const debitSum = lineDetails
    .filter((l) => l.JournalEntryLineDetail && l.JournalEntryLineDetail.PostingType === "Debit")
    .reduce((s, l) => s + l.Amount, 0);
  const creditSum = lineDetails
    .filter((l) => l.JournalEntryLineDetail && l.JournalEntryLineDetail.PostingType === "Credit")
    .reduce((s, l) => s + l.Amount, 0);

  if (Math.abs(debitSum - creditSum) > 0.02) {
    throw createHttpError(500, "Payroll journal entry is not balanced. Check account configuration.");
  }

  const runIdString = String(run._id);
  const docNumber = `PR-${runIdString.replace(/-/g, "").slice(0, 18)}`;

  const journalPayload = {
    DocNumber: docNumber,
    Line: lineDetails,
    PrivateNote: `SellerHub payroll run ${run._id}`,
  };

  const url = `${apiBase}/v3/company/${realmId}/journalentry?minorversion=65`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(journalPayload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = extractQuickBooksFaultMessage(body);

    run.quickbooks_sync = {
      ...run.quickbooks_sync,
      error: msg,
      synced_at: null,
      realm_id: realmId,
      journal_entry_id: null,
    };
    run.updated_at = new Date();
    await run.save();

    throw createHttpError(response.status || 502, msg, body);
  }

  const je =
    body.JournalEntry ||
    (body.QueryResponse && body.QueryResponse.JournalEntry && body.QueryResponse.JournalEntry[0]);

  const journalId = je && je.Id ? String(je.Id) : "unknown";

  run.quickbooks_sync = {
    synced_at: new Date(),
    realm_id: realmId,
    journal_entry_id: journalId,
    error: null,
  };
  run.updated_at = new Date();
  await run.save();

  return {
    success: true,
    journalEntryId: journalId,
    payrollRunId: run._id,
  };
}

/**
 * Download the official QuickBooks PDF for a synced payroll run.
 * Returns { pdfBuffer, filename } – the raw PDF bytes straight from QB.
 */
async function downloadPayrollRunPdfFromQuickBooks({ clerkUserId, payrollRunId }) {
  const ctx = await attendanceService.resolveWorkspaceContext(clerkUserId);
  await attendanceService.assertSeller(ctx.user);

  const run = await PayrollRun.findOne({
    _id: payrollRunId,
    workspace_id: ctx.workspace._id,
  });

  if (!run) {
    throw createHttpError(404, "Payroll run not found.");
  }

  const journalEntryId =
    run.quickbooks_sync && run.quickbooks_sync.journal_entry_id;
  const realmId =
    run.quickbooks_sync && run.quickbooks_sync.realm_id;

  if (!journalEntryId || journalEntryId === "unknown") {
    throw createHttpError(400, "This payroll run has not been synced to QuickBooks yet.");
  }

  if (!realmId) {
    throw createHttpError(400, "QuickBooks realm ID is missing on this payroll run.");
  }

  const account = await ConnectedAccount.findOne({
    user_id: ctx.user._id,
    platform: "quickbooks",
    status: "connected",
  });

  if (!account) {
    throw createHttpError(400, "QuickBooks is not connected.");
  }

  const { environment } = getIntuitConfig();
  const apiBase = getQuickBooksApiBase(environment);
  const accessToken = await getValidQuickBooksAccessToken(account);

  const url = `${apiBase}/v3/company/${realmId}/journalentry/${encodeURIComponent(journalEntryId)}/pdf?minorversion=65`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    // QB may reject JournalEntry PDF requests in some realms. Fall back to
    // JournalEntry JSON and return a generated document from QB data.
    const errBody = await response.json().catch(() => ({}));

    const readUrl = `${apiBase}/v3/company/${realmId}/journalentry/${encodeURIComponent(journalEntryId)}?minorversion=65`;
    const readResp = await fetch(readUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (readResp.ok) {
      const readBody = await readResp.json().catch(() => ({}));
      const je = readBody.JournalEntry || null;
      if (je) {
        const pdfBuffer = await buildJournalEntryFallbackPdf({
          run,
          journalEntry: je,
          journalEntryId,
          realmId,
        });
        const startDate = run.period_start.toISOString().slice(0, 10);
        const endDate = run.period_end.toISOString().slice(0, 10);
        const filename = `payroll-${startDate}-to-${endDate}-QB${journalEntryId}-journal.pdf`;
        return { pdfBuffer, filename, source: "qb-journal-json" };
      }
    }

    const msg = extractQuickBooksFaultMessage(errBody);
    throw createHttpError(response.status || 502, `QuickBooks PDF download failed: ${msg}`, errBody);
  }

  const arrayBuffer = await response.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  const startDate = run.period_start.toISOString().slice(0, 10);
  const endDate = run.period_end.toISOString().slice(0, 10);
  const filename = `payroll-${startDate}-to-${endDate}-QB${journalEntryId}.pdf`;

  return { pdfBuffer, filename, source: "qb-pdf" };
}

/**
 * Best-effort delete of an existing QuickBooks Journal Entry. Used when a
 * payroll run is being re-issued with new amounts and we don't want a stale
 * entry to remain in QB alongside the new one.
 *
 * Never throws — returns `{ ok: boolean, message?: string }` so callers can
 * proceed with their own flow regardless of QB cleanup success.
 */
async function deleteQuickBooksJournalEntryForRun({ clerkUserId, payrollRunId }) {
  try {
    const ctx = await attendanceService.resolveWorkspaceContext(clerkUserId);
    await attendanceService.assertSeller(ctx.user);

    const run = await PayrollRun.findOne({
      _id: payrollRunId,
      workspace_id: ctx.workspace._id,
    });

    if (!run || !run.quickbooks_sync) {
      return { ok: false, message: "No QuickBooks sync to clear." };
    }

    const journalEntryId = run.quickbooks_sync.journal_entry_id;
    const realmId =
      run.quickbooks_sync.realm_id ||
      (await ConnectedAccount.findOne({
        user_id: ctx.user._id,
        platform: "quickbooks",
        status: "connected",
      }).then((a) => (a && a.metadata_json && a.metadata_json.realm_id) || (a && a.account_external_id)));

    if (!journalEntryId || journalEntryId === "unknown" || !realmId) {
      return { ok: false, message: "No QuickBooks journal entry to delete." };
    }

    const account = await ConnectedAccount.findOne({
      user_id: ctx.user._id,
      platform: "quickbooks",
      status: "connected",
    });

    if (!account) {
      return { ok: false, message: "QuickBooks is not connected." };
    }

    const { environment } = getIntuitConfig();
    const apiBase = getQuickBooksApiBase(environment);
    const accessToken = await getValidQuickBooksAccessToken(account);

    // QB requires the current SyncToken to delete — fetch the entry first.
    const readUrl = `${apiBase}/v3/company/${realmId}/journalentry/${encodeURIComponent(journalEntryId)}?minorversion=65`;
    const readResp = await fetch(readUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!readResp.ok) {
      return { ok: false, message: "Could not look up existing QuickBooks journal entry." };
    }

    const readBody = await readResp.json().catch(() => ({}));
    const je = readBody.JournalEntry;
    if (!je || !je.SyncToken) {
      return { ok: false, message: "QuickBooks journal entry has no SyncToken." };
    }

    const deleteUrl = `${apiBase}/v3/company/${realmId}/journalentry?operation=delete&minorversion=65`;
    const delResp = await fetch(deleteUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Id: String(journalEntryId), SyncToken: String(je.SyncToken) }),
    });

    if (!delResp.ok) {
      const body = await delResp.json().catch(() => ({}));
      return {
        ok: false,
        message: extractQuickBooksFaultMessage(body) || "Failed to delete QuickBooks journal entry.",
      };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message || "Unexpected error while deleting QB journal entry." };
  }
}

module.exports = {
  createQuickBooksConnectionSession,
  handleQuickBooksCallback,
  syncPayrollRunToQuickBooks,
  downloadPayrollRunPdfFromQuickBooks,
  deleteQuickBooksJournalEntryForRun,
};
