// models/BankTransaction.js
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

// Compound index for duplicate detection
bankTransactionSchema.index(
  { date: 1, narration: 1, withdrawal: 1, deposit: 1 },
  { unique: false }
);

// Index for search
bankTransactionSchema.index({ narration: "text" });

module.exports = mongoose.model("BankTransaction", bankTransactionSchema);