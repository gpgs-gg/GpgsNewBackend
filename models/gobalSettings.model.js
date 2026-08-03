const mongoose = require("mongoose");

const GlobalSettingsSchema = new mongoose.Schema(
  {
    leadAutoTransfer: {
      type: Boolean,
      default: false,
    },

    teamAutoAssignment: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("GlobalSettings", GlobalSettingsSchema);