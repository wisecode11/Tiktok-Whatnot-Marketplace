require("dotenv").config();

const cors = require("cors");
const express = require("express");

const { connectDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const billingRoutes = require("./routes/billingRoutes");
const { stripeWebhook } = require("./controllers/billingController");
const integrationRoutes = require("./routes/integrationRoutes");
const moderatorProfileRoutes = require("./routes/moderatorProfileRoutes");
const models = require("./models");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
app.use("/api/integrations", integrationRoutes);
app.use("/api/moderator-profile", moderatorProfileRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true, models: Object.keys(models).length });
});

async function start() {
  await connectDB(process.env.MONGODB_URI || "mongodb://localhost:27017/sellerhub");
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running on ${port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
