const mongoose = require("mongoose");

const BedSchema = new mongoose.Schema(
  {
    // Property Reference
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    // Room & Bed Details
    roomNo: {
      type: String,
      required: true,
      trim: true,
    },

    bedNo: {
      type: String,
      required: true,
      trim: true,
    },
   propertyLocation: String,
    // Configuration
    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    sharingType: {
      type: String,
      enum: ["Private", "Double", "Triple", "Quad"],
      required: true,
    },

    bathAttached: {
      type: String,
      enum: ["Yes", "No"],
      default: "No",
    },
    acRoom: {
      type: String,
      enum: ["AC", "Non AC"],
      default: "Non AC",
    },

    // Rent & Deposit
    monthlyRent: {
      type: Number,
      required: true,
      min: 0,
    },

    securityDepositMultiplicationFactor: {
      type: Number,
      default: 0,
    },

    depositAmount: {
      type: Number,
      default: 0,
    },

    // Rent Hike
    upcomingRentHikeDate: {
      type: Date,
    },

    upcomingRentHikeAmount: {
      type: Number,
      default: 0,
    },

    previousRentHikeDate: {
      type: Date,
    },

    comment: {
      type: String,
      trim: true,
    },

    // Active / Inactive Record
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    // Worklogs
    worklogs: [
      {
        message: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Auto calculate deposit amount
BedSchema.pre("save", async function () {
  this.depositAmount =
    (this.monthlyRent || 0) *
    (this.securityDepositMultiplicationFactor || 1);
});

module.exports = mongoose.model("Bed", BedSchema);