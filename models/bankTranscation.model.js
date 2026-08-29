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

    assignee: {
      type: String,
      default: "",
      index: true,
    },

    reviewer: {
      type: String,
      default: "",
      index: true,
    },

    auditor: {
      type: String,
      default: "",
      index: true,
    },

    expenseCategory: {
      type: String,
      default: "",
      index: true,
    },

    status: {
      type: String,
      default: "Open",
      index: true,
    },

    workLogs: [
      {
        message: String,
        createdBy: String,
        createdAt: {
          type: String,
          default: String,
        },
      },
    ],
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

    expenseCode: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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

// module.exports = mongoose.model(
//   "BankTransaction",
//   bankTransactionSchema
// );

const BankTransaction = mongoose.model(
  "BankTransaction",
  bankTransactionSchema
);

// =====================================================
// NEW ACCOUNT-WISE MODELS
// =====================================================

const AC1Transaction = mongoose.model(
  "AC1Transaction",
  bankTransactionSchema,
  "ac1Transactions"
);

const AC2Transaction = mongoose.model(
  "AC2Transaction",
  bankTransactionSchema,
  "ac2Transactions"
);

const AC3Transaction = mongoose.model(
  "AC3Transaction",
  bankTransactionSchema,
  "ac3Transactions"
);

const AC4Transaction = mongoose.model(
  "AC4Transaction",
  bankTransactionSchema,
  "ac4Transactions"
);

const AC5Transaction = mongoose.model(
  "AC5Transaction",
  bankTransactionSchema,
  "ac5Transactions"
);

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  BankTransaction,
  AC1Transaction,
  AC2Transaction,
  AC3Transaction,
  AC4Transaction,
  AC5Transaction,
};