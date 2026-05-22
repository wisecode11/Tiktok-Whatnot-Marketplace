const { verifyToken } = require("@clerk/backend");
const { Server } = require("socket.io");

const { listMessages, sendMessage } = require("../services/chatService");

function buildSocketError(message) {
  return { ok: false, error: message || "Socket request failed." };
}

function extractBearerToken(socket) {
  const authToken = socket.handshake && socket.handshake.auth && socket.handshake.auth.token
    ? String(socket.handshake.auth.token)
    : "";

  if (authToken) {
    return authToken;
  }

  const authHeader = socket.handshake && socket.handshake.headers
    ? socket.handshake.headers.authorization || ""
    : "";

  if (String(authHeader).startsWith("Bearer ")) {
    return String(authHeader).slice("Bearer ".length).trim();
  }

  return "";
}

function buildAllowedSocketOrigins(configuredOrigins) {
  const origins = new Set(configuredOrigins);

  for (const origin of [...configuredOrigins]) {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === "localhost") {
        origins.add(`http://127.0.0.1:${parsed.port || "3000"}`);
      }
      if (parsed.hostname === "127.0.0.1") {
        origins.add(`http://localhost:${parsed.port || "3000"}`);
      }
    } catch (_error) {
      // Ignore malformed origin entries.
    }
  }

  return origins;
}

function initializeChatSocket({ server, allowedOrigins }) {
  const socketOrigins = buildAllowedSocketOrigins(allowedOrigins);

  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin || socketOrigins.has(origin)) {
          return callback(null, true);
        }

        return callback(new Error("CORS: origin not allowed"));
      },
    },
  });

  io.use(async (socket, next) => {
    const token = extractBearerToken(socket);

    if (!token) {
      return next(new Error("Missing bearer token."));
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        clockSkewInMs: 15000,
      });

      socket.data = {
        ...(socket.data || {}),
        auth: {
          userId: payload.sub,
          sessionId: payload.sid,
        },
      };

      return next();
    } catch (error) {
      return next(new Error("Invalid or expired session token."));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data && socket.data.auth ? socket.data.auth : null;
    const clerkUserId = auth ? auth.userId : null;

    socket.on("chat:join", async (payload, acknowledge) => {
      try {
        const threadId = payload && payload.threadId ? String(payload.threadId) : "";
        const limit = payload && payload.limit ? Number(payload.limit) : 100;

        if (!threadId) {
          const response = buildSocketError("threadId is required.");
          if (typeof acknowledge === "function") {
            acknowledge(response);
          }
          return;
        }

        const result = await listMessages({
          clerkUserId,
          threadId,
          limit,
        });

        socket.join(`thread:${threadId}`);

        if (typeof acknowledge === "function") {
          acknowledge({ ok: true, ...result });
        }
      } catch (error) {
        if (typeof acknowledge === "function") {
          acknowledge(buildSocketError(error && error.message ? error.message : "Unable to join chat thread."));
        }
      }
    });

    socket.on("chat:leave", (payload) => {
      const threadId = payload && payload.threadId ? String(payload.threadId) : "";

      if (!threadId) {
        return;
      }

      socket.leave(`thread:${threadId}`);
    });

    socket.on("chat:send", async (payload, acknowledge) => {
      try {
        const threadId = payload && payload.threadId ? String(payload.threadId) : "";
        const body = payload && payload.body ? String(payload.body) : "";

        if (!threadId) {
          const response = buildSocketError("threadId is required.");
          if (typeof acknowledge === "function") {
            acknowledge(response);
          }
          return;
        }

        const result = await sendMessage({
          clerkUserId,
          threadId,
          body,
        });

        const eventPayload = {
          threadId,
          message: result.message,
        };

        io.to(`thread:${threadId}`).emit("chat:message", eventPayload);

        if (typeof acknowledge === "function") {
          acknowledge({ ok: true, ...eventPayload });
        }
      } catch (error) {
        if (typeof acknowledge === "function") {
          acknowledge(buildSocketError(error && error.message ? error.message : "Unable to send message."));
        }
      }
    });
  });

  return io;
}

module.exports = { initializeChatSocket };
