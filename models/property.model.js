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
    subMeterDetails : String,
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

      ebStartCycle: {
        type: Number,
        min: 1,
        max: 31,
        default: null,
      },

      ebEndCycle: {
        type: Number,
        min: 1,
        max: 31,
        default: null,
      },

      ebPcWebLink: String,

      gasConsumerNo: String,

      gasBillStartCycle: {
        type: Number,
        min: 1,
        max: 31,
        default: null,
      },

      gasBillEndCycle: {
        type: Number,
        min: 1,
        max: 31,
        default: null,
      },

      waterBillConsumerNo: String,

      waterBillStartCycle: {
        type: Number,
        min: 1,
        max: 31,
        default: null,
      },

      waterBillEndCycle: {
        type: Number,
        min: 1,
        max: 31,
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
      agreementStartDate: {
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
      attachment: {
        type: [String],
        default: [],
      },
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