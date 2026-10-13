const mongoose = require("mongoose");

const attendanceRequestSchema = new mongoose.Schema(
  {
    // Employee who requested attendance correction
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    // Manager to whom the request is sent
    requestedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    // Attendance date to be corrected
    attendanceDate: {
      type: Date,
      required: true,
    },

    // Reason for the request
    reason: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional supporting attachment URL
    attachment: {
      type: String,
      default: "",
    },
    attendanceStatus: {
      type: Number,
      enum: [0, 0.5, 1, null],
      default: null,
    },
    approvedType: {
      type: String,
      enum: ["FULL_DAY", "HALF_DAY", "ABSENT", null],
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("AttendanceRequest", attendanceRequestSchema);