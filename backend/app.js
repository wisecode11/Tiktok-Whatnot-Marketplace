require("dotenv").config();

const cors = require("cors");
const express = require("express");

const { connectDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const models = require("./models");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  }),
);
app.use(express.json());

app.use("/api/auth", authRoutes);

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
