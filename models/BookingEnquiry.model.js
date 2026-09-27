const mongoose = require("mongoose");

const bookingEnquirySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    whatsappNumber: {
      type: String,
      required: true,
      trim: true,
    },

    callingNumber: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    companyCollegeName: {
      type: String,
      trim: true,
      default: "",
    },

    profile: {
      type: String,
      trim: true,
      default: "",
    },

    joiningDate: {
      type: Date,
      required: true,
    },

    fatherName: {
      type: String,
      trim: true,
      default: "",
    },

    fatherContact: {
      type: String,
      trim: true,
      default: "",
    },

    motherName: {
      type: String,
      trim: true,
      default: "",
    },

    motherContact: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["Pending", "Contacted", "Confirmed", "Cancelled"],
      default: "Pending",
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "BookingEnquiry",
  bookingEnquirySchema
);