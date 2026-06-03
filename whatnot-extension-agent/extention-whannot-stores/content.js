const pendingRequests = new Map();
let injectReady = false;

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

  if (event.data.type === "INJECT_READY") {
    injectReady = true;
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

function waitForInjectReady(timeoutMs = 2500) {
  if (injectReady) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(injectReady), timeoutMs);
    const onReady = (event) => {
      if (event.source !== window || event.data?.source !== "wn-page") {
        return;
      }
      if (event.data.type !== "INJECT_READY") {
        return;
      }
      injectReady = true;
      window.removeEventListener("message", onReady);
      clearTimeout(timer);
      resolve(true);
    };
    window.addEventListener("message", onReady);
    injectPageScript();
  });
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "run_whatnot_api") {
    void (async () => {
      const ready = await waitForInjectReady();
      if (!ready) {
        sendResponse({ success: false, error: "Whatnot page bridge not ready. Refresh the Whatnot tab." });
        return;
      }

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
        },
      });

      postToPage({ type: "EXECUTE_API", requestId, options: request.options });
    })();
    return true;
  }

  if (request.action === "read_session_tokens") {
    void (async () => {
      const ready = await waitForInjectReady();
      if (!ready) {
        sendResponse({ success: false, error: "Whatnot page bridge not ready. Refresh the Whatnot tab." });
        return;
      }

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
        },
      });

      postToPage({
        type: "EXECUTE_API",
        requestId,
        options: {
          url: "https://www.whatnot.com/services/live/socket/v3/session",
          method: "GET",
        },
      });
    })();
    return true;
  }
});

injectPageScript();
window.addEventListener("message", handlePageMessage);
