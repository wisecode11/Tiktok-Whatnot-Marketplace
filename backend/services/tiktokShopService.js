const crypto = require("crypto");

const ConnectedAccount = require("../models/ConnectedAccount");
const User = require("../models/Users");
const { buildMockOrdersSearch, findMockOrderById } = require("../data/tiktokShopOrderMocks");

const TIKTOK_SHOP_API_BASE = (process.env.TIKTOK_SHOP_API_BASE || "https://open-api.tiktokglobalshop.com").replace(
  /\/$/,
  "",
);
const ORDER_SEARCH_PATH = "/order/202309/orders/search";
/** Order detail by id (query `ids`) — same API group as Partner examples. */
const ORDER_GET_PATH = "/order/202309/orders";
const PACKAGE_SEARCH_PATH = "/fulfillment/202309/packages/search";
const SPLIT_ORDER_PATH_PREFIX = "/fulfillment/202309/orders";
/** Create fulfillment package — Partner API 202512. */
const CREATE_PACKAGE_PATH = "/fulfillment/202512/packages";
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

const MOCK_PACKAGE_SEARCH = {
  next_page_token: "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA",
  total_count: 221,
  packages: [
    {
      id: "577828281214600000",
      orders: [
        {
          id: "577828281214600000",
          skus: [
            {
              id: "577828281214883345",
              name: "white,128g",
              image_url: "https://p19-oec-sg.ibyteimg.com/tos-maliva-i-o3syd03w52-us/12345670",
              quantity: 5,
            },
          ],
        },
      ],
      create_time: 1635338186,
      update_time: 1635338186,
      status: "PROCESSING",
      tracking_number: "6617675021119438849",
      shipping_provider_name: "TT Virtual express",
      shipping_provider_id: "6617675021119438849",
      order_line_item_ids: ["1729382476852921560"],
    },
  ],
  request_id: "202203070749000101890810281E8C70B7",
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

const PACKAGE_FILTER_KEYS = new Set([
  "create_time_ge",
  "create_time_lt",
  "update_time_ge",
  "update_time_lt",
  "package_status",
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

function pickPackageFilters(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const out = {};
  for (const key of PACKAGE_FILTER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) {
      continue;
    }
    const v = raw[key];
    if (key === "package_status") {
      if (typeof v === "string" && v.trim()) {
        out[key] = v.trim().toUpperCase();
      }
      continue;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = Math.floor(v);
      continue;
    }
    if (typeof v === "string" && v.trim()) {
      const parsed = Number(v.trim());
      if (Number.isFinite(parsed)) {
        out[key] = Math.floor(parsed);
      }
    }
  }
  return out;
}

function envelopePackageSearch(payload, shopConnected, isMockData, reason) {
  const totalRaw = payload.total_count;
  return {
    configured: shopConnected,
    shopConnected,
    isMockData,
    reason,
    note: isMockData
      ? "Demo TikTok Shop package payload — connect seller credentials to load production data."
      : null,
    totalCount: typeof totalRaw === "number" ? totalRaw : Number(totalRaw) || 0,
    nextPageToken: payload.next_page_token || null,
    packages: Array.isArray(payload.packages) ? payload.packages : [],
    requestId: payload.request_id || null,
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

function buildSplitOrderPath(orderId) {
  return `${SPLIT_ORDER_PATH_PREFIX}/${encodeURIComponent(orderId)}/split`;
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

  console.log("[TikTok Shop Service] Resolved credentials:", {
    shopConnected: creds.shopConnected,
    hasAppKey: Boolean(creds.appKey),
    hasAppSecret: Boolean(creds.appSecret),
    hasShopCipher: Boolean(creds.shopCipher),
    hasAccessToken: Boolean(creds.accessToken),
    reason: creds.reason,
  });

  const bodyFilters = pickFilters(filters);
  const trimmedToken = typeof pageToken === "string" ? pageToken.trim() : "";

  if (!creds.shopConnected) {
    const mockData = buildMockOrdersSearch(bodyFilters, pageSize, trimmedToken || undefined);
    console.log("[TikTok Shop Service] Using mock data (credentials not available)");
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

  console.log("[TikTok Shop Service] Making request to TikTok API:", {
    url: url.toString().replace(/sign=[^&]*/g, "sign=***"),
    method: "POST",
    bodyFilters,
  });

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
    console.error("[TikTok Shop Service] Failed to parse API response:", {
      status: response.status,
      preview: text.slice(0, 500),
    });
    throw createHttpError(502, "TikTok Shop returned a non-JSON response.", {
      preview: text.slice(0, 500),
    });
  }

  console.log("[TikTok Shop Service] API Response received:", {
    status: response.status,
    code: payload.code,
    message: payload.message,
    requestId: payload.request_id,
    dataKeys: payload.data ? Object.keys(payload.data) : [],
    ordersCount: Array.isArray(payload.data?.orders) ? payload.data.orders.length : 0,
  });

  console.log("[TikTok Shop Service] Full API Response:", JSON.stringify(payload, null, 2));

  if (!response.ok) {
    console.error("[TikTok Shop Service] API request failed:", {
      status: response.status,
      message: payload.message,
    });
    throw createHttpError(
      response.status,
      payload.message || `TikTok Shop request failed (HTTP ${response.status}).`,
      payload,
    );
  }

  if (payload.code !== 0) {
    console.error("[TikTok Shop Service] API returned error code:", {
      code: payload.code,
      message: payload.message,
    });
    throw createHttpError(502, payload.message || "TikTok Shop API returned an error.", payload);
  }

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const totalRaw = data.total_count;

  const result = envelopeSearch(
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

  console.log("[TikTok Shop Service] Search completed successfully:", {
    totalCount: result.total_count,
    ordersReturned: result.orders.length,
    shopConnected: result.shopConnected,
  });

  return result;
}

async function searchTiktokShopPackages({
  clerkUserId,
  filters = {},
  pageSize = 20,
  pageToken,
  sortOrder = "DESC",
  sortField = "create_time",
} = {}) {
  const creds = await resolveShopCredentials(clerkUserId);
  const bodyFilters = pickPackageFilters(filters);
  const size = Number(pageSize);
  const safeSize = Math.min(Math.max(Number.isFinite(size) ? size : 20, 1), 50);
  const trimmedToken = typeof pageToken === "string" ? pageToken.trim() : "";

  if (!creds.shopConnected) {
    return envelopePackageSearch(MOCK_PACKAGE_SEARCH, false, true, creds.reason);
  }

  const extraQuery = {
    page_size: String(safeSize),
    sort_order: sortOrder === "ASC" ? "ASC" : "DESC",
    sort_field: typeof sortField === "string" && sortField.trim() ? sortField.trim() : "create_time",
  };

  if (trimmedToken) {
    extraQuery.page_token = trimmedToken;
  }

  const { payload } = await tiktokPartnerFetch(creds, {
    method: "POST",
    path: PACKAGE_SEARCH_PATH,
    extraQuery,
    bodyObject: bodyFilters,
  });

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};

  return envelopePackageSearch(
    {
      total_count: data.total_count,
      next_page_token: data.next_page_token,
      packages: Array.isArray(data.packages) ? data.packages : [],
      request_id: payload.request_id || null,
    },
    true,
    false,
    null,
  );
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

/**
 * Create a fulfillment package via TikTok Shop Partner API (202512).
 * Falls back to mock data when credentials are not configured.
 */
async function createTiktokPackage({
  clerkUserId,
  shipType,
  orderId,
  orderLineItems = [],
  orderListIds = [],
  dimension,
  shippingServiceId,
  weight,
}) {
  const creds = await resolveShopCredentials(clerkUserId);

  console.log("[TikTok Shop Service] createTiktokPackage - credentials:", {
    shopConnected: creds.shopConnected,
    reason: creds.reason,
  });

  const bodyObject = {
    ship_type: String(shipType || "1"),
  };

  if (orderId) {
    bodyObject.order_id = String(orderId);
  }

  if (Array.isArray(orderLineItems) && orderLineItems.length > 0) {
    bodyObject.order_line_item = orderLineItems;
  }

  if (Array.isArray(orderListIds) && orderListIds.length > 0) {
    bodyObject.order_list_ids = orderListIds;
  }

  if (dimension && typeof dimension === "object") {
    bodyObject.dimension = {
      length: String(dimension.length || "0"),
      width: String(dimension.width || "0"),
      height: String(dimension.height || "0"),
      unit: String(dimension.unit || "CM"),
    };
  }

  if (shippingServiceId) {
    bodyObject.shipping_service_id = String(shippingServiceId);
  }

  if (weight && typeof weight === "object") {
    bodyObject.weight = {
      value: String(weight.value || "0"),
      unit: String(weight.unit || "GRAM"),
    };
  }

  console.log("[TikTok Shop Service] createTiktokPackage - request body:", JSON.stringify(bodyObject, null, 2));

  // Return mock data if credentials not configured
  if (!creds.shopConnected) {
    const mockPackageId = `PKG-MOCK-${Date.now()}`;
    const mockResponse = {
      shopConnected: false,
      isMockData: true,
      reason: creds.reason,
      requestBody: bodyObject,
      package_id: mockPackageId,
      dimension: bodyObject.dimension || { length: "1.2", width: "0.2", height: "0.03", unit: "CM" },
      weight: bodyObject.weight || { value: "1.2", unit: "GRAM" },
      shipping_service_info: {
        id: shippingServiceId || "288233559123860015",
        name: "Standard Shipping",
        price: "10",
        currency: "USD",
        earliest_delivery_days: 3,
        latest_delivery_days: 7,
        shipping_provider_id: "2882322591238",
        shipping_provider_name: "TT Virtual Express",
      },
      create_time: Math.floor(Date.now() / 1000),
    };

    console.log("[TikTok Shop Service] createTiktokPackage - mock response:", JSON.stringify(mockResponse, null, 2));
    return mockResponse;
  }

  const { parsed, request_id } = await tiktokPartnerFetch(creds, {
    method: "POST",
    path: CREATE_PACKAGE_PATH,
    bodyObject,
  });

  console.log("[TikTok Shop Service] createTiktokPackage - API response:", JSON.stringify(parsed, null, 2));

  const data = parsed && typeof parsed === "object" ? parsed : {};

  return {
    shopConnected: true,
    isMockData: false,
    reason: null,
    requestBody: bodyObject,
    requestId: request_id,
    package_id: data.package_id || null,
    dimension: data.dimension || bodyObject.dimension || null,
    weight: data.weight || bodyObject.weight || null,
    shipping_service_info: data.shipping_service_info || null,
    create_time: data.create_time || Math.floor(Date.now() / 1000),
  };
}

async function splitTiktokShopOrder({
  clerkUserId,
  orderId,
  splittableGroups = [],
  splittableGroupsV2 = [],
}) {
  const id = typeof orderId === "string" ? orderId.trim() : "";
  if (!id) {
    throw createHttpError(400, "orderId is required.");
  }

  const creds = await resolveShopCredentials(clerkUserId);

  const bodyObject = {
    splittable_groups: Array.isArray(splittableGroups) ? splittableGroups : [],
    splittable_groups_v2: Array.isArray(splittableGroupsV2) ? splittableGroupsV2 : [],
  };

  if (!creds.shopConnected) {
    const firstGroup = bodyObject.splittable_groups[0] || bodyObject.splittable_groups_v2[0] || {};
    return {
      shopConnected: false,
      isMockData: true,
      reason: creds.reason,
      orderId: id,
      requestBody: bodyObject,
      packages: [
        {
          splittable_group_id: firstGroup.id || "123",
          id: `223362377512830${String(Date.now()).slice(-3)}`,
        },
      ],
      requestId: "202203070749000101890810281E8C70B7",
    };
  }

  const { payload, request_id } = await tiktokPartnerFetch(creds, {
    method: "POST",
    path: buildSplitOrderPath(id),
    bodyObject,
  });

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};

  return {
    shopConnected: true,
    isMockData: false,
    reason: null,
    orderId: id,
    requestBody: bodyObject,
    packages: Array.isArray(data.packages) ? data.packages : [],
    requestId: request_id,
  };
}

async function shipTiktokPackage({ clerkUserId, packageId, handoverMethod, pickupSlot, selfShipment }) {
  const id = typeof packageId === "string" ? packageId.trim() : "";
  if (!id) {
    throw createHttpError(400, "packageId is required.");
  }

  const creds = await resolveShopCredentials(clerkUserId);
  const path = `/fulfillment/202309/packages/${encodeURIComponent(id)}/ship`;

  const bodyObject = {};
  if (handoverMethod) bodyObject.handover_method = handoverMethod;
  if (pickupSlot && typeof pickupSlot === "object") bodyObject.pickup_slot = pickupSlot;
  if (selfShipment && typeof selfShipment === "object") bodyObject.self_shipment = selfShipment;

  if (!creds.shopConnected) {
    return {
      shopConnected: false,
      isMockData: true,
      reason: creds.reason,
      packageId: id,
      requestBody: bodyObject,
      code: 0,
      message: "Success",
      data: {},
      requestId: "202203070749000101890810281E8C70B7",
    };
  }

  const { payload, request_id } = await tiktokPartnerFetch(creds, {
    method: "POST",
    path,
    bodyObject,
  });

  return {
    shopConnected: true,
    isMockData: false,
    reason: null,
    packageId: id,
    requestBody: bodyObject,
    code: payload.code,
    message: payload.message,
    data: payload.data || {},
    requestId: request_id,
  };
}

module.exports = {
  searchTiktokShopOrders,
  searchTiktokShopPackages,
  splitTiktokShopOrder,
  shipTiktokPackage,
  getTiktokShopOrderDetail,
  createTiktokPackage,
  getTiktokFinanceStatements,
  getTiktokFinancePayments,
  getTiktokFinanceWithdrawals,
  getTiktokFinanceStatementTransactions,
  getTiktokFinanceUnsettledOrders,
  resolveShopCredentials,
};
