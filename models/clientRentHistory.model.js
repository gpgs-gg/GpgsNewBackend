const mongoose = require("mongoose");

const clientRentHistorySchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
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

    stayType: {
      type: String,
      enum: ["P. Booked", "T. Booked"],
      default: "P. Booked",
    },

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

    monthlyRent: {
      type: Number,
      default: 0,
    },
    rentAmt: {
      type: Number,
      default: 0,
    },

    ebAmt: {
      type: Number,
      default: 0,
    },

    flatEB: {
      type: Number,
      default: 0,
    },

    adjEB: {
      type: Number,
      default: 0,
    },

    adjAmt: {
      type: Number,
      default: 0,
    },

    parkingCharges: {
      type: Number,
      default: 0,
    },
    parkingChargesReceived: {
      type: Number,
      default: 0,
    },
    parkingChargesDue: {
      type: Number,
      default: 0,
    },
    processingFees: {
      type: Number,
      default: 0,
    },
 
    processingFeesReceived : {
      type: Number,
      default: 0,
    },
 
    processingFeesDue: {
      type: Number,
      default: 0,
    },
   depositAmount : {
    type : Number , default : 0
   } , 
   depositAmountReceived : {
    type : Number , default : 0
   } , 
   depositAmountDue : {
    type : Number , default : 0
   } , 

   daysCount : {
    type : Number , default : 0
   } , 


    previousDue: {
      type: Number,
      default: 0,
    },

    totalReceivable: {
      type: Number,
      default: 0,
    },

    totalReceived: {
      type: Number,
      default: 0,
    },

    currentDue: {
      type: Number,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Partial", "Paid" , "Shifted"],
      default: "Pending",
    },

    paymentComments: {
      type: String,
      default: "",
    },

    rentDOJ: {
      type: Date,
      default: null,
    },

    ebDOJ: {
      type: Date,
      default: null,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },

    remarks: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */

// Prevent duplicate history for same client & month (optional unique)
clientRentHistorySchema.index({
  clientId: 1,
  bedId: 1,
  month: 1,
  year: 1,
});

// Property-wise queries
clientRentHistorySchema.index({
  propertyId: 1,
});

// Payment status filter
clientRentHistorySchema.index({
  paymentStatus: 1,
});

// Property + Month reports (Recommended)
clientRentHistorySchema.index({
  propertyId: 1,
  month: 1,
  year: 1,
});

// Client payment history
clientRentHistorySchema.index({
  clientId: 1,
  paymentStatus: 1,
});

module.exports = mongoose.model(
  "ClientRentHistory",
  clientRentHistorySchema
);