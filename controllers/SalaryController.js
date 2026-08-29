const Salary = require("../models/salary.model");
const Employee = require("../models/employee.model");
const Attendance = require("../models/attendance.model");

const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");

// ============================================================
// CONSTANTS
// ============================================================

const COMPANY_TIMEZONE = "Asia/Kolkata";
const PAYROLL_DAYS = 30; // Standard days for salary calculation
const MAX_WEEKLY_OFFS = 4; // Maximum weekly offs in a month

// ============================================================
// HELPERS
// ============================================================

const roundAmount = (amount) => {
  return Math.round((Number(amount) || 0) * 100) / 100;
};

const getDaysInMonth = (month, year) => {
  const actualDays = new Date(Number(year), Number(month), 0).getDate();

  return actualDays === 31 ||
    actualDays === 30 ||
    actualDays === 29 ||
    actualDays === 28
    ? 30
    : actualDays;
};

// ============================================================
// GET IST MONTH DATE RANGE
// ============================================================

const getMonthDateRange = (month, year) => {
  const startDate = new Date(
    `${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`,
  );

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const endDate = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`,
  );

  return {
    startDate,
    endDate,
  };
};
// ============================================================
// GET PREVIOUS SALARY PERIOD
// ============================================================

const getPreviousMonthYear = (month, year) => {
  const currentMonth = Number(month);
  const currentYear = Number(year);

  if (currentMonth === 1) {
    return {
      month: 12,
      year: currentYear - 1,
    };
  }

  return {
    month: currentMonth - 1,
    year: currentYear,
  };
};
// ============================================================
// CALCULATE PRESENT DAYS (All days including Thursday)
// ============================================================

const calculatePresentDays = (attendance = []) => {
  return roundAmount(
    attendance.reduce((total, item) => {
      const status = Number(item?.status || 0);
      // Full day
      if (status === 1) {
        return total + 1;
      }
      // Half day
      if (status === 0.5) {
        return total + 0.5;
      }
      // Absent
      return total;
    }, 0),
  );
};

// ============================================================
// CALCULATE PER DAY SALARY
// ============================================================

const calculatePerDaySalary = (monthlySalary) => {
  const salary = Number(monthlySalary) || 0;
  if (salary <= 0) {
    return 0;
  }
  return roundAmount(salary / PAYROLL_DAYS);
};

// ============================================================
// CHECK IF DATE IS THURSDAY
// ============================================================

const isThursday = (date) => {
  const d = new Date(date);
  return d.getDay() === 4;
};

// ============================================================
// CALCULATE APPLICABLE ABSENT DAYS (Non-Thursday absences only)
// ============================================================

const calculateApplicableAbsentDays = (attendance = []) => {
  // Only count absences on NON-Thursday days
  const applicableAbsences = attendance.filter((item) => {
    const status = Number(item?.status || 0);
    const date = new Date(item.attendanceDate);
    return status === 0 && !isThursday(date); // Absent and not Thursday
  });

  return roundAmount(applicableAbsences.length);
};

// ============================================================
// CALCULATE ELIGIBLE ATTENDANCE DAYS (For weekly off calculation)
// ============================================================

const calculateEligibleAttendanceDays = (attendance = []) => {
  // Count days with status > 0 (present, half-day, etc.)
  // Exclude Thursdays from eligibility calculation
  const eligibleDays = attendance.filter((item) => {
    const status = Number(item?.status || 0);
    const date = new Date(item.attendanceDate);
    return status > 0 && !isThursday(date); // Present on non-Thursday
  });

  return roundAmount(
    eligibleDays.reduce((total, item) => {
      const status = Number(item?.status || 0);
      return total + (status === 1 ? 1 : status === 0.5 ? 0.5 : 0);
    }, 0),
  );
};

// ============================================================
// CALCULATE WEEKLY OFF ELIGIBILITY
// ============================================================

const calculateWeeklyOffEligibility = (eligibleAttendanceDays) => {
  // For every 7 days of eligible attendance, employee gets 1 weekly off
  const weeklyOffs = Math.floor(eligibleAttendanceDays / 7);
  return Math.min(weeklyOffs, MAX_WEEKLY_OFFS);
};

// ============================================================
// CALCULATE PAYABLE SALARY
// ============================================================

const calculatePayableSalary = ({
  monthlySalary = 0,
  attendance = [],
  paidLeaveDays = 0,
  perDaySalary = 0,
  adjustedAmount = 0,
}) => {
  const salary = Number(monthlySalary) || 0;
  const dailySalary = Number(perDaySalary) || 0;
  const adjustment = Number(adjustedAmount) || 0;
  const leaveDays = Number(paidLeaveDays) || 0;

  // ==========================================================
  // TOTAL PRESENT DAYS (All days including Thursday)
  // ==========================================================

  const totalPresentDays = calculatePresentDays(attendance);

  // ==========================================================
  // APPLICABLE ABSENT DAYS (Absence on non-Thursday)
  // ==========================================================

  const applicableAbsentDays = calculateApplicableAbsentDays(attendance);

  // ==========================================================
  // ELIGIBLE ATTENDANCE DAYS (For weekly off calculation)
  // ==========================================================

  const eligibleAttendanceDays = calculateEligibleAttendanceDays(attendance);

  // ==========================================================
  // WEEKLY OFF ELIGIBILITY
  // ==========================================================

  const weeklyOffEligibility = calculateWeeklyOffEligibility(
    eligibleAttendanceDays,
  );

  // ==========================================================
  // PAYABLE DAYS
  // ==========================================================

  // IMPORTANT FIX: Payable days should be based on actual attendance
  // If employee has attendance records, use total present days + paid leaves
  // Otherwise, use 30 - applicable absent days (for full month employees)

  let payableDays;
  if (attendance.length > 0) {
    // If employee has attendance records, calculate based on present days
    // Payable days = Present Days + Paid Leaves (capped at 30)
    payableDays = Math.min(totalPresentDays + leaveDays, PAYROLL_DAYS);
  } else {
    // If no attendance records, assume full month minus absences
    payableDays = Math.max(PAYROLL_DAYS - applicableAbsentDays, 0);
  }

  // ==========================================================
  // ABSENCE DEDUCTION
  // ==========================================================

  const absenceDeduction = applicableAbsentDays * dailySalary;

  // ==========================================================
  // FINAL SALARY
  // ==========================================================

  // Calculate payable salary based on payable days
  const payableSalary = payableDays * dailySalary + adjustment;

  return {
    totalPresentDays: roundAmount(totalPresentDays),
    eligibleAttendanceDays: roundAmount(eligibleAttendanceDays),
    applicableAbsentDays: roundAmount(applicableAbsentDays),
    weeklyOffEligibility: roundAmount(weeklyOffEligibility),
    absenceDeduction: roundAmount(absenceDeduction),
    payableDays: roundAmount(Math.max(payableDays, 0)),
    payableSalary: roundAmount(Math.max(payableSalary, 0)),
  };
};

// ============================================================
// CALCULATE CURRENT DUE
// ============================================================

const calculateCurrentDue = ({
  previousDue = 0,
  payableSalary = 0,
  paidAmount = 0,
}) => {
  return roundAmount(
    (Number(previousDue) || 0) +
      (Number(payableSalary) || 0) -
      (Number(paidAmount) || 0),
  );
};
// ============================================================
// GET PREVIOUS MONTH CURRENT DUE
// ============================================================

const getPreviousMonthDue = async (employeeObjectId, month, year) => {
  const { month: previousMonth, year: previousYear } = getPreviousMonthYear(
    month,
    year,
  );

  const previousSalary = await Salary.findOne({
    employee: employeeObjectId,
    month: previousMonth,
    year: previousYear,
  })
    .select("currentDue")
    .lean();

  return roundAmount(previousSalary?.currentDue || 0);
};
// ============================================================
// ESCAPE REGEX
// ============================================================

const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ============================================================
// GET ATTENDANCE FOR EMPLOYEE + MONTH
// ============================================================

const getEmployeeMonthlyAttendance = async (employeeObjectId, month, year) => {
  const { startDate, endDate } = getMonthDateRange(month, year);

  return Attendance.find({
    employeeId: employeeObjectId,
    attendanceDate: {
      $gte: startDate,
      $lt: endDate,
    },
  })
    .sort({ attendanceDate: 1 })
    .select(
      "_id employeeId attendanceDate status inTime outTime totalMinutes overtimeMinutes deficitMinutes",
    )
    .lean();
};

// ============================================================
// CREATE ATTENDANCE BY DAY
// ============================================================

const createAttendanceByDay = (attendance = []) => {
  const attendanceByDay = {};

  attendance.forEach((item) => {
    const date = new Date(item.attendanceDate);

    const day = Number(
      new Intl.DateTimeFormat("en-IN", {
        timeZone: COMPANY_TIMEZONE,
        day: "numeric",
      }).format(date),
    );

    attendanceByDay[day] = {
      _id: item._id,
      date: item.attendanceDate,
      status: Number(item.status || 0),
      inTime: item.inTime,
      outTime: item.outTime,
      totalMinutes: item.totalMinutes,
      overtimeMinutes: item.overtimeMinutes,
      deficitMinutes: item.deficitMinutes,
      isThursday: isThursday(date),
    };
  });

  return attendanceByDay;
};

// ============================================================
// CALCULATE SALARY DATA
// ============================================================

const calculateSalaryData = ({
  attendance = [],
  paidLeaveDays = 0,
  monthlySalary = 0,
  adjustedAmount = 0,
  paidAmount = 0,
  previousDue = 0,
  month,
  year,
}) => {
  // ----------------------------------------------------------
  // NORMALIZE VALUES
  // ----------------------------------------------------------

  const normalizedPaidLeaveDays = Math.max(Number(paidLeaveDays) || 0, 0);
  const normalizedMonthlySalary = Math.max(Number(monthlySalary) || 0, 0);
  const normalizedAdjustedAmount = Number(adjustedAmount) || 0;
  const normalizedPaidAmount = Math.max(Number(paidAmount) || 0, 0);
  const normalizedPreviousDue = Number(previousDue) || 0;

  // ----------------------------------------------------------
  // TOTAL DAYS IN MONTH (Actual calendar days)
  // ----------------------------------------------------------

  const totalDaysInMonth = getDaysInMonth(month, year);
  // ----------------------------------------------------------
  // PER DAY SALARY
  // ----------------------------------------------------------

  const perDaySalary = calculatePerDaySalary(normalizedMonthlySalary);

  // ----------------------------------------------------------
  // CALCULATE PAYABLE SALARY
  // ----------------------------------------------------------

  const payableCalculation = calculatePayableSalary({
    monthlySalary: normalizedMonthlySalary,
    attendance,
    paidLeaveDays: normalizedPaidLeaveDays,
    perDaySalary,
    adjustedAmount: normalizedAdjustedAmount,
  });

  // ----------------------------------------------------------
  // EXTRACT CALCULATED VALUES
  // ----------------------------------------------------------

  const {
    totalPresentDays,
    eligibleAttendanceDays,
    applicableAbsentDays,
    weeklyOffEligibility,
    absenceDeduction,
    payableDays,
    payableSalary,
  } = payableCalculation;

  // ----------------------------------------------------------
  // CURRENT DUE
  // ----------------------------------------------------------

  const currentDue = calculateCurrentDue({
    previousDue: normalizedPreviousDue,
    payableSalary,
    paidAmount: normalizedPaidAmount,
  });

  // ----------------------------------------------------------
  // RETURN ALL DATA
  // ----------------------------------------------------------

  return {
    // Attendance
    totalPresentDays,
    eligibleAttendanceDays,
    applicableAbsentDays,
    weeklyOffEligibility,

    // Salary
    monthlySalary: normalizedMonthlySalary,
    perDaySalary,
    payableDays,
    absenceDeduction,

    // Adjustment
    adjustedAmount: normalizedAdjustedAmount,

    // Payable
    payableSalary,

    // Payment
    paidAmount: normalizedPaidAmount,
    previousDue: normalizedPreviousDue,
    currentDue,

    // Legacy compatibility
    paidLeaveDays: normalizedPaidLeaveDays,
    totalDaysInMonth,
  };
};

// ============================================================
// GET SALARIES
// ============================================================

const getSalaries = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    employeeId = "",
    month = "",
    year = "",
  } = req.query;

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (pageNumber - 1) * limitNumber;

  // ==========================================================
  // DEFAULT PERIOD
  // ==========================================================

  const now = new Date();
  const currentMonth = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: COMPANY_TIMEZONE,
      month: "numeric",
    }).format(now),
  );
  const currentYear = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: COMPANY_TIMEZONE,
      year: "numeric",
    }).format(now),
  );

  const selectedMonth = month ? Number(month) : currentMonth;
  const selectedYear = year ? Number(year) : currentYear;

  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (
    !Number.isInteger(selectedMonth) ||
    selectedMonth < 1 ||
    selectedMonth > 12
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid month",
    });
  }

  if (!Number.isInteger(selectedYear) || selectedYear < 2000) {
    return res.status(400).json({
      success: false,
      message: "Invalid year",
    });
  }

  // ==========================================================
  // EMPLOYEE FILTER
  // ==========================================================

  const employeeFilter = {};

  if (employeeId?.trim()) {
    employeeFilter.employeeId = employeeId.trim();
  }

  // ==========================================================
  // SEARCH
  // ==========================================================

  if (search?.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), "i");

    employeeFilter.$or = [
      {
        employeeName: regex,
      },
      {
        employeeId: regex,
      },
      {
        email: regex,
      },
    ];
  }

  // ==========================================================
  // MONTH RANGE
  // ==========================================================

  const { startDate, endDate } = getMonthDateRange(selectedMonth, selectedYear);

  // ==========================================================
  // SALARY LOOKUP
  // ==========================================================

  const salaryMatch = {
    month: selectedMonth,
    year: selectedYear,
  };

  // ==========================================================
  // AGGREGATION
  // ==========================================================

  const pipeline = [
    // --------------------------------------------------------
    // EMPLOYEES
    // --------------------------------------------------------

    {
      $match: employeeFilter,
    },

    // --------------------------------------------------------
    // SALARY
    // --------------------------------------------------------

    {
      $lookup: {
        from: "salaries",
        let: {
          employeeObjectId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$employee", "$$employeeObjectId"],
              },
            },
          },
          {
            $match: salaryMatch,
          },
          {
            $limit: 1,
          },
        ],
        as: "salary",
      },
    },

    // --------------------------------------------------------
    // UNWIND SALARY
    // --------------------------------------------------------

    {
      $unwind: {
        path: "$salary",
        preserveNullAndEmptyArrays: true,
      },
    },

    // --------------------------------------------------------
    // ATTENDANCE
    // --------------------------------------------------------

    {
      $lookup: {
        from: "attendances",
        let: {
          employeeObjectId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$employeeId", "$$employeeObjectId"],
              },
              attendanceDate: {
                $gte: startDate,
                $lt: endDate,
              },
            },
          },
          {
            $sort: {
              attendanceDate: 1,
            },
          },
          {
            $project: {
              _id: 1,
              employeeId: 1,
              attendanceDate: 1,
              status: 1,
              inTime: 1,
              outTime: 1,
              totalMinutes: 1,
              overtimeMinutes: 1,
              deficitMinutes: 1,
            },
          },
        ],
        as: "attendance",
      },
    },

    // --------------------------------------------------------
    // SORT
    // --------------------------------------------------------

    {
      $sort: {
        employeeName: 1,
      },
    },

    // --------------------------------------------------------
    // PAGINATION
    // --------------------------------------------------------

    {
      $facet: {
        data: [
          {
            $skip: skip,
          },
          {
            $limit: limitNumber,
          },
        ],
        total: [
          {
            $count: "count",
          },
        ],
      },
    },
  ];

  const [result] = await Employee.aggregate(pipeline);
  const employees = result?.data || [];
  const total = result?.total?.[0]?.count || 0;

  // ==========================================================
  // NORMALIZE RESPONSE
  // ==========================================================

  const salaries = await Promise.all(
    employees.map(async (employee) => {
      const salary = employee.salary || {};
      const attendance = employee.attendance || [];

      // ========================================================
      // GET PREVIOUS MONTH DUE DYNAMICALLY
      // ========================================================

      const previousMonthDue = await getPreviousMonthDue(
        employee._id,
        selectedMonth,
        selectedYear,
      );

      // ========================================================
      // CALCULATE EVERYTHING DYNAMICALLY
      // ========================================================

      const calculated = calculateSalaryData({
        attendance,
        paidLeaveDays: salary.paidLeaveDays || 0,
        monthlySalary: salary.monthlySalary || 0,
        adjustedAmount: salary.adjustedAmount || 0,
        paidAmount: salary.paidAmount || 0,

        // Previous month's currentDue
        previousDue: previousMonthDue,

        month: selectedMonth,
        year: selectedYear,
      });

      // ========================================================
      // RETURN SALARY DATA
      // ========================================================

      return {
        _id: salary._id || null,

        employee: {
          _id: employee._id,
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          department: employee.department,
          designation: employee.designation,
          level: employee.level,
          role: employee.role,
          status: employee.status,
        },

        employeeId: employee.employeeId,
        employeeName: employee.employeeName,

        month: selectedMonth,
        year: selectedYear,

        totalDays: calculated.totalDaysInMonth,

        // ======================================================
        // ATTENDANCE
        // ======================================================

        attendance,

        attendanceByDay: createAttendanceByDay(attendance),

        totalPresentDays: calculated.totalPresentDays,

        eligibleAttendanceDays: calculated.eligibleAttendanceDays,

        applicableAbsentDays: calculated.applicableAbsentDays,

        weeklyOffEligibility: calculated.weeklyOffEligibility,

        // ======================================================
        // SALARY
        // ======================================================

        monthlySalary: calculated.monthlySalary,

        perDaySalary: calculated.perDaySalary,

        payableDays: calculated.payableDays,

        // ======================================================
        // DEDUCTIONS
        // ======================================================

        absenceDeduction: calculated.absenceDeduction,

        paidLeaveDays: calculated.paidLeaveDays,

        // ======================================================
        // ADJUSTMENT
        // ======================================================

        adjustedAmount: calculated.adjustedAmount,

        adjustmentDetails: salary.adjustmentDetails || {
          specialPerks: [],
          deductions: [],
        },

        // ======================================================
        // PAYABLE
        // ======================================================

        payableSalary: calculated.payableSalary,

        // ======================================================
        // PAYMENT
        // ======================================================

        paidAmount: calculated.paidAmount,

        paidAmountDetails: salary.paidAmountDetails || {
          advanceAmount: [],
          deductedAmount: {
            label: "",
            amount: 0,
            comments: "",
          },
        },

        // ======================================================
        // DUE
        // ======================================================

        previousDue: calculated.previousDue,

        currentDue: calculated.currentDue,

        // ======================================================
        // COMMENTS
        // ======================================================

        comments: salary.comments || "",

        // ======================================================
        // STATUS
        // ======================================================

        salaryExists: !!salary._id,
      };
    }),
  );

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages = Math.ceil(total / limitNumber);

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return res.status(200).json({
    success: true,
    data: salaries,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages,
      hasNextPage: pageNumber < totalPages,
      hasPreviousPage: pageNumber > 1,
    },
  });
});

// ============================================================
// GET EMPLOYEE SALARY
// ============================================================

const getEmployeeSalary = asyncHandler(async (req, res) => {
  const { employeeId, month, year } = req.query;

  // --------------------------------------------------------
  // VALIDATION
  // --------------------------------------------------------

  if (!employeeId) {
    throw new ApiError(400, "Employee ID is required.");
  }

  if (!month || !year) {
    throw new ApiError(400, "Month and year are required.");
  }

  const salaryMonth = Number(month);
  const salaryYear = Number(year);

  if (!Number.isInteger(salaryMonth) || salaryMonth < 1 || salaryMonth > 12) {
    throw new ApiError(400, "Invalid month.");
  }

  if (!Number.isInteger(salaryYear) || salaryYear < 2000) {
    throw new ApiError(400, "Invalid year.");
  }

  // --------------------------------------------------------
  // FIND EMPLOYEE
  // --------------------------------------------------------

  const employee = await Employee.findOne({
    employeeId: employeeId.trim(),
  })
    .select(
      "_id employeeId employeeName department designation level role status",
    )
    .lean();

  if (!employee) {
    throw new ApiError(404, "Employee not found.");
  }

  // --------------------------------------------------------
  // FIND SALARY
  // --------------------------------------------------------

  const salary = await Salary.findOne({
    employee: employee._id,
    month: salaryMonth,
    year: salaryYear,
  }).lean();

  // --------------------------------------------------------
  // GET ATTENDANCE DIRECTLY
  // --------------------------------------------------------

  const attendance = await getEmployeeMonthlyAttendance(
    employee._id,
    salaryMonth,
    salaryYear,
  );

  // --------------------------------------------------------
  // CALCULATE SALARY
  // --------------------------------------------------------
  const previousMonthDue = await getPreviousMonthDue(
    employee._id,
    salaryMonth,
    salaryYear,
  );
  const calculated = calculateSalaryData({
    attendance,
    paidLeaveDays: salary?.paidLeaveDays || 0,
    monthlySalary: salary?.monthlySalary || 0,
    adjustedAmount: salary?.adjustedAmount || 0,
    paidAmount: salary?.paidAmount || 0,
    previousDue: previousMonthDue,
    month: salaryMonth,
    year: salaryYear,
  });

  // --------------------------------------------------------
  // RESPONSE
  // --------------------------------------------------------

  return res.status(200).json({
    success: true,
    data: {
      _id: salary?._id || null,

      employee,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,

      month: salaryMonth,
      year: salaryYear,
      totalDays: calculated.totalDaysInMonth,

      // Attendance
      attendance,
      attendanceByDay: createAttendanceByDay(attendance),
      totalPresentDays: calculated.totalPresentDays,
      eligibleAttendanceDays: calculated.eligibleAttendanceDays,
      applicableAbsentDays: calculated.applicableAbsentDays,
      weeklyOffEligibility: calculated.weeklyOffEligibility,

      // Salary
      monthlySalary: calculated.monthlySalary,
      perDaySalary: calculated.perDaySalary,
      payableDays: calculated.payableDays,

      // Deductions
      absenceDeduction: calculated.absenceDeduction,
      paidLeaveDays: calculated.paidLeaveDays,

      // Adjustment
      adjustedAmount: calculated.adjustedAmount,
      adjustmentDetails: salary?.adjustmentDetails || "",

      // Payable
      payableSalary: calculated.payableSalary,

      // Payment
      paidAmount: calculated.paidAmount,
      paidAmountDetails: salary?.paidAmountDetails || "",

      // Due
      previousDue: calculated.previousDue,
      currentDue: calculated.currentDue,

      // Comments
      comments: salary?.comments || "",

      // Status
      salaryExists: !!salary?._id,
    },
  });
});

// ============================================================
// CREATE / UPDATE SALARY
// ============================================================
// ============================================================
// SAFE SALARY DETAIL NORMALIZERS
// ============================================================

const normalizeAdjustmentDetails = (details) => {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {
      specialPerks: [],
      deductions: [],
    };
  }

  return {
    specialPerks: Array.isArray(details.specialPerks)
      ? details.specialPerks
      : [],

    deductions: Array.isArray(details.deductions) ? details.deductions : [],
  };
};

const normalizePaidAmountDetails = (details = {}) => {
  // ============================================================
  // NORMALIZE ADVANCE AMOUNT
  // ============================================================

  let advanceAmount = [];

  // New format: array
  if (Array.isArray(details?.advanceAmount)) {
    advanceAmount = details.advanceAmount
      .map((item) => ({
        label: typeof item?.label === "string" ? item.label.trim() : "",

        amount: Math.max(Number(item?.amount) || 0, 0),

        comments:
          typeof item?.comments === "string" ? item.comments.trim() : "",
      }))
      .filter((item) => item.label || item.amount > 0 || item.comments);
  }

  // Legacy format: object
  else if (
    details?.advanceAmount &&
    typeof details.advanceAmount === "object"
  ) {
    const legacyAdvance = {
      label:
        typeof details.advanceAmount.label === "string"
          ? details.advanceAmount.label.trim()
          : "",

      amount: Math.max(Number(details.advanceAmount.amount) || 0, 0),

      comments:
        typeof details.advanceAmount.comments === "string"
          ? details.advanceAmount.comments.trim()
          : "",
    };

    // Only add legacy object when it actually contains data
    if (
      legacyAdvance.label ||
      legacyAdvance.amount > 0 ||
      legacyAdvance.comments
    ) {
      advanceAmount.push(legacyAdvance);
    }
  }

  // ============================================================
  // NORMALIZE DEDUCTED AMOUNT
  // ============================================================

  const deductedAmount = {
    label:
      typeof details?.deductedAmount?.label === "string"
        ? details.deductedAmount.label.trim()
        : "",

    amount: Math.max(Number(details?.deductedAmount?.amount) || 0, 0),

    comments:
      typeof details?.deductedAmount?.comments === "string"
        ? details.deductedAmount.comments.trim()
        : "",
  };

  return {
    advanceAmount,
    deductedAmount,
  };
};
const upsertEmployeeSalary = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;

  const {
    month,
    year,
    paidLeaveDays,
    monthlySalary,
    adjustmentDetails,
    paidAmountDetails,

    comments,
  } = req.body;

  // ============================================================
  // VALIDATION
  // ============================================================

  if (!employeeId || typeof employeeId !== "string") {
    throw new ApiError(400, "Employee ID is required.");
  }

  const salaryMonth = Number(month);
  const salaryYear = Number(year);

  if (!Number.isInteger(salaryMonth) || salaryMonth < 1 || salaryMonth > 12) {
    throw new ApiError(400, "Valid month is required.");
  }

  if (!Number.isInteger(salaryYear) || salaryYear < 2000) {
    throw new ApiError(400, "Valid year is required.");
  }

  // ============================================================
  // FIND EMPLOYEE
  // ============================================================

  const employee = await Employee.findOne({
    employeeId: employeeId.trim(),
  }).lean();

  if (!employee) {
    throw new ApiError(404, "Employee not found.");
  }

  // ============================================================
  // GET MONTH ATTENDANCE
  // ============================================================

  const attendance = await getEmployeeMonthlyAttendance(
    employee._id,
    salaryMonth,
    salaryYear,
  );

  // ============================================================
  // FIND EXISTING SALARY
  // ============================================================

  let salary = await Salary.findOne({
    employee: employee._id,
    month: salaryMonth,
    year: salaryYear,
  });

  // ============================================================
  // CREATE SALARY IF NOT EXISTS
  // ============================================================

  if (!salary) {
    salary = new Salary({
      employee: employee._id,

      employeeId: employee.employeeId,

      employeeName: employee.employeeName,

      month: salaryMonth,

      year: salaryYear,

      paidLeaveDays: 0,

      monthlySalary: 0,

      perDaySalary: 0,

      payableDays: 30,

      absenceDeduction: 0,

      adjustedAmount: 0,

      adjustmentDetails: {
        specialPerks: [],
        deductions: [],
      },

      payableSalary: 0,

      paidAmount: 0,

      paidAmountDetails: {
        advanceAmount: [],

        deductedAmount: {
          label: "",
          amount: 0,
          comments: "",
        },
      },

      previousDue: 0,

      currentDue: 0,

      comments: "",

      createdBy: req.user?._id || null,
    });
  }

  // ============================================================
  // IMPORTANT:
  // NORMALIZE LEGACY / CORRUPTED DATA
  // ============================================================

  const safeAdjustmentDetails = normalizeAdjustmentDetails(
    salary.adjustmentDetails,
  );

  const safePaidAmountDetails = normalizePaidAmountDetails(
    salary.paidAmountDetails,
  );

  // ============================================================
  // PAID LEAVE DAYS
  // ============================================================

  if (paidLeaveDays !== undefined) {
    const value = Number(paidLeaveDays);

    if (!Number.isFinite(value) || value < 0) {
      throw new ApiError(
        400,
        "Paid leave days must be a valid non-negative number.",
      );
    }

    salary.paidLeaveDays = value;
  }

  // ============================================================
  // MONTHLY SALARY
  // ============================================================

  if (monthlySalary !== undefined) {
    const value = Number(monthlySalary);

    if (!Number.isFinite(value) || value < 0) {
      throw new ApiError(
        400,
        "Monthly salary must be a valid non-negative number.",
      );
    }

    salary.monthlySalary = value;
  }

  // ============================================================
  // ADJUSTMENT DETAILS
  // ============================================================

  if (adjustmentDetails !== undefined) {
    if (
      !adjustmentDetails ||
      typeof adjustmentDetails !== "object" ||
      Array.isArray(adjustmentDetails)
    ) {
      throw new ApiError(400, "Invalid adjustment details.");
    }

    const specialPerks = Array.isArray(adjustmentDetails.specialPerks)
      ? adjustmentDetails.specialPerks
          .map((item) => ({
            label: typeof item?.label === "string" ? item.label.trim() : "",

            amount: Math.max(Number(item?.amount) || 0, 0),

            comments:
              typeof item?.comments === "string" ? item.comments.trim() : "",
          }))
          .filter((item) => item.label || item.amount > 0 || item.comments)
      : safeAdjustmentDetails.specialPerks;

    const deductions = Array.isArray(adjustmentDetails.deductions)
      ? adjustmentDetails.deductions
          .map((item) => ({
            label: typeof item?.label === "string" ? item.label.trim() : "",

            amount: Math.max(Number(item?.amount) || 0, 0),

            comments:
              typeof item?.comments === "string" ? item.comments.trim() : "",
          }))
          .filter((item) => item.label || item.amount > 0 || item.comments)
      : safeAdjustmentDetails.deductions;

    // IMPORTANT:
    // Replace the entire object.
    // Do NOT do:
    // salary.adjustmentDetails.specialPerks = ...

    salary.adjustmentDetails = {
      specialPerks,
      deductions,
    };
  } else {
    // Repair legacy corrupted data even when frontend
    // doesn't send adjustmentDetails.
    salary.adjustmentDetails = {
      specialPerks: safeAdjustmentDetails.specialPerks,
      deductions: safeAdjustmentDetails.deductions,
    };
  }

  // ============================================================
  // CALCULATE ADJUSTMENT
  // ============================================================

  const specialPerksTotal = salary.adjustmentDetails.specialPerks.reduce(
    (total, item) => total + (Number(item?.amount) || 0),
    0,
  );

  const deductionsTotal = salary.adjustmentDetails.deductions.reduce(
    (total, item) => total + (Number(item?.amount) || 0),
    0,
  );

  salary.adjustedAmount = roundAmount(specialPerksTotal - deductionsTotal);

  // ============================================================
  // PAID AMOUNT DETAILS
  // ============================================================

  if (paidAmountDetails !== undefined) {
    if (
      !paidAmountDetails ||
      typeof paidAmountDetails !== "object" ||
      Array.isArray(paidAmountDetails)
    ) {
      throw new ApiError(400, "Invalid paid amount details.");
    }

    // ==========================================================
    // ADVANCE AMOUNT - MULTIPLE PAYMENTS
    // ==========================================================

    let advanceAmount = [];

    if (Array.isArray(paidAmountDetails.advanceAmount)) {
      advanceAmount = paidAmountDetails.advanceAmount
        .map((item) => ({
          label: typeof item?.label === "string" ? item.label.trim() : "",

          amount: Math.max(Number(item?.amount) || 0, 0),

          comments:
            typeof item?.comments === "string" ? item.comments.trim() : "",
        }))
        .filter((item) => item.label || item.amount > 0 || item.comments);
    } else if (
      paidAmountDetails.advanceAmount &&
      typeof paidAmountDetails.advanceAmount === "object"
    ) {
      // ========================================================
      // LEGACY SINGLE ADVANCE SUPPORT
      // ========================================================

      const legacyAdvance = {
        label:
          typeof paidAmountDetails.advanceAmount.label === "string"
            ? paidAmountDetails.advanceAmount.label.trim()
            : "",

        amount: Math.max(
          Number(paidAmountDetails.advanceAmount.amount) || 0,
          0,
        ),

        comments:
          typeof paidAmountDetails.advanceAmount.comments === "string"
            ? paidAmountDetails.advanceAmount.comments.trim()
            : "",
      };

      if (
        legacyAdvance.label ||
        legacyAdvance.amount > 0 ||
        legacyAdvance.comments
      ) {
        advanceAmount.push(legacyAdvance);
      }
    }

    // ==========================================================
    // DEDUCTED AMOUNT
    // ==========================================================

    const deductedAmount = {
      label:
        typeof paidAmountDetails?.deductedAmount?.label === "string"
          ? paidAmountDetails.deductedAmount.label.trim()
          : "",

      amount: Math.max(
        Number(paidAmountDetails?.deductedAmount?.amount) || 0,
        0,
      ),

      comments:
        typeof paidAmountDetails?.deductedAmount?.comments === "string"
          ? paidAmountDetails.deductedAmount.comments.trim()
          : "",
    };

    // ==========================================================
    // REPLACE ENTIRE PAYMENT DETAILS OBJECT
    // ==========================================================

    salary.paidAmountDetails = {
      advanceAmount,
      deductedAmount,
    };
  } else {
    // ============================================================
    // REPAIR LEGACY / CORRUPTED PAYMENT DETAILS
    // ============================================================

    salary.paidAmountDetails = safePaidAmountDetails;
  }

  // ============================================================
  // CALCULATE PAID AMOUNT
  // ============================================================

  const totalAdvanceAmount = (
    salary.paidAmountDetails?.advanceAmount || []
  ).reduce((total, item) => total + (Number(item?.amount) || 0), 0);

  const deductedAmount =
    Number(salary.paidAmountDetails?.deductedAmount?.amount) || 0;

  // ============================================================
  // VALIDATION
  // ============================================================

  if (deductedAmount > totalAdvanceAmount) {
    throw new ApiError(
      400,
      "Deducted amount cannot be greater than total advance amount.",
    );
  }

  // ============================================================
  // FINAL PAID AMOUNT
  // ============================================================

  salary.paidAmount = roundAmount(totalAdvanceAmount - deductedAmount);
  // ============================================================
  // PREVIOUS DUE
  // ============================================================
  // ============================================================
  // PREVIOUS DUE - AUTOMATICALLY CARRY FORWARD
  // ============================================================

  const previousMonthDue = await getPreviousMonthDue(
    employee._id,
    salaryMonth,
    salaryYear,
  );

  salary.previousDue = previousMonthDue;

  // ============================================================
  // COMMENTS
  // ============================================================

  if (comments !== undefined) {
    salary.comments = typeof comments === "string" ? comments.trim() : "";
  }

  // ============================================================
  // EMPLOYEE SNAPSHOT
  // ============================================================

  salary.employeeId = employee.employeeId;

  salary.employeeName = employee.employeeName;

  // ============================================================
  // RECALCULATE SALARY
  // ============================================================

  const calculated = calculateSalaryData({
    attendance,
    paidLeaveDays: salary.paidLeaveDays || 0,
    monthlySalary: salary.monthlySalary || 0,
    adjustedAmount: salary.adjustedAmount || 0,
    paidAmount: salary.paidAmount || 0,

    // IMPORTANT:
    // Previous month's currentDue becomes
    // current month's previousDue
    previousDue: previousMonthDue,

    month: salaryMonth,
    year: salaryYear,
  });

  // ============================================================
  // SAVE ATTENDANCE CALCULATIONS
  // ============================================================

  salary.totalPresentDays = calculated.totalPresentDays;

  salary.eligibleAttendanceDays = calculated.eligibleAttendanceDays;

  salary.applicableAbsentDays = calculated.applicableAbsentDays;

  salary.weeklyOffEligibility = calculated.weeklyOffEligibility;

  // ============================================================
  // SAVE SALARY CALCULATIONS
  // ============================================================

  salary.monthlySalary = calculated.monthlySalary;

  salary.perDaySalary = calculated.perDaySalary;

  salary.payableDays = calculated.payableDays;

  salary.absenceDeduction = calculated.absenceDeduction;

  salary.paidLeaveDays = calculated.paidLeaveDays;

  salary.adjustedAmount = calculated.adjustedAmount;

  salary.payableSalary = calculated.payableSalary;

  salary.paidAmount = calculated.paidAmount;

  salary.previousDue = calculated.previousDue;

  salary.currentDue = calculated.currentDue;

  // ============================================================
  // AUDIT
  // ============================================================

  salary.updatedBy = req.user?._id || null;

  // ============================================================
  // SAVE
  // ============================================================

  await salary.save();

  // ============================================================
  // RESPONSE
  // ============================================================

  const salaryData = salary.toObject();

  return res.status(200).json({
    success: true,

    message: "Salary saved successfully.",

    data: {
      ...salaryData,

      attendance,

      attendanceByDay: createAttendanceByDay(attendance),

      totalDays: calculated.totalDaysInMonth,

      totalPresentDays: calculated.totalPresentDays,

      eligibleAttendanceDays: calculated.eligibleAttendanceDays,

      applicableAbsentDays: calculated.applicableAbsentDays,

      weeklyOffEligibility: calculated.weeklyOffEligibility,

      absenceDeduction: calculated.absenceDeduction,

      payableDays: calculated.payableDays,

      paidLeaveDays: calculated.paidLeaveDays,

      monthlySalary: calculated.monthlySalary,

      perDaySalary: calculated.perDaySalary,

      payableSalary: calculated.payableSalary,

      adjustedAmount: calculated.adjustedAmount,

      paidAmount: calculated.paidAmount,

      previousDue: calculated.previousDue,

      currentDue: calculated.currentDue,

      salaryExists: true,
    },
  });
});

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getSalaries,
  getEmployeeSalary,
  upsertEmployeeSalary,
};