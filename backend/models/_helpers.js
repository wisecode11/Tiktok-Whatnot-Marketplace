const mongoose = require("mongoose");

module.exports = {
  mongoose,
  Schema: mongoose.Schema,
  Mixed: mongoose.Schema.Types.Mixed,
  uuid: () => require("crypto").randomUUID(),
};
