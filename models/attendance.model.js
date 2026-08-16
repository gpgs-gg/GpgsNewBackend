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
      min: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    deficitMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================
    // STATUS
    // =========================
    // 1   = Present
    // 0.5 = Half Day
    // 0   = Absent

    status: {
      type: Number,
      enum: [0, 0.5, 1],
      default: 0,
    },

    // =========================
    // ATTENDANCE SOURCE
    // =========================
    // SELF   -> Employee checked in/out
    // ADMIN  -> Admin created/updated
    // HR     -> HR created/updated
    // SYSTEM -> System generated

    attendanceSource: {
      type: String,
      enum: ["EMPLOYEE", "ADMIN", "HR", "SYSTEM"],
      default: "EMPLOYEE",
    },
    // =========================
    // REMARKS
    // =========================

    remarks: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    // ==========================================
    // REGULARIZATION DOCUMENTS
    // Maximum 5 documents per attendance
    // ==========================================

    regularizationDocuments: [
      {
        publicId: {
          type: String,
          required: true,
        },

        url: {
          type: String,
          required: true,
        },

        originalName: {
          type: String,
          required: true,
        },

        mimeType: {
          type: String,
          required: true,
        },

        size: {
          type: Number,
          required: true,
        },
      },
    ],
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

// ======================================================
// ONE ATTENDANCE RECORD PER EMPLOYEE PER DAY
// ======================================================

attendanceSchema.index(
  {
    employeeId: 1,
    attendanceDate: 1,
  },
  {
    unique: true,
  },
);

// ======================================================
// QUERY INDEXES
// ======================================================

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