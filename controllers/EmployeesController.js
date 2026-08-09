const mongoose = require("mongoose");
const Employee = require("../models/employee.model");

const MasterData = require("../models/options.model");
const Counter = require("../models/counter.model");

const { uploadToCloudinary } = require("../utils/uploadToCloudinary");

const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const { getChangedFields, addWorklog } = require("../utils/worklog");
const {
  convertStringToDateTime,
  convertStringFormatDateTime,
} = require("../utils/dateFormatter");

const { toggleEmployeeLogin } = require("../services/employeeLogin.seervice");

const getLoginEnabledEmployeesController = async (req, res) => {
  try {
    const employees = await getLoginEnabledEmployees();

    return res.status(200).json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("Get login enabled employees error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get login enabled employees",
    });
  }
};
// FOR ENABLING EMPLOYEE LOGIN, USE THE PATCH ROUTE /employees/enable-login WITH BODY { "employeeId": "<EMPLOYEE_ID>" }
const toggleEmployeeLoginController = async (req, res) => {
  try {
    const { employeeId } = req.body;

    console.log("Toggle Employee ID received:", employeeId);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const result = await toggleEmployeeLogin(employeeId);

    return res.status(200).json({
      success: true,
      message: result.loginEnabled
        ? "Employee login enabled successfully"
        : "Employee login disabled successfully",

      loginEnabled: result.loginEnabled,
      isActive: result.isActive,
      employeeId: result.employeeId,
    });
  } catch (error) {
    console.error("Toggle employee login error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update employee login",
    });
  }
};

// ============================================================
// HELPER: GET NEXT EMPLOYEE ID
// ============================================================

const getNextEmployeeId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: "employee" },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  const sequenceNumber = String(counter.sequence).padStart(2, "0");
  return `GG-24-EMP-${sequenceNumber}`;
};

// ============================================================
// HELPER: MASTER DATA VALIDATION
// ============================================================

const validateMasterData = async ({ departmentId, teamCodeId, statusId }) => {
  const masterIds = [departmentId, teamCodeId, statusId].filter(Boolean);

  if (!masterIds.length) {
    return;
  }

  const masterData = await MasterData.find({
    _id: {
      $in: masterIds,
    },
    isActive: true,
  }).lean();

  const masterMap = new Map(
    masterData.map((item) => [item._id.toString(), item]),
  );

  if (departmentId && !masterMap.has(departmentId.toString())) {
    throw new ApiError(400, "Invalid or inactive department.");
  }

  if (teamCodeId && !masterMap.has(teamCodeId.toString())) {
    throw new ApiError(400, "Invalid or inactive team code.");
  }

  if (statusId && !masterMap.has(statusId.toString())) {
    throw new ApiError(400, "Invalid or inactive employee status.");
  }

  return masterMap;
};

// ============================================================
// HELPER: FORMAT EMPLOYEE RESPONSE
// ============================================================

const formatEmployee = (employee) => {
  const data = employee.toObject ? employee.toObject() : employee;

  delete data.password;

  return {
    ...data,

    // Compatibility fields for existing frontend
    EmployeeID: data.employeeId,
    EmployeeName: data.employeeName,

    DepartmentCode: data.departmentCode || "",

    DepartmentName: data.department || "",

    TeamCode: data.teamCode || "",

    IsActive: data.status === "ACTIVE" ? "Yes" : "No",

    Designation: data.designation || "",

    Level: data.level || "",

    Role: data.role || "",

    // Dates FIX
    dateOfJoining: data.dateOfJoining ? new Date(data.dateOfJoining) : null,

    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,

    ParentCompany: data.parentCompany || "",

    WhatsAppNo: data.whatsappNo || "",

    CallingNo: data.callingNo || "",

    PermanentAddress: data.permanentAddress || "",

    TemporaryAddress: data.temporaryAddress || "",

    Email: data.email || "",

    ITLoginAllowedOrNotAllowed: data.itLoginAllowed ? "Allowed" : "Not Allowed",

    LoginID: data.loginId || "",

    AadharCard: data.documents?.aadharCard || [],

    Photo: data.documents?.photo || null,

    BankDetails: data.documents?.bankDetails || null,
  };
};

// ============================================================
// LOGIN API
// ============================================================

const LoginUser = asyncHandler(async (req, res) => {
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    throw new ApiError(400, "Missing loginId or password");
  }

  // ==========================================================
  // FIND EMPLOYEE
  // ==========================================================

  const employee = await Employee.findOne({
    loginId: loginId.trim().toLowerCase(),
  })
    .select("+password")
    .populate("departmentId")
    .populate("teamCodeId")
    .populate("statusId");

  if (!employee) {
    throw new ApiError(401, "Invalid login id or password");
  }

  // ==========================================================
  // CHECK PASSWORD
  // ==========================================================

  const isPasswordValid = await bcrypt.compare(password, employee.password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid login id or password");
  }

  // ==========================================================
  // CHECK STATUS
  // ==========================================================

  const statusCode = employee.statusId?.code?.toUpperCase();

  if (statusCode !== "ACTIVE") {
    throw new ApiError(403, "Your account is inactive. Please contact admin.");
  }

  // ==========================================================
  // CHECK IT LOGIN PERMISSION
  // ==========================================================

  if (!employee.itLoginAllowed) {
    throw new ApiError(403, "Login is not allowed for this employee.");
  }

  // ==========================================================
  // RESPONSE
  // ==========================================================

  const employeeResponse = formatEmployee(employee);

  return res.status(200).json({
    success: true,
    employee: employeeResponse,
  });
});

// ============================================================
// GET EMPLOYEES
// ============================================================

const getEmployeeDetails = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    departmentId = "",
    teamCodeId = "",
    statusId = "",
    designation = "",
    level = "",
    role = "",
  } = req.query;

  // ============================================================
  // PAGINATION
  // ============================================================

  const pageNumber = Math.max(Number(page) || 1, 1);

  const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const skip = (pageNumber - 1) * limitNumber;

  // ============================================================
  // FILTER
  // ============================================================

  const filter = {};

  // ============================================================
  // GLOBAL SEARCH
  // ============================================================

  if (search?.trim()) {
    const escapeRegex = (value = "") => {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };
    const searchRegex = new RegExp(escapeRegex(search.trim()), "i");

    filter.$or = [
      { employeeName: searchRegex },
      { employeeId: searchRegex },
      { email: searchRegex },
      { loginId: searchRegex },
      { whatsappNo: searchRegex },
      { callingNo: searchRegex },
      { parentCompany: searchRegex },
      { subsidiary: searchRegex },
      { designation: searchRegex },
      { level: searchRegex },
      { role: searchRegex },
    ];
  }

  // ============================================================
  // DROPDOWN FILTERS
  // ============================================================

  if (departmentId) {
    filter.department = departmentId;
  }

  if (teamCodeId) {
    filter.teamCode = teamCodeId;
  }

  if (statusId) {
    filter.status = statusId;
  }

  // ============================================================
  // OTHER FILTERS
  // ============================================================

  if (designation?.trim()) {
    filter.designation = new RegExp(
      designation.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  }

  if (level?.trim()) {
    filter.level = new RegExp(
      level.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  }

  if (role?.trim()) {
    filter.role = new RegExp(
      role.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  }

  // ============================================================
  // DATABASE QUERY
  // ============================================================

  const [employees, total] = await Promise.all([
    Employee.find(filter)
      .populate("department", "label value")
      .populate("teamCode", "label value")
      .populate("status", "label value")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .sort({ employeeId: 1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),

    Employee.countDocuments(filter),
  ]);

  // ============================================================
  // FORMAT RESPONSE
  // ============================================================

  const formattedEmployees = employees.map((employee) =>
    formatEmployee(employee),
  );

  // ============================================================
  // RESPONSE
  // ============================================================

  return res.status(200).json({
    success: true,
    status: "success",

    data: formattedEmployees,

    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      hasNextPage: pageNumber < Math.ceil(total / limitNumber),
      hasPreviousPage: pageNumber > 1,
    },
  });
});

// ============================================================
// GET SINGLE EMPLOYEE
// ============================================================

const getEmployeeById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const employee = await Employee.findById(id)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  return res.status(200).json({
    success: true,
    data: employee,
  });
});
// ============================================================
// CREATE EMPLOYEE
// ============================================================

const createEmployee = asyncHandler(async (req, res) => {
  const {
    employeeName,

    // Organization
    department,
    teamCode,
    status,
    departmentCode,

    additionalAccess,
    designation,
    level,
    role,

    // Dates
    dateOfJoining,
    dateOfBirth,

    // Company
    parentCompany,
    subsidiary,

    // Contact
    whatsappNo,
    callingNo,
    email,

    // Address
    permanentAddress,
    temporaryAddress,

    // Emergency
    emergencyContacts,

    // Login
    itLoginAllowed = false,
    loginId,
    password,
  } = req.body;

  // ========================================================
  // VALIDATION
  // ========================================================

  if (!employeeName?.trim()) {
    throw new ApiError(400, "Employee name is required.");
  }

  if (!department?.trim()) {
    throw new ApiError(400, "Department is required.");
  }

  // if (!teamCode?.trim()) {
  //   throw new ApiError(400, "Team code is required.");
  // }

  if (!status?.trim()) {
    throw new ApiError(400, "Employee status is required.");
  }

  // ========================================================
  // LOGIN VALIDATION
  // ========================================================

  if (itLoginAllowed) {
    if (!loginId?.trim()) {
      throw new ApiError(400, "Login ID is required when login is allowed.");
    }

    if (!password) {
      throw new ApiError(400, "Password is required when login is allowed.");
    }

    const existingLogin = await Employee.findOne({
      loginId: loginId.trim().toLowerCase(),
    });

    if (existingLogin) {
      throw new ApiError(409, "Login ID already exists.");
    }
  }

  // ========================================================
  // GENERATE EMPLOYEE ID
  // ========================================================

  const employeeId = await getNextEmployeeId();

  // ========================================================
  // PASSWORD HASH
  // ========================================================

  let hashedPassword;

  if (password) {
    hashedPassword = await bcrypt.hash(password, 12);
  }

  // ========================================================
  // CREATE EMPLOYEE
  // ========================================================

  const employee = await Employee.create({
    employeeId,

    // Basic
    employeeName: employeeName.trim(),

    // Organization
    department: department.trim(),
    teamCode: teamCode?.trim() || "",
    status: status.trim(),
    departmentCode: departmentCode?.trim(),

    additionalAccess: additionalAccess || [],

    designation: designation?.trim(),
    level: level?.trim(),
    role: role?.trim(),

    dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,

    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    // Company
    parentCompany: parentCompany?.trim(),
    subsidiary: subsidiary?.trim(),

    // Contact
    whatsappNo: whatsappNo?.trim(),
    callingNo: callingNo?.trim(),

    email: email?.trim().toLowerCase(),

    // Address
    permanentAddress: permanentAddress?.trim(),
    temporaryAddress: temporaryAddress?.trim(),

    // Emergency
    emergencyContacts: emergencyContacts || [],

    // Login
    itLoginAllowed,

    loginId: loginId?.trim().toLowerCase(),

    password: hashedPassword,

    // Audit
    createdBy: req.user?._id || null,
    updatedBy: req.user?._id || null,
  });

  return res.status(201).json({
    success: true,
    message: "Employee created successfully",

    employeeId: employee.employeeId,

    data: employee,
  });
});

// ============================================================
// UPDATE EMPLOYEE
// ============================================================
const isEqual = (a, b) => {
  return JSON.stringify(a) === JSON.stringify(b);
};
const normalizeSimpleValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (value && typeof value.toObject === "function") {
    return normalizeSimpleValue(value.toObject());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (
      trimmed === "" ||
      trimmed.toLowerCase() === "n/a" ||
      trimmed.toLowerCase() === "na"
    ) {
      return null;
    }

    return trimmed;
  }

  return value;
};
const normalizeEmergencyContact = (contact) => {
  if (!contact) {
    return null;
  }

  const data =
    typeof contact.toObject === "function" ? contact.toObject() : contact;

  const fullName = normalizeSimpleValue(data.fullName ?? data.name);

  const number = normalizeSimpleValue(data.number ?? data.phone);

  // Completely empty contact
  if (!fullName && !number) {
    return null;
  }

  return {
    fullName,
    number,
  };
};
const formatEmergencyContact = (contact) => {
  const normalized = normalizeEmergencyContact(contact);

  if (!normalized) {
    return null;
  }

  const parts = [];

  if (normalized.fullName) {
    parts.push(normalized.fullName);
  }

  if (normalized.number) {
    parts.push(normalized.number);
  }

  return parts.join(" - ") || null;
};
const isWorklogEqual = (oldValue, newValue) => {
  return (
    JSON.stringify(normalizeWorklogValue(oldValue)) ===
    JSON.stringify(normalizeWorklogValue(newValue))
  );
};
const prepareWorklogValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (value && typeof value.toObject === "function") {
    return prepareWorklogValue(value.toObject());
  }

  if (Array.isArray(value)) {
    return value.map((item) => prepareWorklogValue(item));
  }

  if (typeof value === "object") {
    const result = {};

    for (const [key, val] of Object.entries(value)) {
      if (key === "_id" || key === "__v") {
        continue;
      }

      result[key] = prepareWorklogValue(val);
    }

    return result;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (
      trimmed === "" ||
      trimmed.toLowerCase() === "n/a" ||
      trimmed.toLowerCase() === "na"
    ) {
      return null;
    }

    return trimmed;
  }

  return value;
};
const updateEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Employee ID is required.");
  }

  const employee = await Employee.findById(id).select("+password");

  if (!employee) {
    throw new ApiError(404, "Employee not found.");
  }

  const body = {
    ...req.body,
  };

  // ========================================================
  // REMOVE IMMUTABLE / UNSAFE FIELDS
  // ========================================================

  delete body._id;
  delete body.__v;

  delete body.worklogs;
  delete body.password;

  // ========================================================
  // STRING NORMALIZATION
  // ========================================================

  const stringFields = [
    "employeeName",
    "department",
    "teamCode",
    "status",
    "designation",
    "level",
    "role",
    "parentCompany",
    "subsidiary",
    "whatsappNo",
    "callingNo",
    "email",
    "permanentAddress",
    "temporaryAddress",
  ];

  for (const field of stringFields) {
    if (body[field] !== undefined && typeof body[field] === "string") {
      body[field] = body[field].trim();
    }
  }

  // ========================================================
  // LOGIN ID
  // ========================================================

  if (body.loginId !== undefined) {
    const loginId = body.loginId?.trim().toLowerCase();

    if (loginId) {
      const duplicate = await Employee.findOne({
        loginId,
        _id: {
          $ne: employee._id,
        },
      });

      if (duplicate) {
        throw new ApiError(409, "Login ID already exists.");
      }

      body.loginId = loginId;
    } else {
      body.loginId = null;
    }
  }

  // ========================================================
  // PASSWORD
  // ========================================================

  let passwordChanged = false;

  if (req.body.password) {
    body.password = await bcrypt.hash(req.body.password, 12);
    passwordChanged = true;
  }

  // ========================================================
  // DATE CONVERSION
  // ========================================================

  if (body.dateOfJoining !== undefined) {
    body.dateOfJoining = body.dateOfJoining
      ? new Date(body.dateOfJoining)
      : null;
  }

  if (body.dateOfBirth !== undefined) {
    body.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  }

  // ========================================================
  // FIND CHANGES
  // ========================================================

  // ========================================================
  // FIND ACTUAL CHANGES
  // ========================================================

  // ========================================================
  // FIND ACTUAL CHANGES
  // ========================================================

  const changes = [];

  const ignoredHistoryFields = [
    "_id",
    "__v",

    "worklogs",
    "password",
    "updatedBy",
    "createdBy",
    "createdAt",
    "updatedAt",
  ];

  for (const field of Object.keys(body)) {
    if (ignoredHistoryFields.includes(field)) {
      continue;
    }

    const oldValue = employee[field];
    const newValue = body[field];

    // ======================================================
    // EMERGENCY CONTACTS
    // ======================================================

    if (field === "emergencyContacts") {
      const oldContacts = Array.isArray(oldValue) ? oldValue : [];

      const newContacts = Array.isArray(newValue) ? newValue : [];

      const maxContacts = Math.max(oldContacts.length, newContacts.length);

      for (let i = 0; i < maxContacts; i++) {
        const oldContact = formatEmergencyContact(oldContacts[i]);

        const newContact = formatEmergencyContact(newContacts[i]);

        // Both empty -> no change
        if (!oldContact && !newContact) {
          continue;
        }

        // Same -> no change
        if (oldContact === newContact) {
          continue;
        }

        changes.push({
          field: `Emergency Contact ${i + 1}`,
          oldValue: oldContact,
          newValue: newContact,
        });
      }

      continue;
    }

    // ======================================================
    // NORMAL FIELDS
    // ======================================================

    const normalizedOld = normalizeSimpleValue(oldValue);
    const normalizedNew = normalizeSimpleValue(newValue);

    if (JSON.stringify(normalizedOld) === JSON.stringify(normalizedNew)) {
      continue;
    }

    changes.push({
      field,
      oldValue: normalizedOld,
      newValue: normalizedNew,
    });
  }

  // ========================================================
  // PASSWORD CHANGE
  // ========================================================

  if (passwordChanged) {
    changes.push({
      field: "password",
      oldValue: "[HIDDEN]",
      newValue: "[HIDDEN]",
    });
  }

  // ========================================================
  // WORKLOG
  // ========================================================

  if (changes.length > 0) {
    employee.worklogs.push({
      action: "UPDATE",

      description: `${changes.length} field${
        changes.length > 1 ? "s" : ""
      } updated`,

      changes,

      // Authentication not implemented yet
      updatedBy: null,
      updatedByName: "Pooja",
    });
  }

  // ========================================================
  // UPDATE EMPLOYEE
  // ========================================================

  Object.assign(employee, body);

  await employee.save();

  return res.status(200).json({
    success: true,

    message:
      changes.length > 0
        ? "Employee updated successfully"
        : "No changes detected",

    data: formatEmployee(employee),
  });
});

// ============================================================
// DELETE / DEACTIVATE EMPLOYEE
// ============================================================

const deleteEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await Employee.findByIdAndDelete(id);

  return res.status(200).json({
    success: true,
    message: "Employee deleted successfully",
  });
});

// const deleteEmployee = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const employee = await Employee.findById(id);

//   if (!employee) {
//     throw new ApiError(404, "Employee not found.");
//   }

//   const inactiveStatus = await MasterData.findOne({
//     categoryKey: "employee_status",
//     code: "INACTIVE",
//     isActive: true,
//   });

//   if (!inactiveStatus) {
//     throw new ApiError(
//       500,
//       "Inactive employee status is not configured in MasterData.",
//     );
//   }

//   employee.statusId = inactiveStatus._id;
//   employee.itLoginAllowed = false;
//   employee.updatedBy = req.user?._id || null;

//   await employee.save();

//   return res.status(200).json({
//     success: true,
//     message: "Employee deactivated successfully",
//   });
// });

// ============================================================
// EMPLOYEE DOCUMENT UPLOAD
// ============================================================

const EmployeeDocumentUpload = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Employee ID is required.");
  }

  const employee = await Employee.findById(id);

  if (!employee) {
    throw new ApiError(404, "Employee not found.");
  }

  const employeeId = employee.employeeId;
  const files = req.files || {};

  const uploadedDocuments = {};

  // ======================================================
  // AADHAR CARD
  // ======================================================

  if (files.aadharCard?.length) {
    const aadharUploads = [];

    for (const file of files.aadharCard) {
      const result = await uploadToCloudinary(
        file.buffer,
        `employees/${employeeId}/aadhar`,
      );

      if (result?.secure_url) {
        aadharUploads.push({
          url: result.secure_url,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        });
      }
    }

    if (aadharUploads.length) {
      employee.documents.aadharCard.push(...aadharUploads);
      uploadedDocuments.aadharCard = aadharUploads;
    }
  }

  // ======================================================
  // PHOTO
  // ======================================================

  if (files.photo?.length) {
    const file = files.photo[0];

    const result = await uploadToCloudinary(
      file.buffer,
      `employees/${employeeId}/photo`,
    );

    if (result?.secure_url) {
      employee.documents.photo = {
        url: result.secure_url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };

      uploadedDocuments.photo = employee.documents.photo;
    }
  }

  // ======================================================
  // BANK PASSBOOK
  // ======================================================

  if (files.bankPassbook?.length) {
    const file = files.bankPassbook[0];

    const result = await uploadToCloudinary(
      file.buffer,
      `employees/${employeeId}/bank-details`,
    );

    if (result?.secure_url) {
      employee.documents.bankDetails = {
        url: result.secure_url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };

      uploadedDocuments.bankDetails = employee.documents.bankDetails;
    }
  }

  // ======================================================
  // SAVE
  // ======================================================

  employee.updatedBy = req.user?._id || null;

  await employee.save();

  return res.status(200).json({
    success: true,
    message: "Documents uploaded successfully",
    uploadedDocuments,
  });
});

// ============================================================
// GET EMPLOYEE WORKLOGS
// ============================================================

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  LoginUser,

  getEmployeeDetails,
  getEmployeeById,

  createEmployee,
  updateEmployee,
  deleteEmployee,

  EmployeeDocumentUpload,
  toggleEmployeeLoginController,
  getLoginEnabledEmployeesController,
};
