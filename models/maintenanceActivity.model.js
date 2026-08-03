const mongoose = require("mongoose");

const MaintenanceActivitySchema = new mongoose.Schema(
  {
    activityName: {
      type: String,
      required: true,
      trim: true,
    },

    frequency: {
      type: Number,
      required: true,
    },

    notifyBefore: {
      type: Number,
      default: 0,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    frequency: {
      type: Number,
      required: true,
      default: 1,
    },

    notifyBefore: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model(
  "MaintenanceActivity",
  MaintenanceActivitySchema,
);