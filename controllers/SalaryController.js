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

  const salaries = employees.map((employee) => {
    const salary = employee.salary || {};
    const attendance = employee.attendance || [];

    // --------------------------------------------------------
    // CALCULATE EVERYTHING DYNAMICALLY
    // --------------------------------------------------------

    const calculated = calculateSalaryData({
      attendance,
      paidLeaveDays: salary.paidLeaveDays || 0,
      monthlySalary: salary.monthlySalary || 0,
      adjustedAmount: salary.adjustedAmount || 0,
      paidAmount: salary.paidAmount || 0,
      previousDue: salary.previousDue || 0,
      month: selectedMonth,
      year: selectedYear,
    });

    // --------------------------------------------------------
    // ATTENDANCE BY DAY
    // --------------------------------------------------------

    const attendanceByDay = createAttendanceByDay(attendance);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return {
      // Salary ID
      _id: salary._id || null,

      // ======================================================
      // EMPLOYEE
      // ======================================================

      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        department: employee.department,
        designation: employee.designation,
        status: employee.status,
      },

      employeeId: employee.employeeId,
      employeeName: employee.employeeName,

      // ======================================================
      // PERIOD
      // ======================================================

      month: selectedMonth,
      year: selectedYear,
      totalDays: calculated.totalDaysInMonth,

      // ======================================================
      // ATTENDANCE DETAILS
      // ======================================================

      attendance,
      attendanceByDay,
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
      adjustmentDetails: salary.adjustmentDetails || "",

      // ======================================================
      // PAYABLE
      // ======================================================

      payableSalary: calculated.payableSalary,

      // ======================================================
      // PAYMENT
      // ======================================================

      paidAmount: calculated.paidAmount,
      paidAmountDetails: salary.paidAmountDetails || "",

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
  });

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

  const calculated = calculateSalaryData({
    attendance,
    paidLeaveDays: salary?.paidLeaveDays || 0,
    monthlySalary: salary?.monthlySalary || 0,
    adjustedAmount: salary?.adjustedAmount || 0,
    paidAmount: salary?.paidAmount || 0,
    previousDue: salary?.previousDue || 0,
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

const upsertEmployeeSalary = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const {
    month,
    year,
    paidLeaveDays,
    monthlySalary,
    adjustedAmount,
    adjustmentDetails,
    paidAmount,
    paidAmountDetails,
    previousDue,
    comments,
  } = req.body;

  // ========================================================
  // VALIDATION
  // ========================================================

  if (!employeeId) {
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

  // ========================================================
  // FIND EMPLOYEE
  // ========================================================

  const employee = await Employee.findOne({
    employeeId: employeeId.trim(),
  });

  if (!employee) {
    throw new ApiError(404, "Employee not found.");
  }

  // ========================================================
  // GET MONTH ATTENDANCE
  // ========================================================

  const attendance = await getEmployeeMonthlyAttendance(
    employee._id,
    salaryMonth,
    salaryYear,
  );

  // ========================================================
  // FIND EXISTING SALARY
  // ========================================================

  let salary = await Salary.findOne({
    employee: employee._id,
    month: salaryMonth,
    year: salaryYear,
  });

  // ========================================================
  // CREATE NEW SALARY IF NOT EXISTS
  // ========================================================

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
      adjustedAmount: 0,
      adjustmentDetails: "",
      payableSalary: 0,
      paidAmount: 0,
      paidAmountDetails: "",
      previousDue: 0,
      currentDue: 0,
      comments: "",
      createdBy: req.user?._id || null,
    });
  }

  // ========================================================
  // UPDATE ONLY PROVIDED VALUES
  // ========================================================

  // Paid Leave Days (Optional)
  if (paidLeaveDays !== undefined) {
    const value = Number(paidLeaveDays);
    if (value < 0) {
      throw new ApiError(400, "Paid leave days cannot be negative.");
    }
    salary.paidLeaveDays = value;
  }

  // Monthly Salary
  if (monthlySalary !== undefined) {
    const value = Number(monthlySalary);
    if (value < 0) {
      throw new ApiError(400, "Monthly salary cannot be negative.");
    }
    salary.monthlySalary = value;
  }

  // Adjustment
  if (adjustedAmount !== undefined) {
    salary.adjustedAmount = Number(adjustedAmount) || 0;
  }

  if (adjustmentDetails !== undefined) {
    salary.adjustmentDetails = adjustmentDetails?.trim() || "";
  }

  // Paid Amount
  if (paidAmount !== undefined) {
    const value = Number(paidAmount);
    if (value < 0) {
      throw new ApiError(400, "Paid amount cannot be negative.");
    }
    salary.paidAmount = value;
  }

  if (paidAmountDetails !== undefined) {
    salary.paidAmountDetails = paidAmountDetails?.trim() || "";
  }

  // Previous Due
  if (previousDue !== undefined) {
    salary.previousDue = Number(previousDue) || 0;
  }

  // Comments
  if (comments !== undefined) {
    salary.comments = comments?.trim() || "";
  }

  // ========================================================
  // SNAPSHOT EMPLOYEE DATA
  // ========================================================

  salary.employeeId = employee.employeeId;
  salary.employeeName = employee.employeeName;

  // ========================================================
  // RECALCULATE EVERYTHING
  // ========================================================

  const calculated = calculateSalaryData({
    attendance,
    paidLeaveDays: salary.paidLeaveDays,
    monthlySalary: salary.monthlySalary,
    adjustedAmount: salary.adjustedAmount,
    paidAmount: salary.paidAmount,
    previousDue: salary.previousDue,
    month: salaryMonth,
    year: salaryYear,
  });

  // ========================================================
  // SAVE CALCULATED VALUES
  // ========================================================

  // Attendance
  salary.totalPresentDays = calculated.totalPresentDays;
  salary.eligibleAttendanceDays = calculated.eligibleAttendanceDays;
  salary.applicableAbsentDays = calculated.applicableAbsentDays;
  salary.weeklyOffEligibility = calculated.weeklyOffEligibility;

  // Salary
  salary.monthlySalary = calculated.monthlySalary;
  salary.perDaySalary = calculated.perDaySalary;
  salary.payableDays = calculated.payableDays;

  // Deductions
  salary.absenceDeduction = calculated.absenceDeduction;
  salary.paidLeaveDays = calculated.paidLeaveDays;

  // Adjustment
  salary.adjustedAmount = calculated.adjustedAmount;

  // Payable
  salary.payableSalary = calculated.payableSalary;

  // Payment
  salary.paidAmount = calculated.paidAmount;
  salary.previousDue = calculated.previousDue;
  salary.currentDue = calculated.currentDue;

  // ========================================================
  // AUDIT
  // ========================================================

  salary.updatedBy = req.user?._id || null;

  // ========================================================
  // SAVE
  // ========================================================

  await salary.save();

  // ========================================================
  // RESPONSE
  // ========================================================

  return res.status(200).json({
    success: true,
    message: "Salary saved successfully.",
    data: {
      ...salary.toObject(),
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