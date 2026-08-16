const mongoose = require("mongoose");

const Attendance = require("../models/attendance.model");
const Employee = require("../models/employee.model");
const User = require("../models/user.model");

const { uploadToCloudinary } = require("../utils/uploadToCloudinary");

// ======================================================
// CONSTANTS
// ======================================================
const uploadRegularizationDocument = async (file) => {
  if (!file) {
    return null;
  }

  if (!file.buffer) {
    throw new Error("Regularization document buffer not found");
  }

  const result = await uploadToCloudinary(
    file.buffer,
    "attendance/regularization-documents",
  );

  return {
    publicId: result?.public_id || null,
    url: result?.secure_url || null,
    originalName: file.originalname || null,
    mimeType: file.mimetype || null,
    size: file.size || null,
  };
};
// 9 hours = 540 minutes

const COMPANY_TIMEZONE = "Asia/Kolkata";
// fpr gettomg employee working hours
const getEmployeeWorkingMinutes = (employee) => {
  const workingHours = Number(employee?.workingHours);
  const halfDayHours = Number(employee?.halfDayHours);

  // Default full-day = 9 hours
  const requiredHours =
    Number.isFinite(workingHours) && workingHours > 0 ? workingHours : 9;

  const requiredMinutes = requiredHours * 60;

  // Default half-day = 5 hours
  const halfDayMinutes =
    Number.isFinite(halfDayHours) && halfDayHours > 0
      ? halfDayHours * 60
      : 5 * 60;

  return {
    requiredHours,
    requiredMinutes,
    halfDayHours: halfDayMinutes / 60,
    halfDayMinutes,
  };
};

// ======================================================
// HELPER: GET TODAY DATE IN COMPANY TIMEZONE
// ======================================================

const getTodayAttendanceDate = () => {
  const dateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  // Convert 2026-08-09 00:00 IST into UTC Date
  return new Date(`${dateString}T00:00:00+05:30`);
};
// ======================================================
// HELPER: GET EMPLOYEE FROM AUTHENTICATED USER
// ======================================================

// ======================================================
// HELPER: GET EMPLOYEE FROM AUTHENTICATED USER
// ======================================================

const getAuthenticatedEmployee = async (userId) => {
  if (!userId) {
    throw new Error("Authentication required");
  }

  const user = await User.findById(userId).select(
    "_id name email role employeeId isActive",
  );

  if (!user) {
    throw new Error("User not found");
  }

  // ======================================================
  // ADMIN + EMPLOYEE ARE ALLOWED
  // ======================================================

  const normalizedRole = String(user.role || "")
    .trim()
    .toLowerCase();

  if (!["employee", "admin"].includes(normalizedRole)) {
    throw new Error("Only Admin and Employee users can perform attendance");
  }

  // ======================================================
  // USER ACTIVE CHECK
  // ======================================================

  if (!user.isActive) {
    throw new Error("User account is inactive");
  }

  // ======================================================
  // FIND EMPLOYEE PROFILE
  // ======================================================

  let employee = null;

  // ------------------------------------------------------
  // 1. First priority: User.employeeId
  // ------------------------------------------------------

  if (user.employeeId && mongoose.Types.ObjectId.isValid(user.employeeId)) {
    employee = await Employee.findById(user.employeeId);
  }

  // ------------------------------------------------------
  // 2. Fallback: find employee using email
  // ------------------------------------------------------

  if (!employee && user.email) {
    const normalizedEmail = user.email.trim().toLowerCase();

    employee = await Employee.findOne({
      email: normalizedEmail,
    });
  }

  // ------------------------------------------------------
  // 3. Employee profile is mandatory for attendance
  // ------------------------------------------------------

  if (!employee) {
    throw new Error(
      "Employee profile not found. Please link this user with an employee profile.",
    );
  }

  // ======================================================
  // AUTO LINK USER -> EMPLOYEE
  // ======================================================

  if (!user.employeeId) {
    user.employeeId = employee._id;
    await user.save();
  }

  // ======================================================
  // EMPLOYEE STATUS
  // ======================================================

  if (
    employee.status &&
    String(employee.status).trim().toLowerCase() !== "active"
  ) {
    throw new Error("Employee is inactive");
  }

  // ======================================================
  // LOGIN ENABLED
  // ======================================================

  if (!employee.loginEnabled) {
    throw new Error("Employee login is disabled");
  }

  return {
    user,
    employee,
  };
};

// ======================================================
// HELPER: UPLOAD SELFIE
// ======================================================

// ======================================================
// HELPER: UPLOAD ATTENDANCE SELFIE
// ======================================================

const uploadAttendanceSelfie = async (file) => {
  if (!file) {
    throw new Error("Attendance selfie is required");
  }

  if (!file.buffer) {
    throw new Error("Attendance selfie buffer not found");
  }

  const result = await uploadToCloudinary(file.buffer, "attendance/selfies");

  return {
    publicId: result?.public_id || null,
    url: result?.secure_url || null,
  };
};

// ======================================================
// HELPER: CALCULATE ATTENDANCE HOURS
// ======================================================

const calculateAttendanceHours = (inTime, outTime, employee) => {
  if (!inTime || !outTime) {
    return {
      totalMinutes: 0,
      overtimeMinutes: 0,
      deficitMinutes: 0,
    };
  }

  const { requiredMinutes } = getEmployeeWorkingMinutes(employee);

  const start = new Date(inTime);
  const end = new Date(outTime);

  const totalMinutes = Math.max(0, Math.floor((end - start) / (1000 * 60)));

  const overtimeMinutes = Math.max(totalMinutes - requiredMinutes, 0);

  const deficitMinutes = Math.max(requiredMinutes - totalMinutes, 0);

  return {
    totalMinutes,
    overtimeMinutes,
    deficitMinutes,
  };
};

// ======================================================
// HELPER: FORMAT MINUTES
// ======================================================

const formatMinutes = (minutes = 0) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}H ${remainingMinutes}M`;
};
// ======================================================
// HELPER: GET ATTENDANCE STATUS
// ======================================================

const getAttendanceStatusLabel = (status) => {
  const numericStatus = Number(status);

  if (numericStatus === 1) {
    return "PRESENT";
  }

  if (numericStatus === 0.5) {
    return "HALF_DAY";
  }

  return "ABSENT";
};
// ======================================================
// HELPER: CALCULATE ATTENDANCE STATUS
// ======================================================

const calculateAttendanceStatus = (totalMinutes = 0, employee) => {
  if (!totalMinutes || totalMinutes <= 0) {
    return 0;
  }

  const { requiredMinutes, halfDayMinutes } =
    getEmployeeWorkingMinutes(employee);

  // Full Day
  if (totalMinutes >= requiredMinutes) {
    return 1;
  }

  // Half Day
  if (totalMinutes >= halfDayMinutes) {
    return 0.5;
  }

  // Absent
  return 0;
};

// ======================================================
// HELPER: CALCULATE REMAINING WORKING MINUTES
// ======================================================

const calculateRemainingMinutes = (inTime, outTime = null, employee) => {
  const { requiredMinutes } = getEmployeeWorkingMinutes(employee);

  if (!inTime) {
    return requiredMinutes;
  }

  const start = new Date(inTime);

  const end = outTime ? new Date(outTime) : new Date();

  const workedMinutes = Math.max(0, Math.floor((end - start) / (1000 * 60)));

  return Math.max(requiredMinutes - workedMinutes, 0);
};
// ======================================================
// 1. CHECK IN
// ======================================================

const checkIn = async (req, res) => {
  try {
    const { employee } = await getAuthenticatedEmployee(req.user?._id);

    const attendanceDate = getTodayAttendanceDate();

    // -----------------------------------------------
    // Check if attendance already exists
    // -----------------------------------------------
    const ATTENDANCE_TEST_MODE = true;

    // -----------------------------------------------
    // Check if attendance already exists
    // -----------------------------------------------

    const existingAttendance = await Attendance.findOne({
      employeeId: employee._id,
      attendanceDate,
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Employee has already checked in today",
        data: existingAttendance,
      });
    }
    // -----------------------------------------------
    // Selfie required
    // -----------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Check-in selfie is required",
      });
    }

    // -----------------------------------------------
    // Upload selfie
    // -----------------------------------------------

    const selfie = await uploadAttendanceSelfie(req.file);

    // -----------------------------------------------
    // Create attendance
    // -----------------------------------------------

    const attendance = await Attendance.create({
      employeeId: employee._id,

      attendanceDate,

      inTime: new Date(),

      inSelfie: {
        publicId: selfie.publicId,
        url: selfie.url,
      },
      status: 0,

      totalMinutes: 0,
      overtimeMinutes: 0,
      deficitMinutes: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Check-in successful",

      data: {
        attendance,
      },
    });
  } catch (error) {
    console.error("Check In Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to check in",
    });
  }
};

// ======================================================
// 2. CHECK OUT
// ======================================================

const checkOut = async (req, res) => {
  try {
    const { employee } = await getAuthenticatedEmployee(req.user?._id);

    const attendanceDate = getTodayAttendanceDate();

    // -----------------------------------------------
    // Find today's attendance
    // -----------------------------------------------

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      attendanceDate,
    }).populate(
      "employeeId",
      "employeeId employeeName department designation workingHours halfDayHours",
    );

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: "Please check in before checking out",
      });
    }

    // -----------------------------------------------
    // Check in exists
    // -----------------------------------------------

    if (!attendance.inTime) {
      return res.status(400).json({
        success: false,
        message: "Check-in time not found",
      });
    }

    // -----------------------------------------------
    // Already checked out
    // -----------------------------------------------

    if (attendance.outTime) {
      return res.status(400).json({
        success: false,
        message: "Employee has already checked out today",
        data: attendance,
      });
    }

    // -----------------------------------------------
    // Selfie required
    // -----------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Check-out selfie is required",
      });
    }

    // -----------------------------------------------
    // Upload selfie
    // -----------------------------------------------

    const selfie = await uploadAttendanceSelfie(req.file);

    const outTime = new Date();

    // -----------------------------------------------
    // Calculate working hours based on employee
    // -----------------------------------------------

    const { totalMinutes, overtimeMinutes, deficitMinutes } =
      calculateAttendanceHours(attendance.inTime, outTime, employee);

    // -----------------------------------------------
    // Update attendance
    // -----------------------------------------------

    attendance.outTime = outTime;

    attendance.outSelfie = {
      publicId: selfie.publicId,
      url: selfie.url,
    };

    attendance.totalMinutes = totalMinutes;

    attendance.overtimeMinutes = overtimeMinutes;

    attendance.deficitMinutes = deficitMinutes;

    // Employee-specific working hours
    attendance.status = calculateAttendanceStatus(totalMinutes, employee);

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Check-out successful",

      data: {
        attendance,

        summary: {
          totalHours: formatMinutes(totalMinutes),
          overtime: formatMinutes(overtimeMinutes),
          deficitHours: formatMinutes(deficitMinutes),
          status: attendance.status,
        },
      },
    });
  } catch (error) {
    console.error("Check Out Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to check out",
    });
  }
};

// ======================================================
// 3. GET TODAY'S ATTENDANCE
// ======================================================

// ======================================================
// 3. GET TODAY'S ATTENDANCE
// ======================================================

const getTodayAttendance = async (req, res) => {
  try {
    const { employee } = await getAuthenticatedEmployee(req.user?._id);

    const attendanceDate = getTodayAttendanceDate();

    // ==================================================
    // EMPLOYEE WORKING CONFIGURATION
    // ==================================================

    const workingConfig = getEmployeeWorkingMinutes(employee);

    // ==================================================
    // FIND TODAY'S ATTENDANCE
    // ==================================================

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      attendanceDate,
    }).populate(
      "employeeId",
      "employeeId employeeName department designation workingHours halfDayHours",
    );

    // ==================================================
    // NO ATTENDANCE YET
    // ==================================================

    if (!attendance) {
      return res.status(200).json({
        success: true,
        message: "No attendance found for today",
        data: {
          attendance: null,

          // Employee working configuration
          requiredWorkingMinutes: workingConfig.requiredMinutes,
          requiredWorkingHours: formatMinutes(workingConfig.requiredMinutes),

          halfDayWorkingMinutes: workingConfig.halfDayMinutes,
          halfDayWorkingHours: formatMinutes(workingConfig.halfDayMinutes),

          // No attendance means nothing worked yet
          remainingMinutes: workingConfig.requiredMinutes,
          remainingHours: formatMinutes(workingConfig.requiredMinutes),

          totalMinutes: 0,
          totalHours: "0H 0M",

          overtimeMinutes: 0,
          overtime: "0H 0M",

          deficitMinutes: 0,
          deficitHours: "0H 0M",

          status: 0,
          statusLabel: "ABSENT",
        },
      });
    }

    // ==================================================
    // REMAINING MINUTES
    // ==================================================

    const remainingMinutes = calculateRemainingMinutes(
      attendance.inTime,
      attendance.outTime,
      employee,
    );

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      data: {
        ...attendance.toObject(),

        statusLabel: getAttendanceStatusLabel(attendance.status),

        // Attendance totals
        totalMinutes: attendance.totalMinutes || 0,

        totalHours: formatMinutes(attendance.totalMinutes || 0),

        overtimeMinutes: attendance.overtimeMinutes || 0,

        overtime: formatMinutes(attendance.overtimeMinutes || 0),

        deficitMinutes: attendance.deficitMinutes || 0,

        deficitHours: formatMinutes(attendance.deficitMinutes || 0),

        // ==================================================
        // LIVE WORKING CONFIG
        // ==================================================

        requiredWorkingMinutes: workingConfig.requiredMinutes,

        requiredWorkingHours: formatMinutes(workingConfig.requiredMinutes),

        halfDayWorkingMinutes: workingConfig.halfDayMinutes,

        halfDayWorkingHours: formatMinutes(workingConfig.halfDayMinutes),

        // ==================================================
        // REMAINING TIME
        // ==================================================

        remainingMinutes,

        remainingHours: formatMinutes(remainingMinutes),
      },
    });
  } catch (error) {
    console.error("Get Today Attendance Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch today's attendance",
    });
  }
};

// ======================================================
// 4. GET MY ATTENDANCE HISTORY
// ======================================================

const getMyAttendance = async (req, res) => {
  try {
    const { employee } = await getAuthenticatedEmployee(req.user?._id);

    const page = Math.max(Number(req.query.page) || 1, 1);

    const limit = Math.min(Number(req.query.limit) || 10, 100);

    const skip = (page - 1) * limit;

    const query = {
      employeeId: employee._id,
    };

    // -----------------------------------------------
    // Month filter
    // -----------------------------------------------

    if (req.query.month) {
      const [year, month] = req.query.month.split("-").map(Number);

      if (year && month) {
        const startDate = new Date(
          `${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`,
        );

        const nextMonth = month === 12 ? 1 : month + 1;

        const nextYear = month === 12 ? year + 1 : year;

        const endDate = new Date(
          `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`,
        );

        query.attendanceDate = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    }

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .populate(
          "employeeId",
          "employeeId employeeName department designation workingHours halfDayHours",
        )
        .sort({
          attendanceDate: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Attendance.countDocuments(query),
    ]);

    const formattedData = attendance.map((item) => {
      const remainingMinutes = calculateRemainingMinutes(
        item.inTime,
        item.outTime,
        item.employeeId,
      );
      const workingConfig = getEmployeeWorkingMinutes(item.employeeId);
      return {
        ...item,

        statusLabel: getAttendanceStatusLabel(item.status),

        totalHours: formatMinutes(item.totalMinutes),

        overtime: formatMinutes(item.overtimeMinutes),

        remainingMinutes,

        remainingHours: formatMinutes(remainingMinutes),

        deficitHours: formatMinutes(item.deficitMinutes),

        requiredWorkingHours: formatMinutes(workingConfig.requiredMinutes),

        halfDayWorkingHours: formatMinutes(workingConfig.halfDayMinutes),
      };
    });

    return res.status(200).json({
      success: true,

      data: formattedData,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get My Attendance Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch attendance",
    });
  }
};

// ======================================================
// 5. ADMIN / HR - GET ALL ATTENDANCE
// ======================================================

// ======================================================
// ADMIN / HR - GET ALL ATTENDANCE
// ======================================================

const getAllAttendance = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);

    const limit = Math.min(Number(req.query.limit) || 10, 100);

    const skip = (page - 1) * limit;

    const query = {};

    // ==================================================
    // EMPLOYEE FILTER
    // ==================================================

    if (req.query.employeeId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.employeeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employeeId",
        });
      }

      query.employeeId = req.query.employeeId;
    }

    // ==================================================
    // STATUS FILTER
    // ==================================================

    if (req.query.status !== undefined && req.query.status !== "") {
      const numericStatus = Number(req.query.status);

      if (![0, 0.5, 1].includes(numericStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Allowed values are 0, 0.5 and 1",
        });
      }

      query.status = numericStatus;
    }

    // ==================================================
    // SEARCH
    // ==================================================

    if (req.query.search?.trim()) {
      const search = req.query.search.trim();

      const matchingEmployees = await Employee.find({
        $or: [
          {
            employeeId: {
              $regex: search,
              $options: "i",
            },
          },
          {
            employeeName: {
              $regex: search,
              $options: "i",
            },
          },
          {
            email: {
              $regex: search,
              $options: "i",
            },
          },
          {
            department: {
              $regex: search,
              $options: "i",
            },
          },
          {
            designation: {
              $regex: search,
              $options: "i",
            },
          },
        ],
      }).select("_id");

      const employeeIds = matchingEmployees.map((employee) => employee._id);

      query.employeeId = {
        $in: employeeIds,
      };
    }

    // ==================================================
    // EXACT DATE FILTER
    // ==================================================

    if (req.query.date) {
      const date = new Date(`${req.query.date}T00:00:00+05:30`);

      if (isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date",
        });
      }

      const nextDate = new Date(date);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);

      query.attendanceDate = {
        $gte: date,
        $lt: nextDate,
      };
    }

    // ==================================================
    // MONTH FILTER
    // Example: 2026-08
    // ==================================================

    if (req.query.month) {
      const [year, month] = req.query.month.split("-").map(Number);

      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: "Invalid month. Use YYYY-MM format",
        });
      }

      const startDate = new Date(
        `${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`,
      );

      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;

      const endDate = new Date(
        `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`,
      );

      query.attendanceDate = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    // ==================================================
    // QUERY
    // ==================================================

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .populate(
          "employeeId",
          "employeeId employeeName department designation email workingHours halfDayHours",
        )
        .sort({
          attendanceDate: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Attendance.countDocuments(query),
    ]);

    // ==================================================
    // FORMAT RESPONSE
    // ==================================================

    const formattedData = attendance.map((item) => {
      const remainingMinutes = calculateRemainingMinutes(
        item.inTime,
        item.outTime,
        item.employeeId,
      );

      return {
        ...item,

        statusLabel: getAttendanceStatusLabel(item.status),

        totalHours: formatMinutes(item.totalMinutes),

        overtime: formatMinutes(item.overtimeMinutes),

        deficitHours: formatMinutes(item.deficitMinutes),

        remainingMinutes,

        remainingHours: formatMinutes(remainingMinutes),
      };
    });

    return res.status(200).json({
      success: true,

      data: formattedData,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get All Attendance Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch all attendance",
    });
  }
};
// ======================================================
// 6. GET ATTENDANCE BY ID
// ======================================================

const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance ID",
      });
    }

    const attendance = await Attendance.findById(id)
      .populate(
        "employeeId",
        "employeeId employeeName department designation email",
      )
      .populate("editedBy", "name email role");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...attendance.toObject(),

        statusLabel: getAttendanceStatusLabel(attendance.status),

        totalHours: formatMinutes(attendance.totalMinutes),

        overtime: formatMinutes(attendance.overtimeMinutes),

        deficitHours: formatMinutes(attendance.deficitMinutes),
      },
    });
  } catch (error) {
    console.error("Get Attendance By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch attendance",
    });
  }
};

// ======================================================
// 7. ADMIN / HR - UPDATE ATTENDANCE
// ======================================================

// create a check in check out and regularise attendance
// ======================================================
// CREATE / REGULARIZE ATTENDANCE - ADMIN
// Status Only
// ======================================================

// ======================================================
// CREATE / REGULARIZE ATTENDANCE STATUS
// ======================================================
const createOrRegularizeAttendance = async (req, res) => {
  try {
    const { employeeId, attendanceDate, status, remarks } = req.body;

    // ==================================================
    // 1. VALIDATE EMPLOYEE ID
    // ==================================================

    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employeeId is required",
      });
    }

    // ==================================================
    // 2. FIND EMPLOYEE
    // ==================================================

    const employee = await Employee.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // ==================================================
    // 3. VALIDATE ATTENDANCE DATE
    // ==================================================

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Attendance date is required",
      });
    }

    // ==================================================
    // 3. VALIDATE ATTENDANCE DATE
    // ==================================================

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Attendance date is required",
      });
    }

    // Expect YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date. Expected YYYY-MM-DD",
      });
    }

    // ==================================================
    // INDIA DAY RANGE
    // ==================================================

    // Start of selected day in IST
    const attendanceDateObj = new Date(`${attendanceDate}T00:00:00+05:30`);

    // Start of next day in IST
    const nextDateObj = new Date(`${attendanceDate}T00:00:00+05:30`);

    nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1);

    if (isNaN(attendanceDateObj.getTime()) || isNaN(nextDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date",
      });
    }

    // ==================================================
    // 4. VALIDATE STATUS
    // ==================================================

    if (status === undefined || status === null || status === "") {
      return res.status(400).json({
        success: false,
        message: "Attendance status is required",
      });
    }

    const numericStatus = Number(status);

    if (![0, 0.5, 1].includes(numericStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status. Allowed values are 0, 0.5 and 1",
      });
    }

    // ==================================================
    // 5. VALIDATE DOCUMENT COUNT
    // ==================================================

    const files = req.files || [];

    if (files.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 supporting documents are allowed",
      });
    }

    // ==================================================
    // 6. FIND EXISTING ATTENDANCE FOR SAME INDIA DATE
    // ==================================================

    let attendance = await Attendance.findOne({
      employeeId: employee._id,

      attendanceDate: {
        $gte: attendanceDateObj,
        $lt: nextDateObj,
      },
    });

    // ==================================================
    // 7. UPLOAD NEW DOCUMENTS
    // ==================================================

    let uploadedDocuments = [];

    if (files.length > 0) {
      uploadedDocuments = await Promise.all(
        files.map((file) => uploadRegularizationDocument(file)),
      );
    }

    // ==================================================
    // 8. CREATE NEW ATTENDANCE
    // ==================================================

    if (!attendance) {
      attendance = new Attendance({
        employeeId: employee._id,

        attendanceDate: attendanceDateObj,

        inTime: null,
        outTime: null,

        totalMinutes: 0,
        overtimeMinutes: 0,
        deficitMinutes: 0,

        status: numericStatus,

        attendanceSource: "ADMIN",

        remarks: remarks?.trim() || "Attendance created by Admin",

        // ==========================================
        // DOCUMENTS
        // ==========================================

        regularizationDocuments: uploadedDocuments,

        editedBy: req.user?._id || null,

        editedAt: new Date(),
      });

      await attendance.save();

      const populatedAttendance = await Attendance.findById(attendance._id)
        .populate(
          "employeeId",
          "employeeId employeeName department designation workingHours halfDayHours",
        )
        .populate("editedBy", "name email role");

      return res.status(201).json({
        success: true,

        message: "Attendance created successfully",

        data: {
          ...populatedAttendance.toObject(),

          statusLabel: getAttendanceStatusLabel(populatedAttendance.status),

          totalHours: formatMinutes(populatedAttendance.totalMinutes || 0),

          overtime: formatMinutes(populatedAttendance.overtimeMinutes || 0),

          deficitHours: formatMinutes(populatedAttendance.deficitMinutes || 0),
        },
      });
    }

    // ==================================================
    // 9. EXISTING ATTENDANCE
    // ==================================================

    attendance.status = numericStatus;

    attendance.attendanceSource = "ADMIN";

    attendance.remarks =
      remarks !== undefined ? remarks.trim() : attendance.remarks;

    // ==================================================
    // ADD NEW DOCUMENTS
    // ==================================================

    if (uploadedDocuments.length > 0) {
      attendance.regularizationDocuments.push(...uploadedDocuments);
    }

    // ==================================================
    // MAX 5 DOCUMENTS CHECK
    // ==================================================

    if (attendance.regularizationDocuments.length > 5) {
      return res.status(400).json({
        success: false,
        message:
          "Maximum 5 supporting documents are allowed per attendance record",
      });
    }

    attendance.editedBy = req.user?._id || null;

    attendance.editedAt = new Date();

    // DO NOT CHANGE:
    //
    // attendance.inTime
    // attendance.outTime
    // attendance.totalMinutes
    // attendance.overtimeMinutes
    // attendance.deficitMinutes

    await attendance.save();

    // ==================================================
    // 10. POPULATE
    // ==================================================

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate(
        "employeeId",
        "employeeId employeeName department designation workingHours halfDayHours",
      )
      .populate("editedBy", "name email role");

    // ==================================================
    // 11. RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Attendance status updated successfully",

      data: {
        ...populatedAttendance.toObject(),

        statusLabel: getAttendanceStatusLabel(populatedAttendance.status),

        totalHours: formatMinutes(populatedAttendance.totalMinutes || 0),

        overtime: formatMinutes(populatedAttendance.overtimeMinutes || 0),

        deficitHours: formatMinutes(populatedAttendance.deficitMinutes || 0),
      },
    });
  } catch (error) {
    console.error("Create / Regularize Attendance Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update attendance status",
    });
  }
};
// const createOrRegularizeAttendance = async (req, res) => {
//   try {
//     const { employeeId, attendanceDate, status, remarks } = req.body;
//     // ================================================
//     // UPLOAD REGULARIZATION DOCUMENT
//     // ================================================

//     let regularizationDocument = null;

//     if (req.file) {
//       regularizationDocument = await uploadRegularizationDocument(req.file);
//     }
//     // ==================================================
//     // 1. VALIDATE EMPLOYEE ID
//     // ==================================================

//     if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Valid employeeId is required",
//       });
//     }

//     // ==================================================
//     // 2. FIND EMPLOYEE
//     // ==================================================

//     const employee = await Employee.findById(employeeId);

//     if (!employee) {
//       return res.status(404).json({
//         success: false,
//         message: "Employee not found",
//       });
//     }

//     // ==================================================
//     // 3. VALIDATE ATTENDANCE DATE
//     // ==================================================

//     if (!attendanceDate) {
//       return res.status(400).json({
//         success: false,
//         message: "Attendance date is required",
//       });
//     }

//     const attendanceDateObj = new Date(`${attendanceDate}T00:00:00+05:30`);

//     if (isNaN(attendanceDateObj.getTime())) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid attendance date",
//       });
//     }

//     // ==================================================
//     // 4. VALIDATE STATUS
//     // ==================================================

//     if (status === undefined || status === null || status === "") {
//       return res.status(400).json({
//         success: false,
//         message: "Attendance status is required",
//       });
//     }

//     const numericStatus = Number(status);

//     if (![0, 0.5, 1].includes(numericStatus)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid attendance status. Allowed values are 0, 0.5 and 1",
//       });
//     }
//     // ==================================================
//     // 5. VALIDATE DOCUMENT COUNT
//     // ==================================================

//     const files = req.files || [];

//     if (files.length > 5) {
//       return res.status(400).json({
//         success: false,
//         message: "Maximum 5 supporting documents are allowed",
//       });
//     }
//     // ==================================================
//     // 5. FIND EXISTING ATTENDANCE
//     // ==================================================

//     let attendance = await Attendance.findOne({
//       employeeId: employee._id,
//       attendanceDate: attendanceDateObj,
//     });

//     // ==================================================
//     // 7. UPLOAD NEW DOCUMENTS
//     // ==================================================

//     let uploadedDocuments = [];

//     if (files.length > 0) {
//       uploadedDocuments = await Promise.all(
//         files.map((file) => uploadRegularizationDocument(file)),
//       );
//     }

//     // ==================================================
//     // 6. CREATE NEW ATTENDANCE
//     // ==================================================

//     if (!attendance) {
//       attendance = new Attendance({
//         employeeId: employee._id,

//         attendanceDate: attendanceDateObj,

//         // Admin regularization does NOT create
//         // check-in / check-out times
//         inTime: null,
//         outTime: null,

//         // No working time because there is no
//         // check-in / check-out
//         totalMinutes: 0,
//         overtimeMinutes: 0,
//         deficitMinutes: 0,

//         // Admin-selected status
//         status: numericStatus,

//         attendanceSource: "ADMIN",

//         remarks: remarks?.trim() || "Attendance created by Admin",
//         // ================================================
//         // REGULARIZATION DOCUMENT
//         // ================================================

//         regularizationDocuments: uploadedDocuments,

//         editedBy: req.user?._id || null,
//         editedAt: new Date(),
//       });

//       await attendance.save();

//       // -----------------------------------------------
//       // Populate response
//       // -----------------------------------------------

//       const populatedAttendance = await Attendance.findById(attendance._id)
//         .populate(
//           "employeeId",
//           "employeeId employeeName department designation workingHours halfDayHours",
//         )
//         .populate("editedBy", "name email role");

//       return res.status(201).json({
//         success: true,

//         message: "Attendance created successfully",

//         data: {
//           ...populatedAttendance.toObject(),

//           statusLabel: getAttendanceStatusLabel(populatedAttendance.status),

//           totalHours: formatMinutes(populatedAttendance.totalMinutes || 0),

//           overtime: formatMinutes(populatedAttendance.overtimeMinutes || 0),

//           deficitHours: formatMinutes(populatedAttendance.deficitMinutes || 0),
//         },
//       });
//     }

//     // ==================================================
//     // 7. EXISTING ATTENDANCE
//     // ==================================================
//     //
//     // IMPORTANT:
//     //
//     // Only update:
//     //   status
//     //   remarks
//     //   attendanceSource
//     //   editedBy
//     //   editedAt
//     //
//     // NEVER update:
//     //   inTime
//     //   outTime
//     //   totalMinutes
//     //   overtimeMinutes
//     //   deficitMinutes
//     //
//     // ==================================================

//     attendance.status = numericStatus;

//     attendance.attendanceSource = "ADMIN";

//     attendance.remarks =
//       remarks !== undefined ? remarks.trim() : attendance.remarks;
//     // ================================================
//     // UPDATE REGULARIZATION DOCUMENT
//     // ================================================

//     if (regularizationDocument) {
//       attendance.regularizationDocument = regularizationDocument;
//     }
//     attendance.editedBy = req.user?._id || null;

//     attendance.editedAt = new Date();

//     // Do NOT touch these fields:
//     //
//     // attendance.inTime
//     // attendance.outTime
//     // attendance.totalMinutes
//     // attendance.overtimeMinutes
//     // attendance.deficitMinutes

//     await attendance.save();

//     // ==================================================
//     // 8. POPULATE RESPONSE
//     // ==================================================

//     const populatedAttendance = await Attendance.findById(attendance._id)
//       .populate(
//         "employeeId",
//         "employeeId employeeName department designation workingHours halfDayHours",
//       )
//       .populate("editedBy", "name email role");

//     // ==================================================
//     // 9. RESPONSE
//     // ==================================================

//     return res.status(200).json({
//       success: true,

//       message: "Attendance status updated successfully",

//       data: {
//         ...populatedAttendance.toObject(),

//         statusLabel: getAttendanceStatusLabel(populatedAttendance.status),

//         totalHours: formatMinutes(populatedAttendance.totalMinutes || 0),

//         overtime: formatMinutes(populatedAttendance.overtimeMinutes || 0),

//         deficitHours: formatMinutes(populatedAttendance.deficitMinutes || 0),
//       },
//     });
//   } catch (error) {
//     console.error("Create / Regularize Attendance Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update attendance status",
//     });
//   }
// };

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMyAttendance,
  getAllAttendance,
  getAttendanceById,

  createOrRegularizeAttendance,
};