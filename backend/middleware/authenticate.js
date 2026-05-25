const { verifyToken } = require("@clerk/backend");
const { User } = require("../models");

const BOOTSTRAP_AUTH_ENDPOINTS = new Set([
  "/api/auth/sync-user",
  "/api/auth/login",
  "/api/auth/me",
]);

function isBootstrapAuthRequest(req) {
  const rawPath =
    typeof req.originalUrl === "string"
      ? req.originalUrl
      : typeof req.url === "string"
        ? req.url
        : "";
  const path = rawPath.split("?")[0];
  return BOOTSTRAP_AUTH_ENDPOINTS.has(path);
}

function rejectUnauthorized(res, message, accountStatus) {
  return res.status(401).json({
    success: false,
    message,
    code: "ACCOUNT_DEACTIVATED",
    accountStatus,
  });
}

async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      clockSkewInMs: 60000,
    });

    const user = await User.findOne({ clerk_user_id: payload.sub });

    if (!user) {
      if (isBootstrapAuthRequest(req)) {
        req.auth = {
          userId: payload.sub,
          sessionId: payload.sid,
          claims: payload,
          user: null,
        };

        return next();
      }

      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        code: "ACCOUNT_UNAUTHORIZED",
      });
    }

    if (["inactive", "pending", "blocked", "deleted"].includes(user.status)) {
      return rejectUnauthorized(
        res,
        "Your account has been deactivated by admin",
        user.status === "pending" ? "inactive" : user.status
      );
    }

    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      claims: payload,
      user: user,
    };

    return next();
  } catch (error) {
    const errorMessage =
      error && typeof error.message === "string"
        ? error.message
        : "Invalid or expired session token.";

    return res.status(401).json({
      error: "Invalid or expired session token.",
      details:
        process.env.NODE_ENV === "development"
          ? { reason: errorMessage }
          : undefined,
    });
  }
}

module.exports = { authenticateRequest };
