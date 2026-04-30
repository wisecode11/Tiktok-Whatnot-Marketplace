const state = {
  connected: false,
  tabId: null,
  clerkUserId: null,
  auth: null,
  lastObservedApi: null,
  observedGraphqlTemplates: {},
  backendSocketUrl: null
};

let ws = null;
let stateHydrated = false;
const MARKETPLACE_API_BASE = "http://localhost:5000";
const WHATNOT_EXTENSION_API_KEY = "";
const BACKEND_SOCKET_URL = "ws://localhost:5000/ws/whatnot-extension";
const SELLER_HUB_INVENTORY_QUERY =
  "query SellerHubInventory($first:Int,$after:String,$query:String,$statuses:[ListingStatus],$filters:[FilterInput],$sort:SortInput,$transactionTypes:[ListingTransactionType]){me{id email inventory(first:$first,after:$after,query:$query,statuses:$statuses,filters:$filters,sort:$sort,transactionTypes:$transactionTypes){edges{node{id uuid title subtitle description status publicStatus quantity transactionType price{amount currency amountSafe __typename} transactionProps{isOfferable __typename} product{id category{id label __typename} __typename} images{id url __typename} __typename} __typename} pageInfo{hasPreviousPage hasNextPage startCursor endCursor __typename} totalCount groupedBy __typename} __typename}}";

chrome.runtime.onInstalled.addListener(() => {
  state.backendSocketUrl = BACKEND_SOCKET_URL;
  stateHydrated = true;
  void persistState();
  void setBackendSocket(BACKEND_SOCKET_URL);
});

chrome.runtime.onStartup.addListener(() => {
  void ensureStateHydrated();
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleMessage(request)
    .then(sendResponse)
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true;
});

async function handleMessage(request) {
  await ensureStateHydrated();

  switch (request.action) {
    case "connect_whatnot":
      return connectWhatnot(request.tabId, request.clerkUserId);
    case "execute_api":
      return executeApi(request.tabId, request.options);
    case "get_status":
      return {
        connected: state.connected,
        clerkUserId: state.clerkUserId,
        auth: state.auth,
        lastObservedApi: state.lastObservedApi,
        observedGraphqlTemplates: state.observedGraphqlTemplates
      };
    case "set_clerk_user":
      state.clerkUserId = normalizeClerkUserId(request.clerkUserId);
      await persistState();
      return { success: true, clerkUserId: state.clerkUserId };
    case "observed_api":
      return onObservedApi(request.payload);
    case "platform_action_request":
      return handlePlatformAction(request.payload);
    case "set_backend_socket":
      return setBackendSocket(request.url);
    case "save_get_session_api_data":
      return saveGetSessionApiDataToMarketplace(request.payload);
    default:
      return { success: false, error: "Unknown action" };
  }
}

async function connectWhatnot(tabId, clerkUserId = null) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setBackendSocket(BACKEND_SOCKET_URL);
  }

  if (typeof clerkUserId === "string") {
    state.clerkUserId = normalizeClerkUserId(clerkUserId);
  }

  if (!state.clerkUserId) {
    return { success: false, error: "Missing Clerk user ID. Add user ID in extension popup first." };
  }

  const resolvedTabId = await resolveWhatnotTabId(tabId);
  if (!resolvedTabId) {
    return { success: false, error: "Unable to find or open a Whatnot tab." };
  }

  const tab = await chrome.tabs.get(resolvedTabId);
  if (!tab.url || !tab.url.includes("whatnot.com")) {
    return { success: false, error: "Active tab must be whatnot.com" };
  }

  const sessionResult = await chrome.tabs.sendMessage(resolvedTabId, { action: "read_session_tokens" });
  if (!sessionResult?.success) {
    return { success: false, error: sessionResult?.error || "Unable to read session endpoint" };
  }

  const [cookies, accessToken] = await Promise.all([
    readCookieState(),
    readCookieValue("__Secure-access-token")
  ]);
  state.connected = true;
  state.tabId = resolvedTabId;
  state.auth = {
    csrf_token: sessionResult.data?.csrf_token || null,
    session_extension_token: sessionResult.data?.session_extension_token || null,
    access_token: accessToken || null,
    cookie_state: cookies
  };
  await persistState();
  sendSocketMessage("auth", {
    auth: state.auth,
    tabId: resolvedTabId,
    clerkUserId: state.clerkUserId
  });
  await saveSellerSessionToMarketplace({
    clerkUserId: state.clerkUserId,
    auth: state.auth,
    sessionData: sessionResult.data || {},
    tabId: resolvedTabId
  });

  return { success: true, auth: state.auth, tabId: resolvedTabId };
}

async function saveSellerSessionToMarketplace({ clerkUserId, auth, sessionData, tabId }) {
  const headers = {
    "content-type": "application/json"
  };
  if (WHATNOT_EXTENSION_API_KEY) {
    headers["x-whatnot-extension-key"] = WHATNOT_EXTENSION_API_KEY;
  }

  try {
    await fetch(`${MARKETPLACE_API_BASE}/api/integrations/whatnot/seller-sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "whatnot-extension",
        clerkUserId: normalizeClerkUserId(clerkUserId),
        tabId,
        auth,
        sessionData
      })
    });
  } catch (_e) {
    // Keep extension flow unchanged if backend is temporarily unavailable.
  }
}

async function saveGetSessionApiDataToMarketplace(payload) {
  const headers = {
    "content-type": "application/json"
  };
  if (WHATNOT_EXTENSION_API_KEY) {
    headers["x-whatnot-extension-key"] = WHATNOT_EXTENSION_API_KEY;
  }

  try {
    await fetch(`${MARKETPLACE_API_BASE}/api/integrations/whatnot/get-session-api-data`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "whatnot-extension",
        tabId: payload?.tabId ?? state.tabId ?? null,
        responsePayload: payload?.responsePayload || {}
      })
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeApi(tabId, options) {
  let targetTabId = tabId || state.tabId;
  if (!targetTabId) {
    const connected = await ensureConnectedWhatnotSession();
    if (!connected.success) {
      return { success: false, error: connected.error || "No connected Whatnot tab." };
    }
    targetTabId = connected.tabId;
  }

  let result = null;
  try {
    result = await chrome.tabs.sendMessage(targetTabId, {
      action: "run_whatnot_api",
      options
    });
  } catch (_error) {
    const connected = await ensureConnectedWhatnotSession(targetTabId);
    if (!connected.success) {
      return { success: false, error: connected.error || "Unable to reconnect Whatnot tab." };
    }
    targetTabId = connected.tabId;
    result = await chrome.tabs.sendMessage(targetTabId, {
      action: "run_whatnot_api",
      options
    });
  }

  if (isAuthFailure(result)) {
    const refreshed = await ensureConnectedWhatnotSession(targetTabId);
    if (!refreshed.success) {
      sendSocketMessage("relogin_required", { reason: "auth_refresh_failed" });
      return { success: false, error: "Auth refresh failed, relogin needed." };
    }
    const retry = await chrome.tabs.sendMessage(targetTabId, {
      action: "run_whatnot_api",
      options
    });
    if (isAuthFailure(retry)) {
      sendSocketMessage("relogin_required", { reason: "retry_failed" });
      return { success: false, error: "Auth failed after one retry, relogin required." };
    }
    return retry;
  }

  return result;
}

async function handlePlatformAction(payload) {
  let result = null;
  if (payload?.action === "update_bio_from_platform") {
    result = await executeUpdateBioFromPlatform(payload);
  } else if (payload?.action === "fetch_seller_hub_inventory") {
    result = await executeSellerHubInventoryFromPlatform(payload);
  } else {
    result = await executeApi(state.tabId, payload);
  }
  sendSocketMessage("action_response", {
    requestId: payload?.requestId || null,
    status: result.success ? "success" : "error",
    operationName: getOperationName(payload),
    response: result,
    timestamp: Date.now()
  });
  return result;
}

async function executeSellerHubInventoryFromPlatform(payload) {
  const requestedStatus = String(payload?.status || "ACTIVE").trim().toUpperCase();
  const allowedStatuses = new Set(["ACTIVE", "DRAFT", "INACTIVE", "SOLD_OUT"]);
  if (!allowedStatuses.has(requestedStatus)) {
    return { success: false, error: "Invalid inventory status." };
  }

  if (!state.tabId || !state.auth?.csrf_token) {
    const autoConnected = await ensureConnectedWhatnotSession(state.tabId);
    if (!autoConnected.success) {
      return { success: false, error: autoConnected.error || "No connected Whatnot tab." };
    }
  }

  const csrfToken = String(state?.auth?.csrf_token || "").trim();
  if (!csrfToken || csrfToken === "-") {
    return { success: false, error: "CSRF token missing. Reconnect Whatnot first." };
  }

  const defaultPayload = {
    after: null,
    filters: [],
    first: null,
    groupBy: null,
    query: null,
    sellerId: null,
    sort: null,
    statuses: [requestedStatus],
    transactionTypes: null
  };
  const requestPayload = {
    ...defaultPayload,
    ...(payload?.requestPayload && typeof payload.requestPayload === "object" ? payload.requestPayload : {}),
    statuses: [requestedStatus]
  };

  const template = state?.observedGraphqlTemplates?.SellerHubInventory;
  let requestBody = {
    operationName: "SellerHubInventory",
    query: SELLER_HUB_INVENTORY_QUERY,
    variables: requestPayload
  };
  if (template?.requestBody && typeof template.requestBody === "object") {
    requestBody = structuredClone(template.requestBody);
    requestBody.operationName = "SellerHubInventory";
    if (!requestBody.variables || typeof requestBody.variables !== "object") {
      requestBody.variables = {};
    }
    requestBody.variables = {
      ...requestBody.variables,
      ...requestPayload,
      statuses: [requestedStatus]
    };
  }

  const defaultHeaders = {
    "content-type": "application/json",
    "x-whatnot-app": "whatnot-web",
    "x-csrf-token": csrfToken,
    "x-wn-extension": "1"
  };
  const accessToken = String(state?.auth?.access_token || "").trim();
  if (accessToken) {
    defaultHeaders.authorization = `Bearer ${accessToken}`;
  }
  const templateHeaders = filterAllowedHeaders(template?.requestHeaders || {});

  return executeApi(state.tabId, {
    url: "https://www.whatnot.com/services/graphql/?operationName=SellerHubInventory&ssr=0",
    method: "POST",
    headers: { ...templateHeaders, ...defaultHeaders },
    body: JSON.stringify(requestBody)
  });
}

async function executeUpdateBioFromPlatform(payload) {
  const bio = String(payload?.bio || "").trim();
  if (!bio) {
    return { success: false, error: "Bio is required." };
  }

  if (!state.tabId || !state.auth?.csrf_token) {
    const autoConnected = await ensureConnectedWhatnotSession(state.tabId);
    if (!autoConnected.success) {
      return {
        success: false,
        error: autoConnected.error || "No connected Whatnot tab. Connect extension first."
      };
    }
  }

  const csrfToken = String(state?.auth?.csrf_token || "").trim();
  if (!csrfToken || csrfToken === "-") {
    return { success: false, error: "CSRF token missing. Reconnect Whatnot first." };
  }

  const template = getUpdateProfileTemplate(state?.observedGraphqlTemplates || {});
  let requestPayload = {
    operationName: "UpdateProfileMutation",
    variables: { bio },
    query: "mutation UpdateProfileMutation($bio: String!){updateProfile(bio:$bio){__typename}}"
  };
  if (template?.requestBody && typeof template.requestBody === "object") {
    requestPayload = structuredClone(template.requestBody);
    requestPayload.operationName = requestPayload.operationName || "UpdateProfileMutation";
    injectBioIntoPayload(requestPayload, bio);
  }

  const defaultHeaders = {
    "content-type": "application/json",
    "x-whatnot-app": "whatnot-web",
    "x-csrf-token": csrfToken,
    "x-wn-extension": "1"
  };
  const accessToken = String(state?.auth?.access_token || "").trim();
  if (accessToken) {
    defaultHeaders.authorization = `Bearer ${accessToken}`;
  }
  const templateHeaders = filterAllowedHeaders(template?.requestHeaders || {});
  const headers = { ...templateHeaders, ...defaultHeaders };

  return executeApi(state.tabId, {
    url: "https://www.whatnot.com/services/graphql/?operationName=UpdateProfileMutation&ssr=0",
    method: "POST",
    headers,
    body: JSON.stringify(requestPayload)
  });
}

function getOperationName(payload) {
  try {
    const body = typeof payload?.body === "string" ? JSON.parse(payload.body) : payload?.body;
    return body?.operationName || "unknown";
  } catch (_e) {
    return "unknown";
  }
}

function isAuthFailure(result) {
  if (!result) return true;
  if (result.status === 401 || result.status === 403) return true;
  const errors = result.data?.errors;
  if (!errors) return false;
  return JSON.stringify(errors).toLowerCase().includes("auth");
}

async function readCookieState() {
  const required = [
    "__Secure-access-token",
    "__Secure-access-token-expiration",
    "__Secure-refresh-token"
  ];
  const all = await chrome.cookies.getAll({ domain: ".whatnot.com" });
  const names = new Set(all.map((c) => c.name));
  return Object.fromEntries(required.map((name) => [name, names.has(name)]));
}

async function readCookieValue(name) {
  if (!name) return null;
  const cookie = await chrome.cookies.get({
    url: "https://www.whatnot.com",
    name
  });
  return cookie?.value || null;
}

async function onObservedApi(payload) {
  state.lastObservedApi = payload;
  captureGraphqlTemplate(payload);
  await persistState();
  sendSocketMessage("action_response", {
    status: payload.status >= 200 && payload.status < 300 ? "success" : "error",
    observed: true,
    payload
  });
  return { success: true };
}

function captureGraphqlTemplate(payload) {
  if (!payload?.url || !payload.url.includes("/services/graphql/")) return;
  if (payload?.requestHeaders?.["x-wn-extension"] === "1") return;

  let operationName = null;
  if (payload.requestBody && typeof payload.requestBody === "object") {
    operationName = payload.requestBody.operationName || null;
  }
  if (!operationName) {
    try {
      const parsed = new URL(payload.url);
      operationName = parsed.searchParams.get("operationName");
    } catch (_e) {}
  }
  if (!operationName) return;

  const nextTemplate = {
    capturedAt: Date.now(),
    url: payload.url,
    method: payload.method,
    requestHeaders: payload.requestHeaders || {},
    requestBody: payload.requestBody || null
  };
  const prevTemplate = state.observedGraphqlTemplates[operationName] || null;

  // Keep the richest template (usually real Whatnot UI request).
  if (!prevTemplate || scoreTemplate(nextTemplate) >= scoreTemplate(prevTemplate)) {
    state.observedGraphqlTemplates[operationName] = nextTemplate;
  }
}

function scoreTemplate(template) {
  const body = template?.requestBody || {};
  const variables = body?.variables && typeof body.variables === "object" ? body.variables : {};
  const query = typeof body?.query === "string" ? body.query : "";
  let score = 0;

  score += Object.keys(variables).length * 10;
  score += Math.min(query.length, 500) / 10;

  if (query.includes("updateProfile(")) score += 50;
  if (Object.prototype.hasOwnProperty.call(variables, "username")) score += 25;
  if (Object.prototype.hasOwnProperty.call(variables, "displayName")) score += 25;
  if (Object.prototype.hasOwnProperty.call(variables, "bio")) score += 25;

  return score;
}

function injectBioIntoPayload(payload, bio) {
  if (!payload || typeof payload !== "object") return;
  if (!payload.variables || typeof payload.variables !== "object") {
    payload.variables = {};
  }

  if (Object.prototype.hasOwnProperty.call(payload.variables, "bio")) {
    payload.variables.bio = bio;
    return;
  }
  if (payload.variables.input && typeof payload.variables.input === "object") {
    payload.variables.input.bio = bio;
    return;
  }
  payload.variables.bio = bio;
}

function filterAllowedHeaders(headers) {
  const blocked = new Set(["content-length", "host", "origin", "referer", "cookie"]);
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (!k) continue;
    const key = String(k).toLowerCase();
    if (blocked.has(key)) continue;
    out[key] = v;
  }
  return out;
}

function getUpdateProfileTemplate(templates) {
  if (!templates || typeof templates !== "object") return null;
  if (templates.UpdateProfileMutation) return templates.UpdateProfileMutation;

  const candidates = Object.entries(templates)
    .filter(([operationName, tpl]) => {
      if (!operationName || !tpl?.requestBody) return false;
      const op = String(operationName).toLowerCase();
      const body = tpl.requestBody;
      const query = typeof body.query === "string" ? body.query.toLowerCase() : "";
      return op.includes("updateprofile") || query.includes("updateprofile");
    })
    .map(([, tpl]) => tpl);

  if (!candidates.length) return null;
  candidates.sort((a, b) => scoreTemplate(b) - scoreTemplate(a));
  return candidates[0];
}

function setBackendSocket(url) {
  state.backendSocketUrl = url;
  if (ws) {
    ws.close();
    ws = null;
  }
  try {
    ws = new WebSocket(url);
  } catch (err) {
    return { success: false, error: err.message };
  }

  ws.onopen = () =>
    sendSocketMessage("auth", {
      status: "extension_online",
      clerkUserId: state.clerkUserId,
      auth: state.auth,
      tabId: state.tabId
    });
  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "heartbeat") {
        sendSocketMessage("pong", { ts: Date.now() });
        return;
      }
      if (msg.type === "force_relogin") {
        state.connected = false;
        state.auth = null;
        await persistState();
        return;
      }
      if (msg.type === "action_request") {
        await handlePlatformAction(msg.payload);
      }
    } catch (_e) {}
  };
  ws.onerror = () => {};
  ws.onclose = () => {
    if (state.backendSocketUrl === url) {
      setTimeout(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          setBackendSocket(url);
        }
      }, 3000);
    }
  };
  return { success: true };
}

function sendSocketMessage(type, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type,
      payload
    })
  );
}

function normalizeClerkUserId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

async function ensureStateHydrated() {
  if (stateHydrated) {
    return;
  }

  const stored = await chrome.storage.local.get("wn_state");
  const cachedState = stored && stored.wn_state ? stored.wn_state : null;

  if (cachedState && typeof cachedState === "object") {
    state.connected = Boolean(cachedState.connected);
    state.tabId = cachedState.tabId ?? null;
    state.clerkUserId = normalizeClerkUserId(cachedState.clerkUserId);
    state.auth = cachedState.auth || null;
    state.lastObservedApi = cachedState.lastObservedApi || null;
    state.observedGraphqlTemplates = cachedState.observedGraphqlTemplates || {};
    state.backendSocketUrl = cachedState.backendSocketUrl || BACKEND_SOCKET_URL;
  } else {
    state.backendSocketUrl = BACKEND_SOCKET_URL;
  }

  stateHydrated = true;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setBackendSocket(state.backendSocketUrl || BACKEND_SOCKET_URL);
  }
}

async function persistState() {
  await chrome.storage.local.set({ wn_state: state });
}

async function ensureConnectedWhatnotSession(preferredTabId = null) {
  const connection = await connectWhatnot(preferredTabId || state.tabId);
  if (connection.success) {
    return connection;
  }

  const fallbackTabId = await resolveWhatnotTabId(null, true);
  if (!fallbackTabId) {
    return connection;
  }

  return connectWhatnot(fallbackTabId);
}

async function resolveWhatnotTabId(preferredTabId, allowAutoCreate = true) {
  if (preferredTabId != null) {
    try {
      const preferredTab = await chrome.tabs.get(preferredTabId);
      if (preferredTab?.url && preferredTab.url.includes("whatnot.com")) {
        return preferredTabId;
      }
    } catch (_error) {
      // Ignore invalid tabs and continue with discovery.
    }
  }

  const activeWhatnotTabs = await chrome.tabs.query({ active: true, currentWindow: true, url: ["*://www.whatnot.com/*"] });
  if (activeWhatnotTabs.length) {
    return activeWhatnotTabs[0].id;
  }

  const openWhatnotTabs = await chrome.tabs.query({ url: ["*://www.whatnot.com/*"] });
  if (openWhatnotTabs.length) {
    return openWhatnotTabs[0].id;
  }

  if (!allowAutoCreate) {
    return null;
  }

  const createdTab = await chrome.tabs.create({ url: "https://www.whatnot.com/", active: true });
  if (!createdTab || !createdTab.id) {
    return null;
  }

  await waitForTabComplete(createdTab.id);
  return createdTab.id;
}

function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };

    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        finish();
      }
    };

    const timer = setTimeout(() => finish(), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}
