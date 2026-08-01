const mongoose = require("mongoose");

const GlobalSettingsSchema = new mongoose.Schema(
  {
    leadAutoTransfer: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("GlobalSettings", GlobalSettingsSchema);