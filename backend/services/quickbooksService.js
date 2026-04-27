const crypto = require("crypto");

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
  return process.env.BACKEND_URL || "http://localhost:5001";
}

function getIntuitConfig() {
  const clientId = process.env.INTUIT_CLIENT_ID;
  const clientSecret = process.env.INTUIT_CLIENT_SECRET;
  const redirectUri = process.env.INTUIT_REDIRECT_URI || `${getBackendUrl()}/api/integrations/quickbooks/callback`;
  const environment = (process.env.INTUIT_ENVIRONMENT || "sandbox").toLowerCase();

  if (!clientId || !clientSecret) {
    throw createHttpError(500, "QuickBooks integration is not configured. Set INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET.");
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
  return "https://oauth.platform.intuit.com/oauth2/v1/tokens/bucket";
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
  const redirectUrl = new URL(`${getFrontendUrl()}/seller/payroll`);
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
    throw createHttpError(403, "Only streamers can connect QuickBooks.");
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
      throw createHttpError(403, "Only streamers can connect QuickBooks.");
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

async function syncPayrollRunToQuickBooks({ clerkUserId, payrollRunId }) {
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

  const expenseAccountId = process.env.INTUIT_PAYROLL_EXPENSE_ACCOUNT_ID;
  const wagesPayableAccountId = process.env.INTUIT_PAYROLL_WAGES_PAYABLE_ACCOUNT_ID;
  const deductionsPayableAccountId = process.env.INTUIT_PAYROLL_DEDUCTIONS_PAYABLE_ACCOUNT_ID;

  if (!expenseAccountId || !wagesPayableAccountId) {
    throw createHttpError(
      500,
      "QuickBooks account mapping is not configured. Set INTUIT_PAYROLL_EXPENSE_ACCOUNT_ID and INTUIT_PAYROLL_WAGES_PAYABLE_ACCOUNT_ID.",
    );
  }

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

  const totalGross = run.lines.reduce((s, l) => s + l.gross_cents, 0);
  const totalNet = run.lines.reduce((s, l) => s + l.net_cents, 0);
  const totalDed = run.lines.reduce((s, l) => s + l.deduction_cents, 0);

  const amountGross = totalGross / 100;
  const amountNet = totalNet / 100;
  const amountDed = totalDed / 100;

  const lineDetails = [];

  lineDetails.push({
    Id: "1",
    Description: `Payroll ${run.period_start.toISOString().slice(0, 10)} → ${run.period_end.toISOString().slice(0, 10)}`,
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

  const journalPayload = {
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
    const msg =
      (body.Fault && body.Fault.Error && body.Fault.Error[0] && body.Fault.Error[0].Message) ||
      body.error ||
      "QuickBooks journal entry failed.";

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

module.exports = {
  createQuickBooksConnectionSession,
  handleQuickBooksCallback,
  syncPayrollRunToQuickBooks,
};
