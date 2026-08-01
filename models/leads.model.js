const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema(
  {
    LeadNo: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    Date: {
      type: String,
      default: "",
    },

    Time: {
      type: String,
      default: "",
    },

    TeamCode: {
      type: String,
      default: "",
      index: true,
    },

    ClientName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    Gender: {
      type: String,
      default: "",
    },

    CallingNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    WhatsAppNo: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    LeadSource: {
      type: String,
      default: "",
      index: true,
    },

    FollowupDate: {
      type: String,
      default: "",
      index: true,
    },

    LeadStatus: {
      type: String,
      default: "New",
      index: true,
    },

    Location: {
      type: String,
      default: "",
      index: true,
    },

    workLogs: [
      {
        message: String,
        createdBy: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    TransferHistory: {
      type: String,
      default: "",
    },

    Reason: {
      type: String,
      default: "",
      index: true,
    },

    Assignee: {
      type: String,
      default: "",
      index: true,
    },

    FieldMember: {
      type: String,
      default: "",
      index: true,
    },

    IsActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    CreatedBy: {
      type: String,
      default: "",
    },

    UpdatedBy: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes
LeadSchema.index({ LeadStatus: 1, Assignee: 1 });
LeadSchema.index({ TeamCode: 1, LeadStatus: 1 });
LeadSchema.index({ CallingNo: 1, LeadStatus: 1 });
LeadSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Lead", LeadSchema);