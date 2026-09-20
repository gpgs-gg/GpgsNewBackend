const User = require("../models/user.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/employee.model");
const Client = require("../models/client.model");
const { generateWorkLogs, createWorkLog } = require("../utils/worklog");
// ==========================
// GET ALL USERS
// ==========================
const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);

  const skip = (page - 1) * limit;

  const query = {};

  // Search
  if (req.query.search) {
    query.$or = [
      {
        name: {
          $regex: req.query.search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: req.query.search,
          $options: "i",
        },
      },
    ];
  }

  // Filters
  if (req.query.userId) {
    query._id = req.query.userId;
  }

  if (req.query.role) {
    query.role = req.query.role;
  }

  if (req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === "true";
  }

  const totalRecords = await User.countDocuments(query);

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const usersWithCorrectDetails = await Promise.all(
    users.map(async (user) => {
      const userObj = user.toObject();

      if (user.role === "Employee" && user.employeeId) {
        const employee = await Employee.findById(user.employeeId).select(
          "employeeName email",
        );

        if (employee) {
          userObj.name = employee.employeeName;
          userObj.email = employee.email;
        }
      }

      if (user.role === "Client" && user.clientId) {
        const client = await Client.findById(user.clientId).select(
          "fullName emailId",
        );

        if (client) {
          userObj.name = client.fullName;
          userObj.email = client.emailId;
        }
      }

      return userObj;
    }),
  );

  res.status(200).json({
    success: true,
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    hasNextPage: page < Math.ceil(totalRecords / limit),
    hasPrevPage: page > 1,
    count: usersWithCorrectDetails.length,
    data: usersWithCorrectDetails,
  });
  // console.log(
  //   "All User Emails:",
  //   users.map((user) => user.email),
  // );
  // const employeeEmails = await Promise.all(
  //   users
  //     .filter((user) => user.role === "Employee" && user.employeeId)
  //     .map(async (user) => {
  //       const employee = await Employee.findById(user.employeeId).select(
  //         "email",
  //       );

  //       return employee?.email;
  //     }),
  // );

  console.log("Employee Emails:", employeeEmails);
  res.status(200).json({
    success: true,
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    hasNextPage: page < Math.ceil(totalRecords / limit),
    hasPrevPage: page > 1,
    count: users.length,
    data: users,
  });
});

// ==========================
// GET USER BY ID
// ==========================
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// ==========================
// UPDATE USER
// ==========================
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Email Duplicate Check
  if (req.body.email && req.body.email !== user.email) {
    const existingEmail = await User.findOne({
      email: req.body.email,
      _id: {
        $ne: req.params.id,
      },
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }
  }
  // ============================================================
  // WORKLOG USER
  // ============================================================
  // This name is stored in the worklog as the person who
  // performed the update.
  const workLogUser =
    req.body.updatedByName ||
    req.body.createdByName ||
    req.user?.name ||
    "System";

  // ============================================================
  // STORE OLD DATA BEFORE UPDATE
  // ============================================================
  // We need the original document so generateWorkLogs()
  // can compare old values with the new values.
  const oldUserData = user.toObject();

  // ============================================================
  // PREPARE NEW DATA
  // ============================================================
  const newUserData = {
    ...oldUserData,
    ...req.body,
  };
  if (req.body.password) {
    user.password = req.body.password;
  }
  // ============================================================
  // ADMIN ONLY EMAIL AND NAME
  // ============================================================
  // Email and name can be changed only when the existing
  // user's role is Admin.
  if (user.role === "Admin") {
    user.email = req.body.email ?? user.email;
    user.name = req.body.name ?? user.name;
  }
  user.role = req.body.role ?? user.role;
  user.bookingId = req.body.bookingId ?? user.bookingId;
  user.employeeId = req.body.employeeId ?? user.employeeId;

  if (req.body.isActive !== undefined) {
    user.isActive = req.body.isActive;
  }
  // ============================================================
  // OTHER USER FIELDS
  // ============================================================
  newUserData.role = req.body.role ?? user.role;
  newUserData.bookingId = req.body.bookingId ?? user.bookingId;
  newUserData.employeeId = req.body.employeeId ?? user.employeeId;
  newUserData.clientId = req.body.clientId ?? user.clientId;

  if (req.body.isActive !== undefined) {
    newUserData.isActive = req.body.isActive;
  } else {
    newUserData.isActive = user.isActive;
  }

  // ============================================================
  // AUTOMATIC WORKLOG
  // ============================================================
  // generateWorkLogs() checks every field and creates a worklog
  // only when the value has actually changed.
  const automaticWorkLogs = generateWorkLogs({
    oldData: oldUserData,
    newData: newUserData,
    createdBy: workLogUser,

    ignoredFields: [
      // --------------------------------------------------------
      // Worklog/helper fields
      // --------------------------------------------------------
      "newWorkLog",
      "workLogs",

      // --------------------------------------------------------
      // MongoDB/system fields
      // --------------------------------------------------------
      "_id",
      "__v",
      "createdAt",
      "updatedAt",
      "refreshToken",

      // --------------------------------------------------------
      // Request/helper fields
      // --------------------------------------------------------
      "createdByName",
      "updatedByName",

      // --------------------------------------------------------
      // Password should NOT be displayed in worklogs
      // --------------------------------------------------------
      "password",
    ],
  });

  // ============================================================
  // EXISTING WORKLOGS
  // ============================================================
  const workLogs = [...(user.workLogs || [])];

  // Add automatic field-change logs.
  workLogs.push(...automaticWorkLogs);

  // ============================================================
  // MANUAL WORKLOG
  // ============================================================
  // Allows the frontend to send:
  // newWorkLog: "User account verified"
  const newWorkLog = String(req.body.newWorkLog || "").trim();

  if (newWorkLog) {
    workLogs.push(
      createWorkLog({
        message: newWorkLog,
        createdBy: workLogUser,
      }),
    );
  }

  // ============================================================
  // REMOVE HELPER FIELD
  // ============================================================
  delete newUserData.newWorkLog;
  delete newUserData.createdByName;
  delete newUserData.updatedByName;

  // Keep the existing worklogs + newly generated worklogs.
  newUserData.workLogs = workLogs;

  // Password will be hashed by UserSchema pre-save middleware.
  // Therefore use the document and save() instead of
  // findByIdAndUpdate().
  user.set(newUserData);

  await user.save();

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: user,
  });
});

// ==========================
// DELETE USER
// ==========================
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

// ==========================
// USER DROPDOWN
// ==========================
const getUserDropdown = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const search = req.query.search?.trim() || "";

  const query = {};

  if (search) {
    query.name = {
      $regex: search,
      $options: "i",
    };
  }

  const [roles, totalRecords, users] = await Promise.all([
    User.distinct("role"),
    User.countDocuments(query),
    User.find(query)
      .select("_id name email role isActive")
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: users,
    roles,
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    hasMore: page * limit < totalRecords,
  });
});

module.exports = {
  //   createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserDropdown,
};