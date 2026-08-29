// models/ClientVacationHistory.js

const mongoose = require("mongoose");

const clientVacationHistorySchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client ID is required"],
    },

    month: {
      type: Number,
      required: [true, "Month is required"],
      min: 1,
      max: 12,
    },

    year: {
      type: Number,
      required: [true, "Year is required"],
      min: 2000,
    },

    vacationStartDate1: {
      type: String,
      default: null,
    },

    vacationLastDate1: {
      type: String,
      default: null,
    },

    vacationStartDate2: {
      type: String,
      default: null,
    },

    vacationLastDate2: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: same client + month + year
clientVacationHistorySchema.index(
  {
    clientId: 1,
    month: 1,
    year: 1,
  },
  {
    unique: true,
  }
);

// Faster queries by client + year + month
clientVacationHistorySchema.index({
  clientId: 1,
  year: -1,
  month: -1,
});

module.exports = mongoose.model(
  "clientVacationHistory",
  clientVacationHistorySchema
);