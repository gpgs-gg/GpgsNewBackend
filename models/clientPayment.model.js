
const mongoose = require("mongoose");

const clientPaymentSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    rentHistoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientRentHistory",
      required: true,
      index: true,
    },

    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    bedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bed",
      required: true,
    },

    month: {
      type: Number,
      required: true,
    },

    year: {
      type: Number,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    paymentMode: {
      type: String,
      enum: [
        "Cash",
        "UPI",
        "Bank",
        "Cheque",
      ],
      required: true,
    },

    transactionId: {
      type: String,
      default: "",
    },

    remarks: {
      type: String,
      default: "",
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    receiptNo: {
      type: String,
      unique: true,
    },

    status: {
      type: String,
      enum: [
        "Success",
        "Cancelled",
        "Refunded",
      ],
      default: "Success",
    },
  },
  {
    timestamps: true,
  }
);

clientPaymentSchema.index({
  clientId: 1,
  month: 1,
  year: 1,
});

clientPaymentSchema.index({
  receiptNo: 1,
});

module.exports = mongoose.model(
  "ClientPayment",
  clientPaymentSchema
);