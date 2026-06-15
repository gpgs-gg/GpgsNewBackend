const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema(
  {
    // ---------------- PROPERTY DETAILS ----------------
    // propertyId: { type: String, required: true, unique: true },
    propertyCode: String,
    status: String,
    propertyLocation: String,
    bedCount: Number,
    propertyAddress: String,
    // ---------------- INTERNET DETAILS ----------------
    internet: {
      vendorLoginId: String,
      vendorLoginPassword: String,
      consumerId: String,
      contactNo1: String,
      contactNo2: String,
      wifiName: String,
      wifiPwd: String,
      routerConnectionType: {
        type: String,
        enum: ["Main Router", "Sub Router"],
      },
      mainRouterPropertyCode: String,
      gpgsRegisteredNoWithInternetVendor: String,
    },

    // ---------------- UTILITY DETAILS ----------------
    utility: {
      ebConsumerNo: String,
      ebBillingUnit: String,
      ebStartDate: Date,
      ebEndDate: Date,
      ebPcWebLink: String,

      gasConsumerNo: String,
      gasBillStartDate: Date,
      gasBillEndDate: Date,

      waterBillConsumerNo: String,
      waterBillStartDate: Date,
      waterBillEndDate: Date,
    },

    // ---------------- OWNER DETAILS ----------------
    owner: {
      fullName: String,
      contactNo1: String,
      contactNo2: String,
      emergencyContactName: String,
      emergencyContactNo: String,
      photo: [String],
      aadharCard: [String],
    },

    // ---------------- AGREEMENT ----------------
    agreement: {
      propertyStartDate: Date,
      propertyEndDate: Date,
      agreementStartDate: Date,
      agreementEndDate: Date,
      agreementStatus: String,
      policeNocNo: String,
      policeNocStatus: String,
      dealDetails: String,
      comment: String,
    },

    // ---------------- WORKLOGS ----------------
    worklogs: [
      {
        message: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", PropertySchema);