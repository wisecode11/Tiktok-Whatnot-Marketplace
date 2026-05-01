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
const SELLER_HUB_INVENTORY_EDIT_QUERY =
  "query SellerHubInventoryEdit($listingId:ID!,$includeListing:Boolean!){categories:categoryBrowse{id label type position hazmatType __typename subcategories{id label type position hazmatType __typename subcategories{id label type position hazmatType __typename}}} listing(id:$listingId) @include(if:$includeListing){id title __typename}}";
const GET_SHIPPING_PROFILES_QUERY =
  "query GetShippingProfiles($categoryId:ID){shippingProfiles(categoryId:$categoryId){...ShippingProfile __typename}}fragment ShippingProfile on ShippingProfileNode{id name weightAmount weightScale weightName length width height dimensionScale bundleConfiguration{maxWeight amount __typename} incrementalWeight{amount scale __typename} __typename}";
const GENERATE_MEDIA_UPLOAD_URLS_MUTATION =
  "mutation GenerateMediaUploadUrls($media:[GenerateMediaUploadInput!]!){generateMediaUploadURLs(media:$media){uploads{id method url headers{name value __typename} targetKey expiresAt error __typename} error __typename}}";
const ADD_LISTING_PHOTO_MUTATION =
  "mutation AddListingPhoto($uuid:String$label:String!$uploadKey:String!){addListingPhoto(uuid:$uuid label:$label uploadKey:$uploadKey){image{id url key bucket __typename}success message __typename}}";
const CREATE_LISTING_MUTATION =
  "mutation CreateListing($uuid:ID!$title:String!$description:String$transactionType:ListingTransactionType!$transactionProps:TransactionPropsInput$price:MoneyInput$catalogProductId:String$productId:ID$salesChannels:[SalesChannelInfoInput]$productAttributeValues:[ProductAttributeValueInput]$quantity:Int$images:[ListingImageInput]$listIndividually:Boolean$categoryId:ID$shippingProfileId:ID$weight:WeightInput$hazmatType:HazmatLabelType$isPartialSave:Boolean$reservedForSalesChannel:ReservedForSalesChannelType$sku:String$costPerItem:MoneyInput$barcode:String$variants:[ListingVariantInput!]$timedListingEvent:TimedListingEventInput$metadata:ListingMetadata$videoIds:[ID!]$isQuickAdd:Boolean){createListing(uuid:$uuid title:$title description:$description transactionType:$transactionType transactionProps:$transactionProps price:$price catalogProductId:$catalogProductId productId:$productId salesChannels:$salesChannels productAttributeValues:$productAttributeValues quantity:$quantity images:$images listIndividually:$listIndividually categoryId:$categoryId shippingProfileId:$shippingProfileId weight:$weight hazmatType:$hazmatType isPartialSave:$isPartialSave reservedForSalesChannel:$reservedForSalesChannel sku:$sku costPerItem:$costPerItem barcode:$barcode variants:$variants timedListingEvent:$timedListingEvent metadata:$metadata videoIds:$videoIds isQuickAdd:$isQuickAdd){listingNode{...CreateListing __typename}error __typename}}fragment CreateListing on ListingNode{id uuid publicStatus status title product{id __typename}__typename}";

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
    case "fetch_whatnot_orders":
      return fetchWhatnotOrders(request.tabId);
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
  // As soon as connect is successful and tokens are available,
  // fetch inventory edit catalog and persist categories in backend.
  void syncSellerHubInventoryEditCatalog(resolvedTabId);

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

async function saveInventoryEditCategoriesToMarketplace(payload) {
  const headers = {
    "content-type": "application/json"
  };
  if (WHATNOT_EXTENSION_API_KEY) {
    headers["x-whatnot-extension-key"] = WHATNOT_EXTENSION_API_KEY;
  }

  try {
    await fetch(`${MARKETPLACE_API_BASE}/api/integrations/whatnot/inventory-edit-categories`, {
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

async function saveShippingProfilesToMarketplace(payload) {
  const headers = {
    "content-type": "application/json"
  };
  if (WHATNOT_EXTENSION_API_KEY) {
    headers["x-whatnot-extension-key"] = WHATNOT_EXTENSION_API_KEY;
  }

  try {
    await fetch(`${MARKETPLACE_API_BASE}/api/integrations/whatnot/shipping-profiles`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "whatnot-extension",
        tabId: payload?.tabId ?? state.tabId ?? null,
        categoryId: payload?.categoryId ?? null,
        responsePayload: payload?.responsePayload || {}
      })
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function fetchSellerHubInventoryEditData(tabId) {
  const csrfToken = String(state?.auth?.csrf_token || "").trim();
  if (!csrfToken || csrfToken === "-") {
    return { success: false, error: "CSRF token missing. Reconnect Whatnot first." };
  }

  const headers = {
    "content-type": "application/json",
    "x-whatnot-app": "whatnot-web",
    "x-csrf-token": csrfToken,
    "x-wn-extension": "1"
  };
  const accessToken = String(state?.auth?.access_token || "").trim();
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const template = state?.observedGraphqlTemplates?.SellerHubInventoryEdit;
  let requestBody = {
    operationName: "SellerHubInventoryEdit",
    query: SELLER_HUB_INVENTORY_EDIT_QUERY,
    variables: {
      includeListing: false,
      listingId: "new"
    }
  };
  if (template?.requestBody && typeof template.requestBody === "object") {
    requestBody = structuredClone(template.requestBody);
    requestBody.operationName = "SellerHubInventoryEdit";
    if (!requestBody.variables || typeof requestBody.variables !== "object") {
      requestBody.variables = {};
    }
    requestBody.variables = {
      ...requestBody.variables,
      includeListing: false,
      listingId: "new"
    };
  }

  return executeApi(tabId, {
    url: "https://www.whatnot.com/services/graphql/?operationName=SellerHubInventoryEdit&ssr=0",
    method: "POST",
    headers,
    body: JSON.stringify(requestBody)
  });
}

async function fetchShippingProfilesData(tabId) {
  const csrfToken = String(state?.auth?.csrf_token || "").trim();
  if (!csrfToken || csrfToken === "-") {
    return { success: false, error: "CSRF token missing. Reconnect Whatnot first." };
  }

  const headers = {
    "content-type": "application/json",
    "x-whatnot-app": "whatnot-web",
    "x-csrf-token": csrfToken,
    "x-wn-extension": "1"
  };
  const accessToken = String(state?.auth?.access_token || "").trim();
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const template = state?.observedGraphqlTemplates?.GetShippingProfiles;
  let requestBody = {
    operationName: "GetShippingProfiles",
    query: GET_SHIPPING_PROFILES_QUERY,
    variables: {
      categoryId: null
    }
  };
  if (template?.requestBody && typeof template.requestBody === "object") {
    requestBody = structuredClone(template.requestBody);
    requestBody.operationName = "GetShippingProfiles";
    if (!requestBody.variables || typeof requestBody.variables !== "object") {
      requestBody.variables = {};
    }
    requestBody.variables = {
      ...requestBody.variables,
      categoryId: null
    };
  }

  return executeApi(tabId, {
    url: "https://www.whatnot.com/services/graphql/?operationName=GetShippingProfiles&ssr=0",
    method: "POST",
    headers,
    body: JSON.stringify(requestBody)
  });
}

async function syncSellerHubInventoryEditCatalog(tabId) {
  try {
    const response = await fetchSellerHubInventoryEditData(tabId);
    if (!response?.success || !response?.data) {
      return { success: false, error: response?.error || "Failed to fetch SellerHubInventoryEdit data." };
    }
    await saveInventoryEditCategoriesToMarketplace({
      tabId,
      responsePayload: response.data
    });

    // Recommended flow: call shipping profiles right after categories/subcategories.
    const shippingResponse = await fetchShippingProfilesData(tabId);
    if (shippingResponse?.success && shippingResponse?.data) {
      await saveShippingProfilesToMarketplace({
        tabId,
        categoryId: null,
        responsePayload: shippingResponse.data
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function extractApolloSSRData(htmlString) {
  const html = typeof htmlString === "string" ? htmlString : "";
  if (!html) {
    return {
      orders: [],
      debug: {
        htmlLength: 0,
        scriptMatches: 0,
        parsedEntries: 0,
      }
    };
  }

  const scriptTagRegex = /<script[^>]*>\s*\(window\[Symbol\.for\("ApolloSSRDataTransport"\)\]\s*\?\?=\s*\[\]\)\.push\(([\s\S]*?)\)\s*<\/script>/g;
  let match;
  const apolloEntries = [];
  let scriptMatches = 0;

  while ((match = scriptTagRegex.exec(html)) !== null) {
    scriptMatches += 1;
    const chunk = String(match[1] || "").trim();
    if (!chunk) {
      continue;
    }

    try {
      const parsed = JSON.parse(chunk);
      apolloEntries.push(parsed);
      continue;
    } catch (_error) {
      // Try JS object literal parser as fallback.
    }

    try {
      const parsed = new Function(`return (${chunk});`)();
      if (parsed && typeof parsed === "object") {
        apolloEntries.push(parsed);
      }
    } catch (_error) {
      // Ignore malformed script chunks and continue parsing.
    }
  }

  const orders = [];
  const seenOrderIds = new Set();

  function maybePushOrder(node) {
    if (!node || typeof node !== "object") {
      return;
    }
    const id = node.id || node.orderId || node.uuid || JSON.stringify(node);
    if (seenOrderIds.has(id)) {
      return;
    }
    seenOrderIds.add(id);
    orders.push(node);
  }

  // Exact extractor requested by user:
  // payload.me.orders.edges[].node
  function extractFromMeOrdersPath(value) {
    const edges = value?.me?.orders?.edges;
    if (!Array.isArray(edges)) {
      return;
    }
    for (const edge of edges) {
      if (edge && edge.node && typeof edge.node === "object") {
        maybePushOrder(edge.node);
      }
    }
  }

  function visit(value) {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    extractFromMeOrdersPath(value);

    const directEdges = value?.me?.orders?.edges;
    if (Array.isArray(directEdges)) {
      for (const edge of directEdges) {
        if (edge && edge.node) {
          maybePushOrder(edge.node);
        }
      }
    }

    const nestedDataEdges = value?.data?.me?.orders?.edges;
    if (Array.isArray(nestedDataEdges)) {
      for (const edge of nestedDataEdges) {
        if (edge && edge.node) {
          maybePushOrder(edge.node);
        }
      }
    }

    for (const nested of Object.values(value)) {
      visit(nested);
    }
  }

  for (const entry of apolloEntries) {
    visit(entry);
    if (entry && typeof entry === "object" && entry.rehydrate) {
      visit(entry.rehydrate);
    }
  }

  return {
    orders,
    debug: {
      htmlLength: html.length,
      scriptMatches,
      parsedEntries: apolloEntries.length,
    }
  };
}

async function sendOrdersToMarketplace(orders, tabId) {
  const headers = {
    "content-type": "application/json"
  };
  if (WHATNOT_EXTENSION_API_KEY) {
    headers["x-whatnot-extension-key"] = WHATNOT_EXTENSION_API_KEY;
  }

  const response = await fetch(`${MARKETPLACE_API_BASE}/api/integrations/whatnot/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: "whatnot-extension",
      clerkUserId: state.clerkUserId,
      tabId: tabId ?? state.tabId ?? null,
      orders: Array.isArray(orders) ? orders : []
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Failed to save orders to marketplace.");
  }
}

async function fetchWhatnotOrders(tabId) {
  let targetTabId = tabId || state.tabId;
  if (!targetTabId || !state.connected || !state.auth) {
    const connected = await ensureConnectedWhatnotSession(targetTabId);
    if (!connected.success) {
      return { success: false, error: connected.error || "Not connected to Whatnot." };
    }
    targetTabId = connected.tabId;
  }

  const response = await executeApi(targetTabId, {
    url: "https://www.whatnot.com/en-GB/dashboard/orders",
    method: "GET"
  });

  if (!response?.success || typeof response?.data !== "string") {
    return {
      success: false,
      error: response?.error || "Failed to fetch Whatnot orders page."
    };
  }

  const ssrExtract = extractApolloSSRData(response.data);
  let orders = Array.isArray(ssrExtract?.orders) ? ssrExtract.orders : [];
  let fallbackUsed = false;
  let fallbackCount = 0;
  if (!orders.length) {
    const graphqlFallbackOrders = await fetchOrdersFromCapturedGraphqlTemplate(targetTabId);
    if (graphqlFallbackOrders.length) {
      orders = graphqlFallbackOrders;
      fallbackUsed = true;
      fallbackCount = graphqlFallbackOrders.length;
    }
  }

  console.log("[Whatnot Orders Debug]", {
    htmlLength: ssrExtract?.debug?.htmlLength || 0,
    apolloScriptMatches: ssrExtract?.debug?.scriptMatches || 0,
    apolloParsedEntries: ssrExtract?.debug?.parsedEntries || 0,
    ssrOrdersCount: Array.isArray(ssrExtract?.orders) ? ssrExtract.orders.length : 0,
    fallbackUsed,
    fallbackCount,
    finalOrdersCount: orders.length,
    sampleOrder: orders[0] || null
  });

  await sendOrdersToMarketplace(orders, targetTabId);
  return {
    success: true,
    count: orders.length,
    orders,
    debug: {
      htmlLength: ssrExtract?.debug?.htmlLength || 0,
      apolloScriptMatches: ssrExtract?.debug?.scriptMatches || 0,
      apolloParsedEntries: ssrExtract?.debug?.parsedEntries || 0,
      ssrOrdersCount: Array.isArray(ssrExtract?.orders) ? ssrExtract.orders.length : 0,
      fallbackUsed,
      fallbackCount,
    }
  };
}

function extractOrdersFromGraphqlPayload(payload) {
  const orders = [];
  const seenOrderIds = new Set();

  function maybePush(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    // Strictly accept only actual order nodes.
    const isOrderNode = node.__typename === "OrderNode"
      || (typeof node.id === "string" && node.id.startsWith("T3JkZXJOb2Rl"))
      || (typeof node.uuid === "string" && node.buyer && node.items);
    if (!isOrderNode) {
      return;
    }

    const key = node.id || node.uuid || JSON.stringify(node);
    if (seenOrderIds.has(key)) {
      return;
    }
    seenOrderIds.add(key);
    orders.push(node);
  }

  function visit(value) {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    // Only extract from the exact path requested:
    // me.orders.edges[].node
    const meOrdersEdges = value?.me?.orders?.edges;
    if (Array.isArray(meOrdersEdges)) {
      for (const edge of meOrdersEdges) {
        if (edge?.node) {
          maybePush(edge.node);
        }
      }
    }

    // Also support GraphQL payload root where data is already unwrapped.
    const dataMeOrdersEdges = value?.data?.me?.orders?.edges;
    if (Array.isArray(dataMeOrdersEdges)) {
      for (const edge of dataMeOrdersEdges) {
        if (edge?.node) {
          maybePush(edge.node);
        }
      }
    }

    for (const nested of Object.values(value)) {
      visit(nested);
    }
  }

  visit(payload);
  return orders;
}

function getOrderGraphqlTemplate(templates) {
  if (!templates || typeof templates !== "object") {
    return null;
  }

  const candidates = Object.entries(templates)
    .filter(([operationName, template]) => {
      if (!template || typeof template !== "object") {
        return false;
      }
      const op = String(operationName || "").toLowerCase();
      const body = template.requestBody && typeof template.requestBody === "object"
        ? template.requestBody
        : {};
      const query = typeof body.query === "string" ? body.query.toLowerCase() : "";
      return op.includes("order") || query.includes("order");
    })
    .map(([operationName, template]) => ({
      operationName,
      template,
    }));

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => {
    const aScore = (a.operationName.toLowerCase().includes("sellerhub") ? 20 : 0)
      + (a.operationName.toLowerCase().includes("myorders") ? 20 : 0)
      + scoreTemplate(a.template);
    const bScore = (b.operationName.toLowerCase().includes("sellerhub") ? 20 : 0)
      + (b.operationName.toLowerCase().includes("myorders") ? 20 : 0)
      + scoreTemplate(b.template);
    return bScore - aScore;
  });

  return candidates[0].template;
}

async function fetchOrdersFromCapturedGraphqlTemplate(tabId) {
  const template = getOrderGraphqlTemplate(state.observedGraphqlTemplates || {});
  if (!template) {
    return [];
  }

  const requestBody = template.requestBody && typeof template.requestBody === "object"
    ? structuredClone(template.requestBody)
    : null;
  if (!requestBody) {
    return [];
  }

  const templateHeaders = filterAllowedHeaders(template.requestHeaders || {});
  const headers = {
    ...templateHeaders,
    "content-type": "application/json",
    "x-whatnot-app": "whatnot-web",
    "x-wn-extension": "1",
  };
  const csrfToken = String(state?.auth?.csrf_token || "").trim();
  const accessToken = String(state?.auth?.access_token || "").trim();
  if (csrfToken && csrfToken !== "-") {
    headers["x-csrf-token"] = csrfToken;
  }
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const response = await executeApi(tabId, {
    url: template.url || "https://www.whatnot.com/services/graphql/?ssr=0",
    method: String(template.method || "POST").toUpperCase(),
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response?.success || !response?.data) {
    return [];
  }

  const payload = response.data;
  const graphqlData = payload && typeof payload === "object" && payload.data
    ? payload.data
    : payload;

  return extractOrdersFromGraphqlPayload(graphqlData);
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
  } else if (payload?.action === "fetch_whatnot_orders") {
    const requestedClerkUserId = normalizeClerkUserId(payload?.clerkUserId);
    if (requestedClerkUserId && requestedClerkUserId !== state.clerkUserId) {
      state.clerkUserId = requestedClerkUserId;
      await persistState();
    }
    result = await fetchWhatnotOrders(payload?.tabId || state.tabId);
  } else if (payload?.action === "fetch_seller_hub_inventory") {
    result = await executeSellerHubInventoryFromPlatform(payload);
  } else if (payload?.action === "generate_media_upload_urls") {
    result = await executeGenerateMediaUploadUrlsFromPlatform(payload);
  } else if (payload?.action === "create_listing") {
    result = await executeCreateListingFromPlatform(payload);
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

function headersArrayToObject(headers) {
  if (!Array.isArray(headers)) return {};
  return Object.fromEntries(
    headers
      .filter((h) => h && typeof h === "object" && h.name)
      .map((h) => [String(h.name), h.value]),
  );
}

function base64ToArrayBuffer(base64) {
  const binary = atob(String(base64).replace(/\s/g, ""));
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function resolveAddListingPhotoLabel(upload, uploadKey, normalizedMedia, index) {
  const apiId =
    upload && typeof upload.id === "string" && upload.id.trim() ? upload.id.trim() : "";
  if (apiId) {
    return apiId;
  }
  const pendingBase =
    typeof uploadKey === "string"
      ? uploadKey
          .replace(/^pending\//, "")
          .replace(/\.[a-z0-9]+$/i, "")
          .trim()
      : "";
  if (pendingBase) {
    return pendingBase;
  }
  const fallback =
    normalizedMedia[index] && normalizedMedia[index].id ? normalizedMedia[index].id.trim() : "";
  return fallback || normalizedMedia[0]?.id?.trim() || "";
}

async function executeGenerateMediaUploadUrlsFromPlatform(payload) {
  const media = Array.isArray(payload?.media) ? payload.media : [];
  const normalizedMedia = media
    .map((entry) => ({
      extension: typeof entry?.extension === "string" ? entry.extension.trim().toLowerCase() : "",
      id: typeof entry?.id === "string" ? entry.id.trim() : "",
    }))
    .filter((entry) => entry.id && entry.extension);

  if (!normalizedMedia.length) {
    return { success: false, error: "At least one media item with id and extension is required." };
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

  const template = state?.observedGraphqlTemplates?.GenerateMediaUploadUrls;
  let requestBody = {
    operationName: "GenerateMediaUploadUrls",
    variables: {
      media: normalizedMedia,
    },
    query: GENERATE_MEDIA_UPLOAD_URLS_MUTATION,
  };
  if (template?.requestBody && typeof template.requestBody === "object") {
    requestBody = structuredClone(template.requestBody);
    requestBody.operationName = "GenerateMediaUploadUrls";
    if (!requestBody.variables || typeof requestBody.variables !== "object") {
      requestBody.variables = {};
    }
    requestBody.variables = {
      ...requestBody.variables,
      media: normalizedMedia,
    };
  }

  const defaultHeaders = {
    "content-type": "application/json",
    "x-whatnot-app": "whatnot-web",
    "x-csrf-token": csrfToken,
    "x-wn-extension": "1",
  };
  const accessToken = String(state?.auth?.access_token || "").trim();
  if (accessToken) {
    defaultHeaders.authorization = `Bearer ${accessToken}`;
  }
  const templateHeaders = filterAllowedHeaders(template?.requestHeaders || {});

  const generateResponse = await executeApi(state.tabId, {
    url: "https://www.whatnot.com/services/graphql/?operationName=GenerateMediaUploadUrls&ssr=0",
    method: "POST",
    headers: { ...templateHeaders, ...defaultHeaders },
    body: JSON.stringify(requestBody),
  });

  if (!generateResponse?.success || !generateResponse?.data) {
    return generateResponse;
  }

  const uploads = Array.isArray(generateResponse?.data?.data?.generateMediaUploadURLs?.uploads)
    ? generateResponse.data.data.generateMediaUploadURLs.uploads
    : [];
  const firstUpload = uploads.find((entry) => entry && typeof entry === "object" && entry.targetKey) || null;
  const uploadKey = firstUpload && typeof firstUpload.targetKey === "string"
    ? firstUpload.targetKey.trim()
    : "";

  if (!uploadKey) {
    return {
      success: false,
      status: 502,
      error: "GenerateMediaUploadUrls response missing uploads.targetKey.",
      data: generateResponse?.data || null,
    };
  }

  if (firstUpload && firstUpload.error) {
    return {
      success: false,
      status: 502,
      error: typeof firstUpload.error === "string" ? firstUpload.error : "GenerateMediaUploadUrls upload slot error.",
      data: generateResponse?.data || null,
    };
  }

  const fileBase64Raw = typeof payload?.fileBase64 === "string" ? payload.fileBase64.trim().replace(/^data:[^;]+;base64,/, "") : "";
  if (!fileBase64Raw) {
    return {
      success: false,
      status: 400,
      error: "fileBase64 is required on the backend payload so the extension can PUT the image before AddListingPhoto.",
      data: generateResponse?.data || null,
    };
  }

  const uploadUrl = firstUpload && typeof firstUpload.url === "string" ? firstUpload.url.trim() : "";
  if (!uploadUrl) {
    return {
      success: false,
      status: 502,
      error: "GenerateMediaUploadUrls response missing uploads.url for storage PUT.",
      data: generateResponse?.data || null,
    };
  }

  const fileContentType =
    typeof payload?.fileContentType === "string" && payload.fileContentType.trim()
      ? payload.fileContentType.trim()
      : "application/octet-stream";

  let fileBuffer;
  try {
    fileBuffer = base64ToArrayBuffer(fileBase64Raw);
  } catch (_e) {
    return {
      success: false,
      status: 400,
      error: "Invalid fileBase64 encoding.",
      data: generateResponse?.data || null,
    };
  }

  const uploadMethod = String(firstUpload.method || "PUT").toUpperCase();
  const presignHeadersRaw = headersArrayToObject(firstUpload.headers);
  const presignHeaders = { ...presignHeadersRaw };
  const hasContentType =
    Boolean(presignHeaders["Content-Type"] || presignHeaders["content-type"]);
  if (!hasContentType) {
    presignHeaders["Content-Type"] = fileContentType;
  }

  const putResponse = await executeApi(state.tabId, {
    url: uploadUrl,
    method: uploadMethod,
    headers: presignHeaders,
    body: fileBuffer,
  });

  if (!putResponse?.success) {
    return {
      success: false,
      status: putResponse?.status || 502,
      error: putResponse?.error || "Failed to PUT image bytes to Whatnot upload URL.",
      data: generateResponse?.data || null,
      putResponse,
    };
  }

  const firstUploadIndex = firstUpload ? uploads.indexOf(firstUpload) : -1;
  const normalizedIndex = firstUploadIndex >= 0 ? firstUploadIndex : 0;
  const derivedLabel = resolveAddListingPhotoLabel(firstUpload, uploadKey, normalizedMedia, normalizedIndex);

  if (!derivedLabel) {
    return {
      success: false,
      status: 400,
      error: "Unable to resolve label for AddListingPhoto.",
      data: generateResponse?.data || null,
    };
  }

  const addListingPhotoTemplate = state?.observedGraphqlTemplates?.AddListingPhoto;
  let addListingPhotoRequestBody = {
    operationName: "AddListingPhoto",
    variables: {
      label: derivedLabel,
      uploadKey,
      uuid: null,
    },
    query: ADD_LISTING_PHOTO_MUTATION,
  };
  if (addListingPhotoTemplate?.requestBody && typeof addListingPhotoTemplate.requestBody === "object") {
    addListingPhotoRequestBody = structuredClone(addListingPhotoTemplate.requestBody);
    addListingPhotoRequestBody.operationName = "AddListingPhoto";
    if (!addListingPhotoRequestBody.variables || typeof addListingPhotoRequestBody.variables !== "object") {
      addListingPhotoRequestBody.variables = {};
    }
    addListingPhotoRequestBody.variables = {
      ...addListingPhotoRequestBody.variables,
      label: derivedLabel,
      uploadKey,
      uuid: null,
    };
    if (typeof addListingPhotoRequestBody.query !== "string" || !addListingPhotoRequestBody.query.trim()) {
      addListingPhotoRequestBody.query = ADD_LISTING_PHOTO_MUTATION;
    }
  }

  const addListingPhotoHeaders = filterAllowedHeaders(addListingPhotoTemplate?.requestHeaders || {});
  const addListingPhotoResponse = await executeApi(state.tabId, {
    url: "https://www.whatnot.com/services/graphql/?operationName=AddListingPhoto&ssr=0",
    method: "POST",
    headers: { ...addListingPhotoHeaders, ...defaultHeaders },
    body: JSON.stringify(addListingPhotoRequestBody),
  });

  if (!addListingPhotoResponse?.success) {
    return addListingPhotoResponse;
  }

  return {
    success: true,
    status: addListingPhotoResponse?.status || generateResponse?.status || 200,
    data: {
      generateMediaUploadUrls: generateResponse?.data || null,
      storagePut: putResponse?.data ?? null,
      addListingPhoto: addListingPhotoResponse?.data || null,
      uploadKey,
      label: derivedLabel,
    },
  };
}

async function executeCreateListingFromPlatform(payload) {
  const draftPayload = payload?.createListingPayload && typeof payload.createListingPayload === "object"
    ? structuredClone(payload.createListingPayload)
    : {};

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

  const createListingTemplate = state?.observedGraphqlTemplates?.CreateListing;
  let createListingRequestBody = {
    operationName: "CreateListing",
    variables: draftPayload,
    query: CREATE_LISTING_MUTATION,
  };

  if (createListingTemplate?.requestBody && typeof createListingTemplate.requestBody === "object") {
    createListingRequestBody = structuredClone(createListingTemplate.requestBody);
    createListingRequestBody.operationName = "CreateListing";
    if (!createListingRequestBody.variables || typeof createListingRequestBody.variables !== "object") {
      createListingRequestBody.variables = {};
    }
    createListingRequestBody.variables = {
      ...createListingRequestBody.variables,
      ...draftPayload,
    };
    if (typeof createListingRequestBody.query !== "string" || !createListingRequestBody.query.trim()) {
      createListingRequestBody.query = CREATE_LISTING_MUTATION;
    }
  }

  if (!createListingRequestBody.variables || typeof createListingRequestBody.variables !== "object") {
    createListingRequestBody.variables = {};
  }

  const requestUuid =
    typeof createListingRequestBody.variables.uuid === "string" && createListingRequestBody.variables.uuid.trim()
      ? createListingRequestBody.variables.uuid.trim()
      : crypto.randomUUID();
  createListingRequestBody.variables.uuid = requestUuid;

  const defaultHeaders = {
    "content-type": "application/json",
    "x-whatnot-app": "whatnot-web",
    "x-csrf-token": csrfToken,
    "x-wn-extension": "1",
  };
  const accessToken = String(state?.auth?.access_token || "").trim();
  if (accessToken) {
    defaultHeaders.authorization = `Bearer ${accessToken}`;
  }
  const templateHeaders = filterAllowedHeaders(createListingTemplate?.requestHeaders || {});

  const createListingResponse = await executeApi(state.tabId, {
    url: "https://www.whatnot.com/services/graphql/?operationName=CreateListing&ssr=0",
    method: "POST",
    headers: { ...templateHeaders, ...defaultHeaders },
    body: JSON.stringify(createListingRequestBody),
  });

  if (!createListingResponse?.success) {
    return createListingResponse;
  }

  return {
    success: true,
    status: createListingResponse?.status || 200,
    data: createListingResponse?.data || null,
    uuid: requestUuid,
  };
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
