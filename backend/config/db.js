const mongoose = require("mongoose");

async function connectDB(uri) {
  await mongoose.connect(uri, { autoIndex: true });
}

module.exports = { connectDB };
