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

function initializeWhatnotExtensionBridge({ server }) {
  const wss = new WebSocketServer({
    server,
    path: "/ws/whatnot-extension",
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

        if (type === "relogin_required") {
          rejectAllPending(createHttpError(401, "Whatnot relogin required in extension.", payload));
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

async function requestWhatnotAction(payload, timeoutMs = 25000) {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
    // Give extension reconnect loop a short chance before failing request.
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

module.exports = {
  getWhatnotExtensionBridgeState,
  initializeWhatnotExtensionBridge,
  requestWhatnotAction,
};
