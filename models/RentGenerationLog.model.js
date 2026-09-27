const mongoose = require("mongoose");

const rentGenerationLogSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
    },

    year: {
      type: Number,
      required: true,
    },

    monthName: {
      type: String,
      required: true,
    },

    eligibleClientCount: {
      type: Number,
      default: 0,
    },

    alreadyGeneratedCount: {
      type: Number,
      default: 0,
    },

    generatedCount: {
      type: Number,
      default: 0,
    },

    failedCount: {
      type: Number,
      default: 0,
    },

    eligibleClientIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
      },
    ],

    generatedClientIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
      },
    ],

    failedClients: [
      {
        clientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Client",
        },

        fullName: {
          type: String,
          default: "",
        },

        reason: {
          type: String,
          default: "",
        },
      },
    ],

    status: {
      type: String,
      enum: [
        "Running",
        "Completed",
        "Completed With Errors",
        "Failed",
      ],
      default: "Running",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

rentGenerationLogSchema.index(
  { month: 1, year: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "RentGenerationLog",
  rentGenerationLogSchema
);