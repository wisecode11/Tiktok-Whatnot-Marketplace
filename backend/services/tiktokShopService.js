const crypto = require("crypto");

const ConnectedAccount = require("../models/ConnectedAccount");
const User = require("../models/Users");
const { buildMockOrdersSearch, findMockOrderById } = require("../data/tiktokShopOrderMocks");
const { buildMockGlobalProductsSearch } = require("../data/tiktokGlobalProductsSearchMock");
const { buildMockGlobalProductsCreateResponse } = require("../data/tiktokGlobalProductsCreateMock");
const { buildMockGlobalProductGetResponse } = require("../data/tiktokGlobalProductGetMock");
const { buildMockGlobalProductUpdate202509Response } = require("../data/tiktokGlobalProductUpdate202509Mock");

const TIKTOK_SHOP_API_BASE = (process.env.TIKTOK_SHOP_API_BASE || "https://open-api.tiktokglobalshop.com").replace(
  /\/$/,
  "",
);
const ORDER_SEARCH_PATH = "/order/202309/orders/search";
/** Global product search (Partner API 202309) — same path the live Open Platform uses. */
const GLOBAL_PRODUCT_SEARCH_PATH = "/product/202309/global_products/search";
/** Order detail by id (query `ids`) — same API group as Partner examples. */
const ORDER_GET_PATH = "/order/202309/orders";
/** Create product (Partner API 202309). */
const GLOBAL_PRODUCT_CREATE_PATH = "/product/202309/products";
/** Update product (Partner API 202509). */
const GLOBAL_PRODUCT_UPDATE_202509_PREFIX = "/product/202509/products";
const FINANCE_STATEMENTS_PATH = "/finance/202309/statements";
const FINANCE_PAYMENTS_PATH = "/finance/202309/payments";
const FINANCE_WITHDRAWALS_PATH = "/finance/202309/withdrawals";
const FINANCE_UNSETTLED_ORDERS_PATH = "/finance/202507/orders/unsettled";

const MOCK_FINANCE_STATEMENT = {
  id: "7238804564097517339",
  statement_time: 1685548800,
  settlement_amount: "100",
  currency: "GBP",
  revenue_amount: "200",
  fee_amount: "-30",
  adjustment_amount: "-70",
  payment_status: "PAID",
  payment_id: "3459275187040258849",
  net_sales_amount: "-70",
  shipping_cost_amount: "-70",
  payment_time: 1685548800,
};

const MOCK_FINANCE_PAYMENT = {
  create_time: 1636105796,
  id: "3458767051733897992",
  status: "PAID",
  amount: {
    value: "100",
    currency: "GBP",
  },
  settlement_amount: {
    value: "130",
    currency: "GBP",
  },
  reserve_amount: {
    value: "-30",
    currency: "GBP",
  },
  payment_amount_before_exchange: {
    value: "100",
    currency: "GBP",
  },
  exchange_rate: "1.000000",
  paid_time: 1685548800,
  bank_account: "***********1234",
};

const MOCK_FINANCE_WITHDRAWAL = {
  id: "EFASDFSAFDA23432DFAFDSA",
  type: "WITHDRAW",
  amount: "100",
  currency: "IDR",
  status: "PROCESSING",
  create_time: 1623812664,
};

const MOCK_FINANCE_STATEMENT_TRANSACTION = {
  id: "1636700041413599290",
  type: "ORDER",
  order_id: "576463220456522968",
  order_create_time: 1685548800,
  adjustment_id: "7238804564097517332",
  adjustment_order_id: "576463220456522968",
  adjustment_amount: "170",
  settlement_amount: "130",
  revenue_amount: "200",
  shipping_cost_amount: "-70",
  fee_tax_amount: "-30",
  reserve_id: "56789910",
  reserve_amount: "100",
  reserve_status: "Collected",
  estimated_release_time: 1685548800,
};

const MOCK_FINANCE_UNSETTLED_ORDER = {
  type: "ORDER",
  id: "1636700041413599290",
  status: "UNSETTLED",
  currency: "USD",
  estimated_settlement: 1685548800,
  unsettled_reason: "waiting for delivery",
  order_create_time: 1685548800,
  order_delivery_time: 1685548800,
  order_id: "576463220456522968",
  adjustment_id: "7238804564097517332",
  adjustment_order_id: "576463220456522968",
  est_adjustment_amount: "170",
  est_settlement_amount: "130",
  est_revenue_amount: "200",
  est_shipping_cost_amount: "-70",
  est_fee_tax_amount: "-30",
};

/** Request body filter keys allowed for Order Search (Partner API 202309). */
const FILTER_KEYS = new Set([
  "order_status",
  "create_time_ge",
  "create_time_lt",
  "update_time_ge",
  "update_time_lt",
  "shipping_type",
  "buyer_user_id",
  "is_buyer_request_cancel",
  "warehouse_ids",
]);

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

/**
 * TikTok Shop Open Platform request signature (HMAC-SHA256, hex).
 * @see https://partner.tiktokshop.com/docv2/page/sign-your-api-request
 */
function signTiktokShopRequest(appSecret, path, queryForSign, bodyString) {
  const keys = Object.keys(queryForSign)
    .filter(
      (k) =>
        k !== "sign"
        && queryForSign[k] != null
        && String(queryForSign[k]).length > 0,
    )
    .sort();
  const paramStr = keys.map((k) => `${k}${queryForSign[k]}`).join("");
  const plain = `${appSecret}${path}${paramStr}${bodyString}${appSecret}`;
  return crypto.createHmac("sha256", appSecret).update(plain).digest("hex");
}

function pickFilters(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const out = {};
  for (const key of FILTER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) {
      continue;
    }
    const v = raw[key];
    if (key === "warehouse_ids") {
      if (Array.isArray(v) && v.length) {
        out[key] = v.map((x) => String(x));
      }
      continue;
    }
    if (key === "is_buyer_request_cancel" && typeof v === "boolean") {
      out[key] = v;
      continue;
    }
    if (key === "buyer_user_id" && v != null && String(v).trim()) {
      out[key] = String(v).trim();
      continue;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
      continue;
    }
    if (typeof v === "string" && v.trim()) {
      out[key] = v.trim();
    }
  }
  return out;
}

/**
 * Partner app key/secret come from env.
 * Shop access token + shop_cipher: env, or override on the seller's `tiktok` ConnectedAccount
 * under `metadata_json.tiktok_shop`.
 */
async function resolveShopCredentials(clerkUserId) {
  const appKey = (process.env.TIKTOK_SHOP_APP_KEY || "").trim();
  const appSecret = (process.env.TIKTOK_SHOP_APP_SECRET || "").trim();

  if (!appKey || !appSecret) {
    return { shopConnected: false, reason: "missing_partner_app" };
  }

  let accessToken = (process.env.TIKTOK_SHOP_ACCESS_TOKEN || "").trim();
  let shopCipher = (process.env.TIKTOK_SHOP_SHOP_CIPHER || "").trim();

  const normalizedClerk = typeof clerkUserId === "string" ? clerkUserId.trim() : "";
  if ((!accessToken || !shopCipher) && normalizedClerk) {
    const user = await User.findOne({ clerk_user_id: normalizedClerk });
    if (user) {
      const account = await ConnectedAccount.findOne({ user_id: user._id, platform: "tiktok" });
      const shop = account?.metadata_json?.tiktok_shop;
      if (shop && typeof shop === "object") {
        if (!accessToken && typeof shop.access_token === "string" && shop.access_token.trim()) {
          accessToken = shop.access_token.trim();
        }
        if (!shopCipher && typeof shop.shop_cipher === "string" && shop.shop_cipher.trim()) {
          shopCipher = shop.shop_cipher.trim();
        }
      }
    }
  }

  if (!accessToken || !shopCipher) {
    return { shopConnected: false, reason: "missing_shop_token" };
  }

  return {
    shopConnected: true,
    reason: null,
    appKey,
    appSecret,
    accessToken,
    shopCipher,
  };
}

function wrapPartnerPayload(payload) {
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const orders = Array.isArray(data.orders)
    ? data.orders
    : Array.isArray(data.order_list)
      ? data.order_list
      : [];

  const detailOrder =
    data.order_detail && typeof data.order_detail === "object"
      ? data.order_detail
      : orders[0]
        ? orders[0]
        : typeof data.order === "object"
          ? data.order
          : null;

  return { data, orders, detailOrder };
}

async function tiktokPartnerFetch(creds, { method, path, extraQuery = {}, bodyObject }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const normalizedMethod = (method || "POST").toUpperCase();
  const bodyString =
    normalizedMethod === "GET" || normalizedMethod === "HEAD"
      ? ""
      : JSON.stringify(bodyObject === undefined ? {} : bodyObject);

  const queryForSign = {
    app_key: creds.appKey,
    shop_cipher: creds.shopCipher,
    timestamp: String(timestamp),
    ...extraQuery,
  };

  Object.keys(queryForSign).forEach((key) => {
    const val = queryForSign[key];
    if (val == null || String(val) === "") {
      delete queryForSign[key];
    }
  });

  const sign = signTiktokShopRequest(creds.appSecret, path, queryForSign, bodyString);

  const url = new URL(`${TIKTOK_SHOP_API_BASE}${path}`);
  for (const [k, val] of Object.entries({ ...queryForSign, sign })) {
    if (val != null && String(val) !== "") {
      url.searchParams.set(k, String(val));
    }
  }

  const headers = {
    "x-tts-access-token": creds.accessToken,
  };

  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") {
    headers["content-type"] = "application/json";
  }

  const fetchInit = {
    method: normalizedMethod,
    headers,
  };

  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") {
    fetchInit.body = bodyString;
  }

  const response = await fetch(url.toString(), fetchInit);
  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw createHttpError(502, "TikTok Shop returned a non-JSON response.", {
      preview: text.slice(0, 500),
    });
  }

  if (!response.ok) {
    throw createHttpError(
      response.status,
      payload.message || `TikTok Shop request failed (HTTP ${response.status}).`,
      payload,
    );
  }

  if (payload.code !== 0) {
    throw createHttpError(502, payload.message || "TikTok Shop API returned an error.", payload);
  }

  return { payload, parsed: wrapPartnerPayload(payload), request_id: payload.request_id || null };
}

function envelopeSearch(mockData, shopConnected, isMockData, reason) {
  const totalRaw = mockData.total_count;
  return {
    configured: shopConnected,
    shopConnected,
    isMockData,
    reason,
    note: isMockData
      ? "Demo TikTok Shop order payload — connect seller credentials to load production data."
      : null,
    totalCount: typeof totalRaw === "number" ? totalRaw : Number(totalRaw) || 0,
    nextPageToken: mockData.next_page_token || null,
    orders: Array.isArray(mockData.orders) ? mockData.orders : [],
    requestId: mockData.request_id || null,
  };
}

function normalizePageSize(value, fallback = 20) {
  const parsed = Number(value);
  return String(Math.min(Math.max(Number.isFinite(parsed) ? parsed : fallback, 1), 100));
}

function normalizePageToken(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEpoch(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.floor(value));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? String(Math.floor(parsed)) : null;
  }
  return null;
}

function normalizeSortOrder(value, fallback = "DESC") {
  return value === "ASC" || value === "DESC" ? value : fallback;
}

function buildFinanceStatementTransactionsPath(statementId) {
  return `/finance/202501/statements/${encodeURIComponent(statementId)}/statement_transactions`;
}

function envelopeFinanceBase({ shopConnected, isMockData, reason, requestId, note }) {
  return {
    configured: shopConnected,
    shopConnected,
    isMockData,
    reason,
    note: note || (isMockData ? "Demo TikTok Shop finance payload — connect seller credentials to load production data." : null),
    requestId: requestId || null,
  };
}

async function getTiktokFinanceStatements({
  clerkUserId,
  statementTimeGe,
  statementTimeLt,
  paymentStatus,
  pageSize = 20,
  pageToken,
  sortOrder = "DESC",
  sortField = "statement_time",
} = {}) {
  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    return {
      ...envelopeFinanceBase({
        shopConnected: false,
        isMockData: true,
        reason: creds.reason,
        requestId: "202203070749000101890810281E8C70B7",
      }),
      nextPageToken: null,
      statements: [MOCK_FINANCE_STATEMENT],
    };
  }

  const query = {
    page_size: normalizePageSize(pageSize, 20),
    sort_order: normalizeSortOrder(sortOrder, "DESC"),
    sort_field: typeof sortField === "string" && sortField.trim() ? sortField.trim() : "statement_time",
  };

  const token = normalizePageToken(pageToken);
  const ge = normalizeEpoch(statementTimeGe);
  const lt = normalizeEpoch(statementTimeLt);
  if (token) {
    query.page_token = token;
  }
  if (ge) {
    query.statement_time_ge = ge;
  }
  if (lt) {
    query.statement_time_lt = lt;
  }
  if (typeof paymentStatus === "string" && paymentStatus.trim()) {
    query.payment_status = paymentStatus.trim().toUpperCase();
  }

  const { parsed, request_id } = await tiktokPartnerFetch(creds, {
    method: "GET",
    path: FINANCE_STATEMENTS_PATH,
    extraQuery: query,
  });

  return {
    ...envelopeFinanceBase({
      shopConnected: true,
      isMockData: false,
      reason: null,
      requestId: request_id,
    }),
    nextPageToken: parsed.data && parsed.data.next_page_token ? parsed.data.next_page_token : null,
    statements: parsed.data && Array.isArray(parsed.data.statements) ? parsed.data.statements : [],
  };
}

async function getTiktokFinancePayments({
  clerkUserId,
  createTimeGe,
  createTimeLt,
  pageSize = 20,
  pageToken,
  sortOrder = "DESC",
  sortField = "create_time",
} = {}) {
  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    return {
      ...envelopeFinanceBase({
        shopConnected: false,
        isMockData: true,
        reason: creds.reason,
        requestId: "202203070749000101890810281E8C70B7",
      }),
      nextPageToken: null,
      payments: [MOCK_FINANCE_PAYMENT],
    };
  }

  const query = {
    page_size: normalizePageSize(pageSize, 20),
    sort_order: normalizeSortOrder(sortOrder, "DESC"),
    sort_field: typeof sortField === "string" && sortField.trim() ? sortField.trim() : "create_time",
  };

  const token = normalizePageToken(pageToken);
  const ge = normalizeEpoch(createTimeGe);
  const lt = normalizeEpoch(createTimeLt);
  if (token) {
    query.page_token = token;
  }
  if (ge) {
    query.create_time_ge = ge;
  }
  if (lt) {
    query.create_time_lt = lt;
  }

  const { parsed, request_id } = await tiktokPartnerFetch(creds, {
    method: "GET",
    path: FINANCE_PAYMENTS_PATH,
    extraQuery: query,
  });

  return {
    ...envelopeFinanceBase({
      shopConnected: true,
      isMockData: false,
      reason: null,
      requestId: request_id,
    }),
    nextPageToken: parsed.data && parsed.data.next_page_token ? parsed.data.next_page_token : null,
    payments: parsed.data && Array.isArray(parsed.data.payments) ? parsed.data.payments : [],
  };
}

async function getTiktokFinanceWithdrawals({
  clerkUserId,
  createTimeGe,
  createTimeLt,
  types,
  pageSize = 20,
  pageToken,
} = {}) {
  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    return {
      ...envelopeFinanceBase({
        shopConnected: false,
        isMockData: true,
        reason: creds.reason,
        requestId: "202203070749000101890810281E8C70B7",
      }),
      nextPageToken: null,
      totalCount: 1,
      withdrawals: [MOCK_FINANCE_WITHDRAWAL],
    };
  }

  const query = {
    page_size: normalizePageSize(pageSize, 20),
  };

  const token = normalizePageToken(pageToken);
  const ge = normalizeEpoch(createTimeGe);
  const lt = normalizeEpoch(createTimeLt);
  if (token) {
    query.page_token = token;
  }
  if (ge) {
    query.create_time_ge = ge;
  }
  if (lt) {
    query.create_time_lt = lt;
  }

  const normalizedTypes = Array.isArray(types)
    ? types.map((t) => String(t || "").trim()).filter(Boolean)
    : typeof types === "string" && types.trim()
      ? types.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
  if (normalizedTypes.length) {
    query.types = normalizedTypes.join(",");
  }

  const { parsed, request_id } = await tiktokPartnerFetch(creds, {
    method: "GET",
    path: FINANCE_WITHDRAWALS_PATH,
    extraQuery: query,
  });

  const totalRaw = parsed.data && parsed.data.total_count;

  return {
    ...envelopeFinanceBase({
      shopConnected: true,
      isMockData: false,
      reason: null,
      requestId: request_id,
    }),
    nextPageToken: parsed.data && parsed.data.next_page_token ? parsed.data.next_page_token : null,
    totalCount: typeof totalRaw === "number" ? totalRaw : Number(totalRaw) || 0,
    withdrawals: parsed.data && Array.isArray(parsed.data.withdrawals) ? parsed.data.withdrawals : [],
  };
}

async function getTiktokFinanceStatementTransactions({
  clerkUserId,
  statementId,
  pageSize = 20,
  pageToken,
  sortOrder = "DESC",
  sortField = "order_create_time",
} = {}) {
  const normalizedStatementId = typeof statementId === "string" ? statementId.trim() : "";
  if (!normalizedStatementId) {
    throw createHttpError(400, "statementId is required.");
  }

  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    return {
      ...envelopeFinanceBase({
        shopConnected: false,
        isMockData: true,
        reason: creds.reason,
        requestId: "202203070749000101890810281E8C70B7",
      }),
      nextPageToken: null,
      id: normalizedStatementId,
      createTime: 1685548800,
      status: "SETTLED",
      currency: "GBP",
      payableAmount: "150",
      totalReserveAmount: "20",
      totalSettlementAmount: "130",
      totalSettlementBreakdown: {
        total_revenue_amount: "100",
        total_shipping_cost_amount: "120",
        total_fee_tax_amount: "20",
        total_adjustment_amount: "0",
      },
      totalCount: 1,
      transactions: [MOCK_FINANCE_STATEMENT_TRANSACTION],
    };
  }

  const query = {
    page_size: normalizePageSize(pageSize, 20),
    sort_order: normalizeSortOrder(sortOrder, "DESC"),
    sort_field: typeof sortField === "string" && sortField.trim() ? sortField.trim() : "order_create_time",
  };

  const token = normalizePageToken(pageToken);
  if (token) {
    query.page_token = token;
  }

  const { parsed, request_id } = await tiktokPartnerFetch(creds, {
    method: "GET",
    path: buildFinanceStatementTransactionsPath(normalizedStatementId),
    extraQuery: query,
  });

  const data = parsed.data && typeof parsed.data === "object" ? parsed.data : {};
  const totalRaw = data.total_count;

  return {
    ...envelopeFinanceBase({
      shopConnected: true,
      isMockData: false,
      reason: null,
      requestId: request_id,
    }),
    nextPageToken: data.next_page_token || null,
    id: data.id || normalizedStatementId,
    createTime: typeof data.create_time === "number" ? data.create_time : null,
    status: data.status || null,
    currency: data.currency || null,
    payableAmount: data.payable_amount || null,
    totalReserveAmount: data.total_reserve_amount || null,
    totalSettlementAmount: data.total_settlement_amount || null,
    totalSettlementBreakdown:
      data.total_settlement_breakdown && typeof data.total_settlement_breakdown === "object"
        ? data.total_settlement_breakdown
        : null,
    totalCount: typeof totalRaw === "number" ? totalRaw : Number(totalRaw) || 0,
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
  };
}

async function getTiktokFinanceUnsettledOrders({
  clerkUserId,
  pageSize = 20,
  pageToken,
  sortOrder = "ASC",
  sortField = "order_create_time",
  searchTimeGe,
  searchTimeLt,
} = {}) {
  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    return {
      ...envelopeFinanceBase({
        shopConnected: false,
        isMockData: true,
        reason: creds.reason,
        requestId: "202203070749000101890810281E8C70B7",
      }),
      nextPageToken: null,
      totalCount: 1,
      sumEstSettlementAmount: "130",
      sumEstRevenueAmount: "200",
      sumEstAdjustmentAmount: "170",
      sumEstFeeAmount: "-30",
      transactions: [MOCK_FINANCE_UNSETTLED_ORDER],
    };
  }

  const query = {
    page_size: normalizePageSize(pageSize, 20),
    sort_order: normalizeSortOrder(sortOrder, "ASC"),
    sort_field: typeof sortField === "string" && sortField.trim() ? sortField.trim() : "order_create_time",
  };

  const token = normalizePageToken(pageToken);
  const ge = normalizeEpoch(searchTimeGe);
  const lt = normalizeEpoch(searchTimeLt);
  if (token) {
    query.page_token = token;
  }
  if (ge) {
    query.search_time_ge = ge;
  }
  if (lt) {
    query.search_time_lt = lt;
  }

  const { parsed, request_id } = await tiktokPartnerFetch(creds, {
    method: "GET",
    path: FINANCE_UNSETTLED_ORDERS_PATH,
    extraQuery: query,
  });

  const data = parsed.data && typeof parsed.data === "object" ? parsed.data : {};
  const totalRaw = data.total_count;

  return {
    ...envelopeFinanceBase({
      shopConnected: true,
      isMockData: false,
      reason: null,
      requestId: request_id,
    }),
    nextPageToken: data.next_page_token || null,
    totalCount: typeof totalRaw === "number" ? totalRaw : Number(totalRaw) || 0,
    sumEstSettlementAmount: data.sum_est_settlement_amount || "0",
    sumEstRevenueAmount: data.sum_est_revenue_amount || "0",
    sumEstAdjustmentAmount: data.sum_est_adjustment_amount || "0",
    sumEstFeeAmount: data.sum_est_fee_amount || "0",
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
  };
}

async function searchTiktokShopOrders({
  clerkUserId,
  filters = {},
  pageSize = 20,
  pageToken,
  sortOrder = "DESC",
  sortField = "create_time",
} = {}) {
  const creds = await resolveShopCredentials(clerkUserId);

  const bodyFilters = pickFilters(filters);
  const trimmedToken = typeof pageToken === "string" ? pageToken.trim() : "";

  if (!creds.shopConnected) {
    const mockData = buildMockOrdersSearch(bodyFilters, pageSize, trimmedToken || undefined);
    return envelopeSearch(mockData, false, true, creds.reason);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = JSON.stringify(bodyFilters);

  const size = Number(pageSize);
  const safeSize = Math.min(Math.max(Number.isFinite(size) ? size : 20, 1), 100);

  const queryForSign = {
    app_key: creds.appKey,
    shop_cipher: creds.shopCipher,
    timestamp: String(timestamp),
    page_size: String(safeSize),
    sort_order: sortOrder === "ASC" ? "ASC" : "DESC",
    sort_field:
      typeof sortField === "string" && sortField.trim() ? sortField.trim() : "create_time",
  };

  if (trimmedToken) {
    queryForSign.page_token = trimmedToken;
  }

  const sign = signTiktokShopRequest(creds.appSecret, ORDER_SEARCH_PATH, queryForSign, bodyString);
  const querySigned = { ...queryForSign, sign };

  const url = new URL(`${TIKTOK_SHOP_API_BASE}${ORDER_SEARCH_PATH}`);
  for (const [k, v] of Object.entries(querySigned)) {
    if (v != null && String(v) !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": creds.accessToken,
    },
    body: bodyString,
  });

  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw createHttpError(502, "TikTok Shop returned a non-JSON response.", {
      preview: text.slice(0, 500),
    });
  }

  if (!response.ok) {
    throw createHttpError(
      response.status,
      payload.message || `TikTok Shop request failed (HTTP ${response.status}).`,
      payload,
    );
  }

  if (payload.code !== 0) {
    throw createHttpError(502, payload.message || "TikTok Shop API returned an error.", payload);
  }

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const totalRaw = data.total_count;

  return envelopeSearch(
    {
      total_count:
        typeof totalRaw === "number" ? totalRaw : Number(totalRaw) || data.orders?.length || 0,
      next_page_token: data.next_page_token || null,
      orders: Array.isArray(data.orders) ? data.orders : [],
      request_id: payload.request_id || null,
    },
    true,
    false,
    null,
  );
}

function stripGlobalProductPagination(body) {
  if (!body || typeof body !== "object") {
    return {};
  }
  const out = { ...body };
  delete out.page_size;
  delete out.page_token;
  return out;
}

/**
 * Proxies `POST /product/202309/global_products/search`.
 * When shop credentials are missing, returns a TikTok-shaped mock envelope (same keys as production).
 */
async function searchTiktokGlobalProducts({ clerkUserId, body = {} } = {}) {
  const creds = await resolveShopCredentials(clerkUserId);
  const raw = body && typeof body === "object" ? body : {};
  const pageSizeRaw = raw.page_size != null ? Number(raw.page_size) : 100;
  const safeSize = Math.min(Math.max(Number.isFinite(pageSizeRaw) ? pageSizeRaw : 100, 1), 100);
  const pageToken = typeof raw.page_token === "string" ? raw.page_token.trim() : "";
  const filterBody = stripGlobalProductPagination(raw);

  if (!creds.shopConnected) {
    return buildMockGlobalProductsSearch({
      pageSize: safeSize,
      pageToken,
      filters: filterBody,
    });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = JSON.stringify(filterBody);

  const queryForSign = {
    app_key: creds.appKey,
    shop_cipher: creds.shopCipher,
    timestamp: String(timestamp),
    page_size: String(safeSize),
  };

  if (pageToken) {
    queryForSign.page_token = pageToken;
  }

  const sign = signTiktokShopRequest(creds.appSecret, GLOBAL_PRODUCT_SEARCH_PATH, queryForSign, bodyString);
  const querySigned = { ...queryForSign, sign };

  const url = new URL(`${TIKTOK_SHOP_API_BASE}${GLOBAL_PRODUCT_SEARCH_PATH}`);
  for (const [k, v] of Object.entries(querySigned)) {
    if (v != null && String(v) !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": creds.accessToken,
    },
    body: bodyString,
  });

  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw createHttpError(502, "TikTok Shop returned a non-JSON response.", {
      preview: text.slice(0, 500),
    });
  }

  if (!response.ok) {
    throw createHttpError(
      response.status,
      payload.message || `TikTok Shop request failed (HTTP ${response.status}).`,
      payload,
    );
  }

  if (payload.code !== 0) {
    throw createHttpError(502, payload.message || "TikTok Shop API returned an error.", payload);
  }

  return payload;
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => stripUndefinedDeep(v))
      .filter((v) => v !== undefined)
  }
  if (value && typeof value === "object") {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue
      const next = stripUndefinedDeep(v)
      if (next !== undefined) out[k] = next
    }
    return out
  }
  return value
}

/**
 * Proxies TikTok Shop Partner `POST /product/202309/products`.
 * When shop credentials are missing, returns a TikTok-shaped mock response.
 */
async function createTiktokGlobalProduct({ clerkUserId, body = {} } = {}) {
  const creds = await resolveShopCredentials(clerkUserId)

  if (!creds.shopConnected) {
    return buildMockGlobalProductsCreateResponse(body)
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const cleanBody = stripUndefinedDeep(body && typeof body === "object" ? body : {})
  const bodyString = JSON.stringify(cleanBody)

  const queryForSign = {
    app_key: creds.appKey,
    shop_cipher: creds.shopCipher,
    timestamp: String(timestamp),
  }

  const sign = signTiktokShopRequest(creds.appSecret, GLOBAL_PRODUCT_CREATE_PATH, queryForSign, bodyString)
  const querySigned = { ...queryForSign, sign }

  const url = new URL(`${TIKTOK_SHOP_API_BASE}${GLOBAL_PRODUCT_CREATE_PATH}`)
  for (const [k, v] of Object.entries(querySigned)) {
    if (v != null && String(v) !== "") {
      url.searchParams.set(k, String(v))
    }
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": creds.accessToken,
    },
    body: bodyString,
  })

  const text = await response.text()
  let payload

  try {
    payload = JSON.parse(text)
  } catch {
    throw createHttpError(502, "TikTok Shop returned a non-JSON response.", {
      preview: text.slice(0, 500),
    })
  }

  if (!response.ok) {
    throw createHttpError(
      response.status,
      payload.message || `TikTok Shop request failed (HTTP ${response.status}).`,
      payload,
    )
  }

  if (payload.code !== 0) {
    throw createHttpError(502, payload.message || "TikTok Shop API returned an error.", payload)
  }

  return payload
}

/**
 * Proxies TikTok Shop Partner `GET /product/202309/products/{product_id}`.
 * Mock envelope when shop credentials are not connected.
 */
async function getTiktokGlobalProduct({ clerkUserId, productId } = {}) {
  const id = typeof productId === "string" ? productId.trim() : String(productId ?? "").trim();
  if (!id) {
    throw createHttpError(400, "product_id is required.");
  }

  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    return buildMockGlobalProductGetResponse(id);
  }

  const path = `${GLOBAL_PRODUCT_CREATE_PATH}/${encodeURIComponent(id)}`;
  const { payload } = await tiktokPartnerFetch(creds, {
    method: "GET",
    path,
    extraQuery: {
      return_under_review_version: "true",
      return_draft_version: "true",
      locale: "en",
    },
    bodyObject: undefined,
  });

  return payload;
}

/**
 * Proxies TikTok Shop Partner `PUT /product/202509/products/{product_id}`.
 * Mock success envelope when shop credentials are not connected.
 */
async function updateTiktokGlobalProduct202509({ clerkUserId, productId, body = {} } = {}) {
  const id = typeof productId === "string" ? productId.trim() : String(productId ?? "").trim();
  if (!id) {
    throw createHttpError(400, "product_id is required.");
  }

  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    return buildMockGlobalProductUpdate202509Response(id, body);
  }

  const path = `${GLOBAL_PRODUCT_UPDATE_202509_PREFIX}/${encodeURIComponent(id)}`;
  const cleanBody = stripUndefinedDeep(body && typeof body === "object" ? body : {});

  const { payload } = await tiktokPartnerFetch(creds, {
    method: "PUT",
    path,
    extraQuery: {},
    bodyObject: cleanBody,
  });

  return payload;
}

/**
 * Proxies TikTok Shop Partner `DELETE /product/202309/products` with `product_ids` body.
 * Mock success envelope when shop credentials are not connected.
 */
async function deleteTiktokGlobalProducts({ clerkUserId, productIds = [] } = {}) {
  const normalizedIds = Array.isArray(productIds)
    ? [...new Set(productIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
    : [];

  if (!normalizedIds.length) {
    throw createHttpError(400, "product_ids is required.");
  }

  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    return {
      code: 0,
      message: "Success",
      request_id: `MOCK_DELETE_${Date.now()}`,
      data: {
        errors: [],
      },
    };
  }

  const { payload } = await tiktokPartnerFetch(creds, {
    method: "DELETE",
    path: GLOBAL_PRODUCT_CREATE_PATH,
    extraQuery: {},
    bodyObject: {
      product_ids: normalizedIds,
    },
  });

  return payload;
}

async function getTiktokShopOrderDetail({ clerkUserId, orderId }) {
  const id = typeof orderId === "string" ? orderId.trim() : "";
  if (!id) {
    throw createHttpError(400, "orderId is required.");
  }

  const creds = await resolveShopCredentials(clerkUserId);

  if (!creds.shopConnected) {
    const found = findMockOrderById(id);
    return {
      configured: false,
      shopConnected: false,
      isMockData: true,
      reason: creds.reason,
      order: found,
      note: found
        ? null
        : "No matching demo order for this id. Use an id from the sample list on the Orders page.",
    };
  }

  const { payload, parsed, request_id } = await tiktokPartnerFetch(creds, {
    method: "GET",
    path: ORDER_GET_PATH,
    extraQuery: { ids: id },
    bodyObject: undefined,
  });

  const order =
    parsed.detailOrder
    || (parsed.orders?.length === 1 ? parsed.orders[0] : parsed.orders?.find((row) => row && row.id === id));

  if (!order) {
    throw createHttpError(404, "TikTok Shop did not return an order for this id.", payload.data || payload);
  }

  return {
    configured: true,
    shopConnected: true,
    isMockData: false,
    reason: null,
    order,
    requestId: request_id,
  };
}

module.exports = {
  searchTiktokShopOrders,
  searchTiktokGlobalProducts,
  createTiktokGlobalProduct,
  getTiktokGlobalProduct,
  updateTiktokGlobalProduct202509,
  deleteTiktokGlobalProducts,
  getTiktokShopOrderDetail,
  getTiktokFinanceStatements,
  getTiktokFinancePayments,
  getTiktokFinanceWithdrawals,
  getTiktokFinanceStatementTransactions,
  getTiktokFinanceUnsettledOrders,
  resolveShopCredentials,
};
