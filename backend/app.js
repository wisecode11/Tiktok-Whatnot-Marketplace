require("dotenv").config();

const cors = require("cors");
const express = require("express");
const http = require("http");

const { connectDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const billingRoutes = require("./routes/billingRoutes");
const bookingPaymentRoutes = require("./routes/bookingPaymentRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { stripeWebhook } = require("./controllers/billingController");
const integrationRoutes = require("./routes/integrationRoutes");
const moderatorProfileRoutes = require("./routes/moderatorProfileRoutes");
const aiRoutes = require("./routes/aiRoutes");
const { initializeChatSocket } = require("./socket/chatSocket");
const models = require("./models");

const app = express();

const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([...configuredOrigins, "http://localhost:3000", "http://localhost:3001"]),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS: origin not allowed"));
    },
  }),
);
app.post(
  "/api/billing/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/booking-payments", bookingPaymentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/moderator-profile", moderatorProfileRoutes);
app.use("/api/ai", aiRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true, models: Object.keys(models).length });
});

async function start() {
  await connectDB(process.env.MONGODB_URI || "mongodb://localhost:27017/sellerhub");
  const port = process.env.PORT || 5001;
  const server = http.createServer(app);
  initializeChatSocket({ server, allowedOrigins });
  server.listen(port, () => console.log(`Server running on ${port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
