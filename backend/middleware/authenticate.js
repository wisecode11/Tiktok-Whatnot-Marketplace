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
    });

    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      claims: payload,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session token." });
  }
}

module.exports = { authenticateRequest };
