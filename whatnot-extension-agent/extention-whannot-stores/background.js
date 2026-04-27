const state = {
  connected: false,
  tabId: null,
  auth: null,
  lastObservedApi: null,
  observedGraphqlTemplates: {},
  backendSocketUrl: null
};

let ws = null;
const MARKETPLACE_API_BASE = "http://localhost:5001";
const WHATNOT_EXTENSION_API_KEY = "";
const BACKEND_SOCKET_URL = "ws://localhost:5001/ws/whatnot-extension";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    wn_state: state
  });
  setBackendSocket(BACKEND_SOCKET_URL);
});

chrome.runtime.onStartup.addListener(() => {
  setBackendSocket(BACKEND_SOCKET_URL);
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleMessage(request)
    .then(sendResponse)
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true;
});

async function handleMessage(request) {
  switch (request.action) {
    case "connect_whatnot":
      return connectWhatnot(request.tabId);
    case "execute_api":
      return executeApi(request.tabId, request.options);
    case "get_status":
      return {
        connected: state.connected,
        auth: state.auth,
        lastObservedApi: state.lastObservedApi,
        observedGraphqlTemplates: state.observedGraphqlTemplates
      };
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

async function connectWhatnot(tabId) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setBackendSocket(BACKEND_SOCKET_URL);
  }

  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !tab.url.includes("whatnot.com")) {
    return { success: false, error: "Active tab must be whatnot.com" };
  }

  const sessionResult = await chrome.tabs.sendMessage(tabId, { action: "read_session_tokens" });
  if (!sessionResult?.success) {
    return { success: false, error: sessionResult?.error || "Unable to read session endpoint" };
  }

  const [cookies, accessToken] = await Promise.all([
    readCookieState(),
    readCookieValue("__Secure-access-token")
  ]);
  state.connected = true;
  state.tabId = tabId;
  state.auth = {
    csrf_token: sessionResult.data?.csrf_token || null,
    session_extension_token: sessionResult.data?.session_extension_token || null,
    access_token: accessToken || null,
    cookie_state: cookies
  };
  await chrome.storage.local.set({ wn_state: state });
  sendSocketMessage("auth", { auth: state.auth, tabId });
  await saveSellerSessionToMarketplace({
    auth: state.auth,
    sessionData: sessionResult.data || {},
    tabId
  });

  return { success: true, auth: state.auth };
}

async function saveSellerSessionToMarketplace({ auth, sessionData, tabId }) {
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
  const targetTabId = tabId || state.tabId;
  if (!targetTabId) {
    return { success: false, error: "No connected Whatnot tab" };
  }

  const result = await chrome.tabs.sendMessage(targetTabId, {
    action: "run_whatnot_api",
    options
  });

  if (isAuthFailure(result)) {
    const refreshed = await connectWhatnot(targetTabId);
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

async function executeUpdateBioFromPlatform(payload) {
  const bio = String(payload?.bio || "").trim();
  if (!bio) {
    return { success: false, error: "Bio is required." };
  }

  if (!state.tabId) {
    return { success: false, error: "No connected Whatnot tab. Connect extension first." };
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
  await chrome.storage.local.set({ wn_state: state });
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

  ws.onopen = () => sendSocketMessage("auth", { status: "extension_online" });
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
        await chrome.storage.local.set({ wn_state: state });
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
