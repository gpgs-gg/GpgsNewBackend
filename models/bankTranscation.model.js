const mongoose = require("mongoose");

const bankTransactionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Transaction date is required"],
      index: true,
    },

    narration: {
      type: String,
      required: [true, "Narration is required"],
      trim: true,
    },

    chqNo: {
      type: String,
      trim: true,
      default: "",
    },

    withdrawal: {
      type: Number,
      default: 0,
      min: 0,
    },

    deposit: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      default: 0,
    },

    valueDate: {
      type: Date,
    },

    source: {
      type: String,
      enum: ["upload", "api", "manual"],
      default: "upload",
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // ===========================
    // Mapping Details
    // ===========================
    isMapped: {
      type: Boolean,
      default: false,
      index: true,
    },

    mappedAt: {
      type: Date,
      default: null,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },

    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },

    bedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bed",
    },
    metadata: {
      fileName: String,
      uploadDate: Date,
      originalRow: String,
    },
  },
  {
    timestamps: true,
  }
);

// Duplicate detection
bankTransactionSchema.index({
  date: 1,
  narration: 1,
  withdrawal: 1,
  deposit: 1,
});

// Search
bankTransactionSchema.index({
  narration: "text",
});

module.exports = mongoose.model(
  "BankTransaction",
  bankTransactionSchema
);