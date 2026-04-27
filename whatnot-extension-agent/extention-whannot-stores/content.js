const pendingRequests = new Map();

function injectPageScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
}

function postToPage(message) {
  window.postMessage({ source: "wn-extension-content", ...message }, "*");
}

function handlePageMessage(event) {
  if (event.source !== window || !event.data || event.data.source !== "wn-page") {
    return;
  }

  if (event.data.type === "API_RESULT") {
    const pending = pendingRequests.get(event.data.requestId);
    if (!pending) return;
    pendingRequests.delete(event.data.requestId);
    pending.resolve(event.data.result);
    return;
  }

  if (event.data.type === "OBSERVED_API") {
    chrome.runtime.sendMessage({
      action: "observed_api",
      payload: event.data.payload
    });
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "run_whatnot_api") {
    const requestId = crypto.randomUUID();
    const timeoutId = setTimeout(() => {
      if (!pendingRequests.has(requestId)) return;
      pendingRequests.delete(requestId);
      sendResponse({ success: false, error: "Page execution timeout" });
    }, 25000);

    pendingRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeoutId);
        sendResponse(result);
      }
    });

    postToPage({ type: "EXECUTE_API", requestId, options: request.options });
    return true;
  }

  if (request.action === "read_session_tokens") {
    const requestId = crypto.randomUUID();
    const timeoutId = setTimeout(() => {
      if (!pendingRequests.has(requestId)) return;
      pendingRequests.delete(requestId);
      sendResponse({ success: false, error: "Session read timeout" });
    }, 15000);

    pendingRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeoutId);
        sendResponse(result);
      }
    });

    postToPage({
      type: "EXECUTE_API",
      requestId,
      options: {
        url: "https://www.whatnot.com/services/live/socket/v3/session",
        method: "GET"
      }
    });
    return true;
  }
});

injectPageScript();
window.addEventListener("message", handlePageMessage);
