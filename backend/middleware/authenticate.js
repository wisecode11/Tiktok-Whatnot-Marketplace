const { verifyToken } = require("@clerk/backend");

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
      clockSkewInMs: 15000,
    });

    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      claims: payload,
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
