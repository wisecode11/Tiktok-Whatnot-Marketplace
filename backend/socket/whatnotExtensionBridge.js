const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

let extensionSocket = null;
let extensionAuthState = null;
const pendingRequests = new Map();
let heartbeatTimer = null;

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      stopHeartbeat();
      return;
    }
    try {
      extensionSocket.send(
        JSON.stringify({
          type: "heartbeat",
          payload: { ts: Date.now() },
        }),
      );
    } catch (_error) {
      // Ignore send errors; close handler will clean up.
    }
  }, 15000);
}

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function settlePending(requestId, result) {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }

  pendingRequests.delete(requestId);
  clearTimeout(pending.timeoutId);
  pending.resolve(result);
}

function rejectPending(requestId, error) {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }

  pendingRequests.delete(requestId);
  clearTimeout(pending.timeoutId);
  pending.reject(error);
}

function rejectAllPending(error) {
  for (const requestId of pendingRequests.keys()) {
    rejectPending(requestId, error);
  }
}

const EXTENSION_WS_PATH = "/ws/whatnot-extension";

function initializeWhatnotExtensionBridge({ server }) {
  // Use noServer so we only handle extension upgrades. Attaching `server` + `path`
  // makes the ws package reject other upgrade paths (e.g. /socket.io/) with 404,
  // which breaks team chat Socket.IO when the client uses the websocket transport.
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? request.url.split("?")[0] : "";

    if (pathname !== EXTENSION_WS_PATH) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(String(raw || "{}"));
        const type = message && message.type ? String(message.type) : "";
        const payload = message && message.payload ? message.payload : {};

        if (type === "auth") {
          extensionSocket = socket;
          extensionAuthState = {
            payload,
            receivedAt: Date.now(),
          };
          startHeartbeat();
          return;
        }

        if (type === "action_response") {
          const requestId = payload && payload.requestId ? String(payload.requestId) : null;
          const response = payload && payload.response ? payload.response : null;

          if (requestId) {
            settlePending(requestId, response);
            return;
          }

          // Ignore uncorrelated notifications that do not carry an actionable response.
          // These can come from passive API observation events and should not settle a
          // pending request, otherwise the caller receives null and logs empty-body errors.
          if (response == null) {
            return;
          }

          const firstPending = pendingRequests.keys().next().value;
          if (firstPending) {
            settlePending(firstPending, response);
          }
          return;
        }

        // Do not reject unrelated pending requests — parallel Seller Hub calls
        // (stats + shipments + finance) must not fail because one action hit a transient token error.
        if (type === "relogin_required") {
          return;
        }
      } catch (_error) {
        // Ignore malformed messages from extension.
      }
    });

    socket.on("close", () => {
      if (extensionSocket === socket) {
        extensionSocket = null;
        extensionAuthState = null;
        stopHeartbeat();
      }
      rejectAllPending(createHttpError(503, "Whatnot extension disconnected."));
    });

    socket.on("error", () => {
      if (extensionSocket === socket) {
        extensionSocket = null;
        extensionAuthState = null;
        stopHeartbeat();
      }
    });
  });

  return wss;
}

function getWhatnotExtensionBridgeState() {
  return {
    isOnline: Boolean(extensionSocket && extensionSocket.readyState === WebSocket.OPEN),
    extensionAuthState,
  };
}

function isTransientWhatnotAuthMessage(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("relogin") ||
    text.includes("invalid token") ||
    text.includes("auth refresh") ||
    text.includes("csrf token missing") ||
    text.includes("auth failed")
  );
}

function isTransientWhatnotAuthError(error) {
  const status = Number(error && error.status);
  if (status === 401 || status === 403) {
    return true;
  }
  return isTransientWhatnotAuthMessage(error && error.message);
}

function isTransientWhatnotAuthActionResult(result) {
  if (!result || result.success) {
    return false;
  }
  return isTransientWhatnotAuthMessage(result.error);
}

async function requestWhatnotActionOnce(payload, timeoutMs) {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
    const waitUntil = Date.now() + 3000;
    while (Date.now() < waitUntil) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
        break;
      }
    }
  }

  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
    throw createHttpError(503, "Whatnot extension is offline. Open extension popup once and reconnect Whatnot.");
  }

  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      rejectPending(requestId, createHttpError(504, "Timed out waiting for Whatnot extension response."));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeoutId });

    extensionSocket.send(
      JSON.stringify({
        type: "action_request",
        payload: {
          ...payload,
          requestId,
        },
      }),
    );
  });
}

function isExtensionTimeoutError(error) {
  return Number(error && error.status) === 504;
}

async function requestWhatnotAction(payload, timeoutMs = 45000) {
  let lastResult = null;
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    const attemptTimeout = attempt === 0 ? timeoutMs : Math.max(timeoutMs, 60000);
    try {
      lastResult = await requestWhatnotActionOnce(payload, attemptTimeout);
      lastError = null;
    } catch (error) {
      lastError = error;
      const retryable =
        isTransientWhatnotAuthError(error) || isExtensionTimeoutError(error);
      if (!retryable || attempt === 1) {
        throw error;
      }
      continue;
    }
    if (!isTransientWhatnotAuthActionResult(lastResult) || attempt === 1) {
      return lastResult;
    }
  }
  if (lastError) {
    throw lastError;
  }
  return lastResult;
}

module.exports = {
  getWhatnotExtensionBridgeState,
  initializeWhatnotExtensionBridge,
  requestWhatnotAction,
};
