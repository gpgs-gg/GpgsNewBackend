const mongoose = require("mongoose");

const Attendance = require("../models/attendance.model");
const Employee = require("../models/employee.model");
const User = require("../models/user.model");

const { uploadToCloudinary } = require("../utils/uploadToCloudinary");

// ======================================================
// CONSTANTS
// ======================================================

// 9 hours = 540 minutes
const REQUIRED_WORKING_MINUTES = 9 * 60;

const COMPANY_TIMEZONE = "Asia/Kolkata";

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

const calculateAttendanceHours = (inTime, outTime) => {
  if (!inTime || !outTime) {
    return {
      totalMinutes: 0,
      overtimeMinutes: 0,
      deficitMinutes: 0,
    };
  }
  // ======================================================
  // HELPER: CALCULATE ATTENDANCE STATUS
  // ======================================================

  const calculateAttendanceStatus = (totalMinutes = 0) => {
    // 9 hours or more = PRESENT
    if (totalMinutes >= REQUIRED_WORKING_MINUTES) {
      return 1;
    }

    // 4.5 hours or more = HALF DAY
    if (totalMinutes >= REQUIRED_WORKING_MINUTES / 2) {
      return 0.5;
    }

    // Less than 4.5 hours = ABSENT
    return 0;
  };
  const start = new Date(inTime);
  const end = new Date(outTime);

  const totalMinutes = Math.max(0, Math.floor((end - start) / (1000 * 60)));

  const overtimeMinutes = Math.max(totalMinutes - REQUIRED_WORKING_MINUTES, 0);

  const deficitMinutes = Math.max(REQUIRED_WORKING_MINUTES - totalMinutes, 0);

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

const calculateAttendanceStatus = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) {
    return 0;
  }

  // 9 hours or more = Present
  if (totalMinutes >= REQUIRED_WORKING_MINUTES) {
    return 1;
  }

  // 4.5 hours or more = Half Day
  if (totalMinutes >= REQUIRED_WORKING_MINUTES / 2) {
    return 0.5;
  }

  // Less than 4.5 hours = Absent
  return 0;
};

// ======================================================
// HELPER: CALCULATE REMAINING WORKING MINUTES
// ======================================================

const calculateRemainingMinutes = (inTime, outTime = null) => {
  if (!inTime) {
    return REQUIRED_WORKING_MINUTES;
  }

  const start = new Date(inTime);

  const end = outTime ? new Date(outTime) : new Date();

  const workedMinutes = Math.max(0, Math.floor((end - start) / (1000 * 60)));

  return Math.max(REQUIRED_WORKING_MINUTES - workedMinutes, 0);
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

      status: 1,

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
    });

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
    // Calculate working hours
    // -----------------------------------------------

    const { totalMinutes, overtimeMinutes, deficitMinutes } =
      calculateAttendanceHours(attendance.inTime, outTime);

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
    // Automatically calculate attendance status
    attendance.status = calculateAttendanceStatus(totalMinutes);

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

const getTodayAttendance = async (req, res) => {
  try {
    const { employee } = await getAuthenticatedEmployee(req.user?._id);

    const attendanceDate = getTodayAttendanceDate();

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      attendanceDate,
    }).populate("employeeId", "employeeId employeeName department designation");

    if (!attendance) {
      return res.status(200).json({
        success: true,
        message: "No attendance found for today",
        data: null,
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
        remainingMinutes: calculateRemainingMinutes(
          attendance.inTime,
          attendance.outTime,
        ),

        remainingHours: formatMinutes(
          calculateRemainingMinutes(attendance.inTime, attendance.outTime),
        ),
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
          "employeeId employeeName department designation",
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
      );
      return {
        ...item,

        statusLabel: getAttendanceStatusLabel(item.status),

        totalHours: formatMinutes(item.totalMinutes),

        overtime: formatMinutes(item.overtimeMinutes),
        remainingMinutes,
        remainingHours: formatMinutes(remainingMinutes),
        deficitHours: formatMinutes(item.deficitMinutes),
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

const getAllAttendance = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);

    const limit = Math.min(Number(req.query.limit) || 10, 100);

    const skip = (page - 1) * limit;

    const query = {};

    // -----------------------------------------------
    // Employee filter
    // -----------------------------------------------

    if (req.query.employeeId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.employeeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employeeId",
        });
      }

      query.employeeId = req.query.employeeId;
    }

    // -----------------------------------------------
    // Status filter
    // -----------------------------------------------

    if (req.query.status) {
      query.status = req.query.status.toUpperCase();
    }

    // -----------------------------------------------
    // Exact date filter
    // -----------------------------------------------

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

    // -----------------------------------------------
    // Month filter
    // Example: 2026-08
    // -----------------------------------------------

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

    // -----------------------------------------------
    // Query
    // -----------------------------------------------

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .populate(
          "employeeId",
          "employeeId employeeName department designation email",
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

    // -----------------------------------------------
    // Format response
    // -----------------------------------------------
    const formattedData = attendance.map((item) => ({
      ...item,

      statusLabel: getAttendanceStatusLabel(item.status),

      totalHours: formatMinutes(item.totalMinutes),

      overtime: formatMinutes(item.overtimeMinutes),

      deficitHours: formatMinutes(item.deficitMinutes),
    }));

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
      message: error.message || "Failed to fetch attendance",
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

const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance ID",
      });
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    const { inTime, outTime, status, remarks } = req.body;

    // -----------------------------------------------
    // Update times
    // -----------------------------------------------

    if (inTime !== undefined) {
      attendance.inTime = inTime ? new Date(inTime) : null;
    }

    if (outTime !== undefined) {
      attendance.outTime = outTime ? new Date(outTime) : null;
    }

    // -----------------------------------------------
    // Recalculate hours
    // -----------------------------------------------

    const { totalMinutes, overtimeMinutes, deficitMinutes } =
      calculateAttendanceHours(attendance.inTime, attendance.outTime);

    attendance.totalMinutes = totalMinutes;

    attendance.overtimeMinutes = overtimeMinutes;

    attendance.deficitMinutes = deficitMinutes;

    // -----------------------------------------------
    // Status
    // -----------------------------------------------

    // -----------------------------------------------
    // Status
    // -----------------------------------------------

    if (status !== undefined) {
      const numericStatus = Number(status);

      if (![0, 0.5, 1].includes(numericStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance status. Allowed values are 0, 0.5 and 1",
        });
      }

      attendance.status = numericStatus;
    } else {
      attendance.status = calculateAttendanceStatus(attendance.totalMinutes);
    }
    // -----------------------------------------------
    // Remarks
    // -----------------------------------------------

    if (remarks !== undefined) {
      attendance.remarks = remarks;
    }

    // -----------------------------------------------
    // Audit
    // -----------------------------------------------

    attendance.editedBy = req.user?._id || null;
    attendance.editedAt = new Date();

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",

      data: {
        ...attendance.toObject(),

        statusLabel: getAttendanceStatusLabel(attendance.status),

        totalHours: formatMinutes(attendance.totalMinutes),

        overtime: formatMinutes(attendance.overtimeMinutes),

        deficitHours: formatMinutes(attendance.deficitMinutes),
      },
    });
  } catch (error) {
    console.error("Update Attendance Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update attendance",
    });
  }
};

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
  updateAttendance,
};