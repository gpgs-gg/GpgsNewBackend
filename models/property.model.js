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
      ebStartDate: {
        type: String,
        default: null,
      },
      ebEndDate: {
        type: String,
        default: null,
      },
      ebPcWebLink: String,
      gasConsumerNo: String,
      gasBillStartDate: {
        type: String,
        default: null,
      },
      gasBillEndDate: {
        type: String,
        default: null,
      },
      waterBillConsumerNo: String,
        waterBillStartDate: {
        type: String,
        default: null,
      },
      waterBillEndDate: {
        type: String,
        default: null,
      },
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

        propertyStartDate: {
        type: String,
        default: null,
      },
        propertyEndDate: {
        type: String,
        default: null,
      },
        propertyEndDate: {
        type: String,
        default: null,
      },
        agreementEndDate: {
        type: String,
        default: null,
      },
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

PropertySchema.index({ propertyCode: 1 });
PropertySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Property", PropertySchema);