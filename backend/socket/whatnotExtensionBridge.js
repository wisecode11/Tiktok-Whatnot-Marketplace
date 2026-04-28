const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

let extensionSocket = null;
let extensionAuthState = null;
const pendingRequests = new Map();

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
          return;
        }

        if (type === "action_response") {
          const requestId = payload && payload.requestId ? String(payload.requestId) : null;
          const response = payload && payload.response ? payload.response : null;

          if (requestId) {
            settlePending(requestId, response);
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
      }
      rejectAllPending(createHttpError(503, "Whatnot extension disconnected."));
    });

    socket.on("error", () => {
      if (extensionSocket === socket) {
        extensionSocket = null;
        extensionAuthState = null;
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
    throw createHttpError(503, "Whatnot extension is offline. Open extension and connect Whatnot first.");
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
