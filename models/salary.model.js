const mongoose = require("mongoose");

// =====================================================
// ADJUSTMENT ITEM SCHEMA
// =====================================================

const adjustmentItemSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default: "",
      trim: true,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    comments: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  },
);

// =====================================================
// ADJUSTMENT DETAILS SCHEMA
// =====================================================

const adjustmentDetailsSchema = new mongoose.Schema(
  {
    specialPerks: {
      type: [adjustmentItemSchema],
      default: [],
    },

    deductions: {
      type: [adjustmentItemSchema],
      default: [],
    },
  },
  {
    _id: false,
  },
);

// =====================================================
// PAYMENT DETAIL SCHEMA
// =====================================================

const paymentDetailSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default: "",
      trim: true,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    comments: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  },
);

// =====================================================
// PAID AMOUNT DETAILS SCHEMA
// =====================================================

const paidAmountDetailsSchema = new mongoose.Schema(
  {
    // Multiple advance payment history
    advanceAmount: {
      type: [paymentDetailSchema],
      default: [],
    },

    // Single deduction
    deductedAmount: {
      type: paymentDetailSchema,
      default: () => ({}),
    },
  },
  {
    _id: false,
  },
);
// =====================================================
// SALARY SCHEMA
// =====================================================

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

    employeeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
    // ATTENDANCE
    // =====================================================

    totalPresentDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    eligibleAttendanceDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    applicableAbsentDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    weeklyOffEligibility: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
    },

    // =====================================================
    // PAID LEAVE
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
      default: 0,
      min: 0,
    },

    perDaySalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    payableDays: {
      type: Number,
      default: 30,
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
    // ADJUSTMENTS
    // =====================================================

    adjustedAmount: {
      type: Number,
      default: 0,
    },

    adjustmentDetails: {
      type: adjustmentDetailsSchema,
      default: () => ({}),
    },

    // =====================================================
    // PAYABLE SALARY
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
      type: paidAmountDetailsSchema,
      default: () => ({}),
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
      default: "",
      trim: true,
    },

    // =====================================================
    // AUDIT
    // =====================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// =====================================================
// UNIQUE SALARY PER EMPLOYEE / MONTH / YEAR
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
// SEARCH
// =====================================================

salarySchema.index({
  employeeName: "text",
  employeeId: "text",
});

// =====================================================
// PERFORMANCE INDEXES
// =====================================================

salarySchema.index({
  employeeId: 1,
  month: 1,
  year: 1,
});

module.exports = mongoose.model("Salary", salarySchema);