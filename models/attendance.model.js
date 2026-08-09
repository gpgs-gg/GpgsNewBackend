const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    // =========================
    // EMPLOYEE
    // =========================

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // =========================
    // ATTENDANCE DATE
    // =========================

    attendanceDate: {
      type: Date,
      required: true,
    },

    // =========================
    // CHECK IN / OUT
    // =========================

    inTime: {
      type: Date,
      default: null,
    },

    outTime: {
      type: Date,
      default: null,
    },

    // =========================
    // SELFIES
    // =========================

    inSelfie: {
      publicId: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: null,
      },
    },

    outSelfie: {
      publicId: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: null,
      },
    },

    // =========================
    // CALCULATED HOURS
    // =========================

    totalMinutes: {
      type: Number,
      default: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
    },

    deficitMinutes: {
      type: Number,
      default: 0,
    },

    // =========================
    // STATUS
    // =========================

    status: {
      type: Number,
      enum: [0, 0.5, 1],
      default: 0,
    },

    // =========================
    // ADMIN REMARK
    // =========================

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    // =========================
    // AUDIT
    // =========================

    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// One attendance record per employee per day
attendanceSchema.index(
  {
    employeeId: 1,
    attendanceDate: 1,
  },
  {
    unique: true,
  },
);

attendanceSchema.index({
  attendanceDate: -1,
});

attendanceSchema.index({
  employeeId: 1,
  attendanceDate: -1,
});

attendanceSchema.index({
  status: 1,
  attendanceDate: -1,
});

module.exports = mongoose.model("Attendance", attendanceSchema);