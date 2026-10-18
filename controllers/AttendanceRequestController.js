const mongoose = require("mongoose");
const AttendanceRequest = require("../models/AttendanceRequest.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const Attendance = require("../models/attendance.model");
const { uploadToCloudinary } = require("../utils/uploadToCloudinary");
// ==========================
// CREATE ATTENDANCE REQUEST
// ==========================
const createAttendanceRequest = asyncHandler(async (req, res) => {
  const { requestedBy, requestedTo, attendanceDate, reason } = req.body;

  if (!requestedBy || !requestedTo || !attendanceDate || !reason) {
    throw new ApiError(
      400,
      "Employee, manager, attendance date and reason are required",
    );
  }

  if (
    !mongoose.isValidObjectId(requestedBy) ||
    !mongoose.isValidObjectId(requestedTo)
  ) {
    throw new ApiError(400, "Invalid employee or manager ID");
  }

  if (new Date(attendanceDate).toString() === "Invalid Date") {
    throw new ApiError(400, "Invalid attendance date");
  }

  if (new Date(attendanceDate) > new Date()) {
    throw new ApiError(400, "Attendance date cannot be in the future");
  }

  if (String(reason).trim().length < 5) {
    throw new ApiError(400, "Reason must contain at least 5 characters");
  }

  // ✅ File comes from multer, not req.body
  // Get the uploaded file URL from multer

  let attachmentUrl = "";

  if (req.file) {
    const uploadedFile = await uploadToCloudinary(
      req.file.buffer,
      "attendance/requests",
    );

    attachmentUrl = uploadedFile.secure_url;
  }

  const attendanceRequest = await AttendanceRequest.create({
    requestedBy,
    requestedTo,
    attendanceDate,
    reason: String(reason).trim(),
    attachment: attachmentUrl,
  });

  res.status(201).json({
    success: true,
    message: "Attendance request submitted successfully",
    data: attendanceRequest,
  });
});
// ==========================
// GET ALL ATTENDANCE REQUESTS
// Supports employee, manager and status filters
// ==========================
// ======================================================
// GET ALL ATTENDANCE REQUESTS
// ======================================================
const getAllAttendanceRequests = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const query = {};

  if (req.query.requestedBy) {
    if (!mongoose.isValidObjectId(req.query.requestedBy)) {
      throw new ApiError(400, "Invalid employee ID");
    }
    query.requestedBy = req.query.requestedBy;
  }

  if (req.query.requestedTo) {
    if (!mongoose.isValidObjectId(req.query.requestedTo)) {
      throw new ApiError(400, "Invalid manager ID");
    }
    query.requestedTo = req.query.requestedTo;
  }

  if (req.query.status) {
    if (!["PENDING", "APPROVED", "REJECTED"].includes(req.query.status)) {
      throw new ApiError(400, "Invalid attendance request status");
    }
    query.status = req.query.status;
  }

  const [totalRecords, requests] = await Promise.all([
    AttendanceRequest.countDocuments(query),

    AttendanceRequest.find(query)
      // ✅ Populate employee (all fields the drawer needs)
      .populate(
        "requestedBy",
        "employeeId employeeName email department designation",
      )
      // ✅ Populate manager
      .populate(
        "requestedTo",
        "employeeId employeeName email department designation",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // ======================================================
  // FETCH MATCHING ATTENDANCE RECORDS FOR inTime / outTime
  // ======================================================
  // For each request, we look up the attendance doc for the
  // same employee on the same date. We do this in ONE query
  // using $or over { employeeId, attendanceDate } pairs.
  const requestPairs = requests
    .map((r) => {
      const empId = r.requestedBy?._id;
      const date = r.attendanceDate;
      if (!empId || !date) return null;
      return { employeeId: empId, attendanceDate: date };
    })
    .filter(Boolean);

  let attendanceMap = new Map();

  if (requestPairs.length > 0) {
    // Match attendance by employee + date range (day boundaries, IST-safe)
    const orConditions = requestPairs.map(({ employeeId, attendanceDate }) => {
      const start = new Date(attendanceDate);
      // normalize to IST start-of-day to match how attendance is stored
      const startOfDay = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate(),
        ) -
          5.5 * 60 * 60 * 1000,
      );
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      return {
        employeeId,
        attendanceDate: { $gte: startOfDay, $lt: endOfDay },
      };
    });

    const attendanceDocs = await Attendance.find({ $or: orConditions })
      .select("employeeId attendanceDate inTime outTime status")
      .lean();

    attendanceMap = new Map(
      attendanceDocs.map((a) => [
        `${a.employeeId}_${new Date(a.attendanceDate).toISOString().slice(0, 10)}`,
        a,
      ]),
    );
  }

  // ======================================================
  // MERGE inTime / outTime INTO EACH REQUEST
  // ======================================================

  const data = requests.map((r) => {
    const empId = r.requestedBy?._id;
    const dateKey = new Date(r.attendanceDate).toISOString().slice(0, 10);
    const att = attendanceMap.get(`${empId}_${dateKey}`);

    // Actual attendance status from the Attendance model
    let attendanceStatus = att?.status ?? null;

    // If the request is approved but attendance doesn't exist,
    // treat it as Absent until the approved attendance is regularized.
    if (r.status === "APPROVED" && !att) {
      attendanceStatus = "ABSENT";
    }

    return {
      ...r,
      inTime: att?.inTime || null,
      outTime: att?.outTime || null,
      attendanceStatus,
    };
  });

  const totalPages = Math.ceil(totalRecords / limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    totalRecords,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    count: data.length,
    data,
  });
});

// ==========================
// GET ATTENDANCE REQUEST BY ID
// ==========================
const getAttendanceRequestById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, "Invalid attendance request ID");
  }

  const request = await AttendanceRequest.findById(req.params.id)
    .populate("requestedBy", "name email")
    .populate("requestedTo", "name email");

  if (!request) {
    throw new ApiError(404, "Attendance request not found");
  }

  res.status(200).json({
    success: true,
    data: request,
  });
});

// ==========================
// APPROVE OR REJECT REQUEST
// ==========================

// ==========================
// APPROVE OR REJECT REQUEST
// ==========================
const updateAttendanceRequestStatus = asyncHandler(async (req, res) => {
  const { status, attendanceStatus, approvedType } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, "Invalid attendance request ID");
  }

  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw new ApiError(400, "Status must be APPROVED or REJECTED");
  }

  const request = await AttendanceRequest.findById(req.params.id);

  if (!request) {
    throw new ApiError(404, "Attendance request not found");
  }

 // Allow re-review (admin/manager can flip status between APPROVED / REJECTED,
// and switch approvedType between FULL_DAY / HALF_DAY / ABSENT).
// Only block if the request is currently in a transitional/invalid state,
// which is not applicable here since status only ever becomes APPROVED or REJECTED.

  if (status === "APPROVED") {
    const validApprovalTypes = {
      FULL_DAY: 1,
      HALF_DAY: 0.5,
      ABSENT: 0,
    };

    if (
      !approvedType ||
      !Object.prototype.hasOwnProperty.call(
        validApprovalTypes,
        approvedType,
      )
    ) {
      throw new ApiError(400, "Valid approvedType is required");
    }

    if (attendanceStatus !== validApprovalTypes[approvedType]) {
      throw new ApiError(
        400,
        "Attendance status does not match the approved type",
      );
    }

    request.attendanceStatus = attendanceStatus;
    request.approvedType = approvedType;
  }

  request.status = status;

  await request.save();

  res.status(200).json({
    success: true,
    message: `Attendance request ${status.toLowerCase()} successfully`,
    data: request,
  });
});
// const updateAttendanceRequestStatus = asyncHandler(async (req, res) => {
//   const { status } = req.body;

//   if (!mongoose.isValidObjectId(req.params.id)) {
//     throw new ApiError(400, "Invalid attendance request ID");
//   }

//   if (!["APPROVED", "REJECTED"].includes(status)) {
//     throw new ApiError(400, "Status must be APPROVED or REJECTED");
//   }

//   const request = await AttendanceRequest.findById(req.params.id);

//   if (!request) {
//     throw new ApiError(404, "Attendance request not found");
//   }

//   if (request.status !== "PENDING") {
//     throw new ApiError(400, "This request has already been reviewed");
//   }

//   request.status = status;
//   await request.save();

//   res.status(200).json({
//     success: true,
//     message: `Attendance request ${status.toLowerCase()} successfully`,
//     data: request,
//   });
// });

// ==========================
// DELETE ATTENDANCE REQUEST
// ==========================
const deleteAttendanceRequest = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, "Invalid attendance request ID");
  }

  const request = await AttendanceRequest.findByIdAndDelete(req.params.id);

  if (!request) {
    throw new ApiError(404, "Attendance request not found");
  }

  res.status(200).json({
    success: true,
    message: "Attendance request deleted successfully",
  });
});

// ==========================
// GET ATTENDANCE REQUESTS ASSIGNED TO LOGGED-IN MANAGER
// ==========================
const getAttendanceRequestsByRequestedTo = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  // Use the authenticated user's employee ID
  const managerId = req.user?.employeeId;

  if (!managerId || !mongoose.isValidObjectId(managerId)) {
    throw new ApiError(400, "Valid manager employee ID is required");
  }

  const query = {
    requestedTo: managerId,
  };

  if (req.query.status) {
    if (!["PENDING", "APPROVED", "REJECTED"].includes(req.query.status)) {
      throw new ApiError(400, "Invalid attendance request status");
    }

    query.status = req.query.status;
  }

  const [totalRecords, requests] = await Promise.all([
    AttendanceRequest.countDocuments(query),

    AttendanceRequest.find(query)
      .populate(
        "requestedBy",
        "employeeId employeeName email department designation",
      )
      .populate(
        "requestedTo",
        "employeeId employeeName email department designation",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // Fetch attendance records for the requested employee/date pairs
  const requestPairs = requests
    .map((request) => {
      if (!request.requestedBy?._id || !request.attendanceDate) {
        return null;
      }

      return {
        employeeId: request.requestedBy._id,
        attendanceDate: request.attendanceDate,
      };
    })
    .filter(Boolean);

  let attendanceMap = new Map();

  if (requestPairs.length > 0) {
    const orConditions = requestPairs.map(({ employeeId, attendanceDate }) => {
      const date = new Date(attendanceDate);

      // IST day boundaries
      const startOfDay = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
          5.5 * 60 * 60 * 1000,
      );

      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      return {
        employeeId,
        attendanceDate: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      };
    });

    const attendanceDocs = await Attendance.find({
      $or: orConditions,
    })
      .select("employeeId attendanceDate inTime outTime status")
      .lean();

    attendanceMap = new Map(
      attendanceDocs.map((attendance) => [
        `${attendance.employeeId}_${new Date(attendance.attendanceDate)
          .toISOString()
          .slice(0, 10)}`,
        attendance,
      ]),
    );
  }

  const data = requests.map((request) => {
    const employeeId = request.requestedBy?._id;
    const dateKey = new Date(request.attendanceDate).toISOString().slice(0, 10);

    const attendance = attendanceMap.get(`${employeeId}_${dateKey}`);

    return {
      ...request,
      inTime: attendance?.inTime || null,
      outTime: attendance?.outTime || null,
      attendanceStatus: attendance?.status ?? null,
    };
  });

  const totalPages = Math.ceil(totalRecords / limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    totalRecords,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    count: data.length,
    data,
  });
});
// ======================================================
// GET ATTENDANCE REQUESTS SUBMITTED BY LOGGED-IN EMPLOYEE
// ======================================================
const getMyAttendanceRequests = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  // Get the logged-in employee ID from the JWT middleware
  const employeeId = req.user?.employeeId;

  if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
    throw new ApiError(400, "Valid employee ID is required");
  }

  // Only return requests created by the logged-in employee
  const query = {
    requestedBy: employeeId,
  };

  // Optional status filter: PENDING, APPROVED, REJECTED
  if (req.query.status) {
    if (!["PENDING", "APPROVED", "REJECTED"].includes(req.query.status)) {
      throw new ApiError(400, "Invalid attendance request status");
    }

    query.status = req.query.status;
  }

  const [totalRecords, requests] = await Promise.all([
    AttendanceRequest.countDocuments(query),

    AttendanceRequest.find(query)
      .populate(
        "requestedBy",
        "employeeId employeeName email department designation",
      )
      .populate(
        "requestedTo",
        "employeeId employeeName email department designation",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // Fetch attendance records for the requested dates in one query
  const requestPairs = requests
    .map((request) => {
      if (!request.requestedBy?._id || !request.attendanceDate) {
        return null;
      }

      return {
        employeeId: request.requestedBy._id,
        attendanceDate: request.attendanceDate,
      };
    })
    .filter(Boolean);

  let attendanceMap = new Map();

  if (requestPairs.length > 0) {
    const orConditions = requestPairs.map(
      ({ employeeId, attendanceDate }) => {
        const date = new Date(attendanceDate);

        // Match the attendance date using IST day boundaries
        const startOfDay = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
          ) -
            5.5 * 60 * 60 * 1000,
        );

        const endOfDay = new Date(
          startOfDay.getTime() + 24 * 60 * 60 * 1000,
        );

        return {
          employeeId,
          attendanceDate: {
            $gte: startOfDay,
            $lt: endOfDay,
          },
        };
      },
    );

    const attendanceDocs = await Attendance.find({
      $or: orConditions,
    })
      .select("employeeId attendanceDate inTime outTime status")
      .lean();

    attendanceMap = new Map(
      attendanceDocs.map((attendance) => [
        `${attendance.employeeId}_${new Date(
          attendance.attendanceDate,
        )
          .toISOString()
          .slice(0, 10)}`,
        attendance,
      ]),
    );
  }

  // Include attendance details with each submitted request
  const data = requests.map((request) => {
    const employeeId = request.requestedBy?._id;
    const dateKey = new Date(request.attendanceDate)
      .toISOString()
      .slice(0, 10);

    const attendance = attendanceMap.get(`${employeeId}_${dateKey}`);

    return {
      ...request,
      inTime: attendance?.inTime || null,
      outTime: attendance?.outTime || null,

      // Prefer the regularized status saved on the request
      attendanceStatus:
        request.status === "APPROVED"
          ? request.attendanceStatus ??
            attendance?.status ??
            "ABSENT"
          : attendance?.status ?? null,
    };
  });

  const totalPages = Math.ceil(totalRecords / limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    totalRecords,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    count: data.length,
    data,
  });
});
module.exports = {
  createAttendanceRequest,
  getAllAttendanceRequests,
  getAttendanceRequestById,
  updateAttendanceRequestStatus,
  deleteAttendanceRequest,
  getAttendanceRequestsByRequestedTo,
  getMyAttendanceRequests
};