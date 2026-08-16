const mongoose = require("mongoose");
const WorklogSchema = require("./schema/WorklogSchema");

const employeeSchema = new mongoose.Schema(
  {
    // =========================
    // BASIC INFORMATION
    // =========================

    employeeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    employeeName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // =========================
    // WORKLOG / AUDIT HISTORY
    // =========================

    worklogs: {
      type: [WorklogSchema],
      default: [],
    },

    // =========================
    // ORGANIZATION
    // =========================

    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    teamCode: {
      type: String,

      trim: true,
      index: true,
    },

    status: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    additionalAccess: [
      {
        type: String,
        trim: true,
      },
    ],

    designation: {
      type: String,
      trim: true,
    },

    level: {
      type: String,
      trim: true,
    },

    role: {
      type: String,
      trim: true,
    },

    // =========================
    // DATES
    // =========================

    dateOfJoining: {
      type: Date,
    },

    dateOfBirth: {
      type: Date,
    },

    // =========================
    // COMPANY
    // =========================

    parentCompany: {
      type: String,
      trim: true,
    },

    // =========================
    // CONTACT
    // =========================

    whatsappNo: {
      type: String,
      trim: true,
    },

    callingNo: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // =========================
    // ADDRESS
    // =========================

    permanentAddress: {
      type: String,
      trim: true,
    },

    temporaryAddress: {
      type: String,
      trim: true,
    },

    // =========================
    // EMERGENCY CONTACT
    // =========================

    emergencyContacts: [
      {
        fullName: {
          type: String,
          trim: true,
          default: "",
        },

        number: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],
    // =========================
    // DOCUMENTS
    // =========================

    documents: {
      aadharCard: [
        {
          publicId: String,
          url: String,
          originalName: String,
          mimeType: String,
          size: Number,
        },
      ],

      photo: {
        publicId: String,
        url: String,
        originalName: String,
        mimeType: String,
        size: Number,
      },

      bankDetails: {
        publicId: String,
        url: String,
        originalName: String,
        mimeType: String,
        size: Number,
      },
    },

    // =========================
    // LOGIN
    // =========================

    itLoginAllowed: {
      type: Boolean,
      default: false,
    },
    loginEnabled: {
      type: Boolean,
      default: false,
    },
    loginId: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
    },

    password: {
      type: String,
      select: false,
    },
    // =========================
    // WORK DETAILS
    // =========================

    workingHours: {
      type: Number,
      min: 0,
      max: 24,
      default: 9,
    },
    halfDayHours: {
      type: Number,
      min: 0,
      max: 24,
      default: 5,
    },
    // =========================
    // SYSTEM
    // =========================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

employeeSchema.index({
  employeeName: "text",
  employeeId: "text",
  email: "text",
});

module.exports = mongoose.model("Employee", employeeSchema);