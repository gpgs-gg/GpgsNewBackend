const mongoose = require("mongoose");

const HistorySchema = new mongoose.Schema(
  {
    completedDate: {
      type: Date,
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedByName: {
      type: String,
      default: "",
      trim: true,
    },

    remarks: {
      type: String,
      default: "",
    },

    attachments: [
      {
        type: String,
      },
    ],

    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const HousekeepingRecordSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HousekeepingActivity",
      required: true,
    },

    history: {
      type: [HistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

HousekeepingRecordSchema.index(
  {
    propertyId: 1,
    activityId: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("HousekeepingRecord", HousekeepingRecordSchema);