const mongoose = require("mongoose");

const HousekeepingActivitySchema = new mongoose.Schema(
  {
    activityName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    frequency: {
      type: Number,
      required: true,
      min: 1,
    },

    notifyBefore: {
      type: Number,
      default: 0,
    },

    displayOrder: {
      type: Number,
      default: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// HousekeepingActivitySchema.index({
//   activityName: 1,
// });

module.exports = mongoose.model(
  "HousekeepingActivity",
  HousekeepingActivitySchema,
);