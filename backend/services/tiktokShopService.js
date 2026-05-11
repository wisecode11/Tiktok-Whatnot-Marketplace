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
  getTiktokShopOrderDetail,
  resolveShopCredentials,
};
