const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema(
  {
    // =====================================================
    // EMPLOYEE REFERENCE
    // =====================================================

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // Snapshot values
    employeeId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    employeeName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // =====================================================
    // SALARY PERIOD
    // =====================================================

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },

    year: {
      type: Number,
      required: true,
      min: 2000,
      index: true,
    },

    // =====================================================
    // ATTENDANCE DETAILS
    // =====================================================

    // Total present days (all days including Thursday)
    totalPresentDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Eligible attendance days (present on non-Thursday days)
    eligibleAttendanceDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Applicable absent days (absent on non-Thursday days)
    applicableAbsentDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Weekly off eligibility (0-4)
    weeklyOffEligibility: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
    },

    // =====================================================
    // PAID LEAVES (Optional)
    // =====================================================

    paidLeaveDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // SALARY
    // =====================================================

    monthlySalary: {
      type: Number,
      required: true,
      min: 0,
    },

    // monthlySalary / 30
    perDaySalary: {
      type: Number,
      required: true,
      min: 0,
    },

    // Payable days (30 - applicableAbsentDays)
    payableDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 30,
    },

    // =====================================================
    // ABSENCE DEDUCTION
    // =====================================================

    absenceDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // ADJUSTMENT
    // =====================================================

    adjustedAmount: {
      type: Number,
      default: 0,
    },

    adjustmentDetails: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================================
    // PAYABLE
    // =====================================================

    payableSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // PAYMENT
    // =====================================================

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidAmountDetails: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================================
    // DUE
    // =====================================================

    previousDue: {
      type: Number,
      default: 0,
    },

    currentDue: {
      type: Number,
      default: 0,
    },

    // =====================================================
    // COMMENTS
    // =====================================================

    comments: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================================
    // AUDIT
    // =====================================================

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

// =====================================================
// ONE SALARY RECORD PER EMPLOYEE PER MONTH
// =====================================================

salarySchema.index(
  {
    employee: 1,
    month: 1,
    year: 1,
  },
  {
    unique: true,
  },
);

// =====================================================
// SEARCH INDEX
// =====================================================

salarySchema.index({ employeeName: "text", employeeId: "text" });

// =====================================================
// COMPOUND INDEX FOR PERFORMANCE
// =====================================================

salarySchema.index({ employeeId: 1, month: 1, year: 1 });
salarySchema.index({ employee: 1, month: 1 });

module.exports = mongoose.model("Salary", salarySchema);